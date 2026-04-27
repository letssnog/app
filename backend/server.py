"""
Let's Snog – FastAPI backend
- Emergent Google Auth (session cookie)
- Emergent Object Storage (profile photos)
- MongoDB (motor) for users, matches, events, chats, dates
- WebSocket live chat for speed-dating event rounds

REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
"""
from fastapi import (
    FastAPI, APIRouter, HTTPException, Header, Cookie, Response,
    UploadFile, File, Query, WebSocket, WebSocketDisconnect, Request
)
from fastapi.responses import JSONResponse
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from pathlib import Path
from datetime import datetime, timezone, timedelta
import os, uuid, logging, json, random, asyncio, secrets, time
import requests
from zoneinfo import ZoneInfo
from jose import jwt
from jose.exceptions import JWTError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')  # legacy (no longer used)
APP_NAME = os.environ.get('APP_NAME', 'letssnog')

# ---------------------------------------------------------------------------
# Auth (AWS Cognito JWT)
# ---------------------------------------------------------------------------
COGNITO_REGION = os.environ.get("COGNITO_REGION")
COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID")
COGNITO_APP_CLIENT_ID = os.environ.get("COGNITO_APP_CLIENT_ID")

_jwks_cache: dict | None = None
_jwks_cache_at: float = 0.0


def _cognito_issuer() -> str:
    if not (COGNITO_REGION and COGNITO_USER_POOL_ID):
        raise RuntimeError("Missing COGNITO_REGION / COGNITO_USER_POOL_ID")
    return f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"


def _get_jwks() -> dict:
    global _jwks_cache, _jwks_cache_at
    now = time.time()
    if _jwks_cache and (now - _jwks_cache_at) < 3600:
        return _jwks_cache
    url = f"{_cognito_issuer()}/.well-known/jwks.json"
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    _jwks_cache = r.json()
    _jwks_cache_at = now
    return _jwks_cache


def verify_cognito_jwt(token: str) -> dict:
    """
    Verify a Cognito JWT (prefer ID token for API so we get email/name claims).
    """
    if not token:
        raise HTTPException(401, "Not authenticated")
    if not (COGNITO_REGION and COGNITO_USER_POOL_ID and COGNITO_APP_CLIENT_ID):
        logger.error("Cognito env not configured")
        raise HTTPException(500, "Auth not configured")

    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        jwks = _get_jwks().get("keys", [])
        key = next((k for k in jwks if k.get("kid") == kid), None)
        if not key:
            raise HTTPException(401, "Invalid token")

        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=COGNITO_APP_CLIENT_ID,
            issuer=_cognito_issuer(),
            options={"verify_aud": True, "verify_iss": True},
        )
        # token_use is typically "id" or "access"
        if claims.get("token_use") not in ("id", "access"):
            raise HTTPException(401, "Invalid token")
        return claims
    except HTTPException:
        raise
    except JWTError:
        raise HTTPException(401, "Invalid token")
    except Exception as e:
        logger.error(f"JWT verification error: {e}")
        raise HTTPException(401, "Invalid token")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Let's Snog API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("letssnog")

LONDON_TZ = ZoneInfo("Europe/London")

# ---------------------------------------------------------------------------
# S3 Photo Storage helpers
# ---------------------------------------------------------------------------
import boto3

S3_BUCKET = os.environ.get("S3_BUCKET")
AWS_REGION = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
S3_PUBLIC_BASE_URL = os.environ.get("S3_PUBLIC_BASE_URL")  # e.g. https://bucket.s3.region.amazonaws.com


def _s3_client():
    if not S3_BUCKET:
        raise HTTPException(500, "S3_BUCKET not configured")
    return boto3.client("s3", region_name=AWS_REGION)


def s3_public_url(key: str) -> str:
    if not S3_PUBLIC_BASE_URL:
        if not (S3_BUCKET and AWS_REGION):
            raise HTTPException(500, "S3_PUBLIC_BASE_URL (or S3_BUCKET+AWS_REGION) not configured")
        base = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com"
    else:
        base = S3_PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/{key.lstrip('/')}"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    pronouns: Optional[str] = None
    looking_for: Optional[str] = None
    bio: Optional[str] = None
    height_cm: Optional[int] = None
    job: Optional[str] = None
    education: Optional[str] = None
    interests: List[str] = []
    photos: List[str] = []  # storage paths; first = primary
    quiz: List[str] = []     # answer codes A-D for 8 questions
    prompts: List[Dict[str, str]] = []  # [{"q":"...","a":"..."}]
    location: str = "London"
    age_min: int = 21
    age_max: int = 45
    # lifestyle
    smokes: Optional[str] = None      # never|sometimes|regularly
    drinks: Optional[str] = None      # never|sometimes|regularly
    workout: Optional[str] = None     # never|sometimes|often|daily
    has_kids: Optional[str] = None    # no|yes|prefer_not_to_say
    wants_kids: Optional[str] = None  # no|yes|maybe|already_have
    religion: Optional[str] = None
    zodiac: Optional[str] = None
    dates_completed: int = 0
    premium: bool = False
    is_admin: bool = False
    is_banned: bool = False
    blocked_user_ids: List[str] = []
    onboarding_complete: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    pronouns: Optional[str] = None
    looking_for: Optional[str] = None
    bio: Optional[str] = None
    height_cm: Optional[int] = None
    job: Optional[str] = None
    education: Optional[str] = None
    interests: Optional[List[str]] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    smokes: Optional[str] = None
    drinks: Optional[str] = None
    workout: Optional[str] = None
    has_kids: Optional[str] = None
    wants_kids: Optional[str] = None
    religion: Optional[str] = None
    zodiac: Optional[str] = None
    prompts: Optional[List[Dict[str, str]]] = None


class PhotoReorder(BaseModel):
    paths: List[str]


class PhotoPresignIn(BaseModel):
    content_type: str = "image/jpeg"
    ext: str = "jpg"


class PhotoConfirmIn(BaseModel):
    key: str


class DateRequestIn(BaseModel):
    activity: str         # e.g. drinks, dinner, walk, coffee, gig, brunch, custom
    timeframe: str        # this_week | this_weekend | next_week | next_weekend | flexible
    message: Optional[str] = None


class DateRequestRespond(BaseModel):
    accept: bool


class ReportIn(BaseModel):
    reported_user_id: str
    match_id: Optional[str] = None
    reason: str
    detail: Optional[str] = None


class BlockIn(BaseModel):
    user_id: str


class QuizSubmit(BaseModel):
    answers: List[str]


class SwipeIn(BaseModel):
    target_id: str
    action: str  # like | pass | super
    date_request: Optional[DateRequestIn] = None


class EventCreate(BaseModel):
    title: str
    starts_at: datetime
    ends_at: datetime
    capacity: int = 40


class RoundDecision(BaseModel):
    round_idx: int
    opponent_id: str
    decision: str  # yes | no


class MessageIn(BaseModel):
    body: str


class DatePlanIn(BaseModel):
    planned_at: datetime
    venue_name: str
    venue_address: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class FeedbackIn(BaseModel):
    enjoyed: bool
    want_continue: bool


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
) -> User:
    # Back-compat: accept cookie, but treat it as a bearer JWT if present.
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif session_token:
        token = session_token
    claims = verify_cognito_jwt(token)

    sub = claims.get("sub")
    if not sub:
        raise HTTPException(401, "Invalid token")

    user_id = f"user_{sub}"
    email = (claims.get("email") or "").lower()
    name = claims.get("name") or claims.get("given_name") or (email.split("@")[0] if email else "Snogger")

    existing = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not existing:
        is_first = (await db.users.count_documents({})) == 0
        await db.users.insert_one({
            "user_id": user_id,
            "cognito_sub": sub,
            "email": email or f"{sub}@cognito.local",
            "name": name,
            "picture": claims.get("picture"),
            "age": None, "gender": None, "pronouns": None, "looking_for": None, "bio": None,
            "height_cm": None, "job": None, "education": None, "interests": [], "photos": [],
            "quiz": [], "prompts": [], "location": "London", "age_min": 21, "age_max": 45,
            "smokes": None, "drinks": None, "workout": None,
            "has_kids": None, "wants_kids": None, "religion": None, "zodiac": None,
            "dates_completed": 0, "premium": False,
            "is_admin": is_first, "is_banned": False, "blocked_user_ids": [],
            "onboarding_complete": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        # best-effort profile refresh from IdP
        patch = {}
        if email and email != existing.get("email"):
            patch["email"] = email
        if name and name != existing.get("name"):
            patch["name"] = name
        pic = claims.get("picture")
        if pic and pic != existing.get("picture"):
            patch["picture"] = pic
        if patch:
            await db.users.update_one({"user_id": user_id}, {"$set": patch})

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(401, "User not found")
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    return User(**user_doc)


@api.post("/auth/session")
async def auth_session(payload: Dict[str, str], response: Response):
    # Emergent auth endpoint removed in the AWS/Cognito migration.
    raise HTTPException(410, "This endpoint has been removed. Use Cognito sign-in and call /auth/me with Bearer JWT.")


@api.get("/auth/me", response_model=User)
async def auth_me(user: User = None, request: Request = None,
                  session_token: Optional[str] = Cookie(None),
                  authorization: Optional[str] = Header(None)):
    return await get_current_user(request, session_token, authorization)


@api.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None)):
    # Stateless with JWT. Frontend just drops tokens.
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Profile / Photos / Quiz
# ---------------------------------------------------------------------------
@api.put("/users/me", response_model=User)
async def update_me(
    body: ProfileUpdate,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if update:
        await db.users.update_one({"user_id": me.user_id}, {"$set": update})
    # check completion
    fresh = await db.users.find_one({"user_id": me.user_id}, {"_id": 0})
    complete = bool(fresh.get("age") and fresh.get("bio") and fresh.get("photos") and fresh.get("quiz"))
    await db.users.update_one({"user_id": me.user_id}, {"$set": {"onboarding_complete": complete}})
    fresh["onboarding_complete"] = complete
    if isinstance(fresh.get("created_at"), str):
        fresh["created_at"] = datetime.fromisoformat(fresh["created_at"])
    return User(**fresh)


@api.post("/users/me/photos/presign")
async def presign_photo_upload(
    body: PhotoPresignIn,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    ext = (body.ext or "jpg").lower().lstrip(".")
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"
    content_type = (body.content_type or "image/jpeg").split(";")[0].strip()
    if not content_type.startswith("image/"):
        content_type = "image/jpeg"
    key = f"{APP_NAME}/users/{me.user_id}/{uuid.uuid4().hex}.{ext}"
    s3 = _s3_client()
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": S3_BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=300,
    )
    return {"key": key, "upload_url": upload_url, "public_url": s3_public_url(key)}


@api.post("/users/me/photos/confirm")
async def confirm_photo_upload(
    body: PhotoConfirmIn,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    key = (body.key or "").lstrip("/")
    if not key:
        raise HTTPException(400, "key required")
    url = s3_public_url(key)
    await db.users.update_one({"user_id": me.user_id}, {"$addToSet": {"photos": url}})
    return {"url": url}


@api.delete("/users/me/photos")
async def delete_photo(
    request: Request,
    path: str = Query(...),
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    await db.users.update_one({"user_id": me.user_id}, {"$pull": {"photos": path}})
    return {"ok": True}


@api.post("/users/me/photos/reorder", response_model=User)
async def reorder_photos(
    body: PhotoReorder,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    me_doc = await db.users.find_one({"user_id": me.user_id}, {"_id": 0})
    valid = [p for p in body.paths if p in (me_doc.get("photos") or [])]
    await db.users.update_one({"user_id": me.user_id}, {"$set": {"photos": valid}})
    fresh = await db.users.find_one({"user_id": me.user_id}, {"_id": 0})
    if isinstance(fresh.get("created_at"), str):
        fresh["created_at"] = datetime.fromisoformat(fresh["created_at"])
    return User(**fresh)


@api.get("/users/{user_id}")
async def get_user_detail(
    user_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u or u.get("is_banned"):
        raise HTTPException(404, "User not found")
    # Privacy: only return safe fields
    return {
        "user_id": u["user_id"], "name": u["name"],
        "age": u.get("age"), "pronouns": u.get("pronouns"),
        "bio": u.get("bio"), "job": u.get("job"),
        "education": u.get("education"),
        "height_cm": u.get("height_cm"),
        "interests": u.get("interests", []),
        "photos": u.get("photos", []),
        "prompts": u.get("prompts", []),
        "smokes": u.get("smokes"), "drinks": u.get("drinks"),
        "workout": u.get("workout"),
        "has_kids": u.get("has_kids"), "wants_kids": u.get("wants_kids"),
        "religion": u.get("religion"), "zodiac": u.get("zodiac"),
        "location": u.get("location", "London"),
    }


@api.get("/files/{path:path}")
async def serve_file(path: str):
    """
    Back-compat: redirect storage keys to their public S3 URL.
    If you store absolute URLs in `users.photos` (recommended), the frontend won't need this.
    """
    try:
        return RedirectResponse(url=s3_public_url(path), status_code=307)
    except Exception:
        raise HTTPException(404, "File not found")


VIBE_QUESTIONS = [
    {"id": 1, "q": "Friday night, your ideal vibe?", "options": [
        {"k": "A", "t": "Cosy pub with mates"},
        {"k": "B", "t": "Cocktail bar in Soho"},
        {"k": "C", "t": "Late-night warehouse rave"},
        {"k": "D", "t": "Netflix and a takeaway"},
    ]},
    {"id": 2, "q": "Pick a London neighbourhood", "options": [
        {"k": "A", "t": "Shoreditch"}, {"k": "B", "t": "Notting Hill"},
        {"k": "C", "t": "Peckham"}, {"k": "D", "t": "Hampstead"},
    ]},
    {"id": 3, "q": "Sunday morning?", "options": [
        {"k": "A", "t": "Hyde Park run"}, {"k": "B", "t": "Boozy brunch"},
        {"k": "C", "t": "Sleeping it off"}, {"k": "D", "t": "Borough Market mooch"},
    ]},
    {"id": 4, "q": "What's your love language?", "options": [
        {"k": "A", "t": "Quality time"}, {"k": "B", "t": "Physical touch"},
        {"k": "C", "t": "Words of affirmation"}, {"k": "D", "t": "Acts of service"},
    ]},
    {"id": 5, "q": "Holiday of choice?", "options": [
        {"k": "A", "t": "Beach in Lisbon"}, {"k": "B", "t": "Hiking the Lake District"},
        {"k": "C", "t": "City break in Berlin"}, {"k": "D", "t": "All-inclusive Ibiza"},
    ]},
    {"id": 6, "q": "Chosen poison?", "options": [
        {"k": "A", "t": "Pint of cask ale"}, {"k": "B", "t": "Negroni"},
        {"k": "C", "t": "Espresso martini"}, {"k": "D", "t": "Sober & smug"},
    ]},
    {"id": 7, "q": "Deal-breaker on a first date?", "options": [
        {"k": "A", "t": "On their phone"}, {"k": "B", "t": "Rude to staff"},
        {"k": "C", "t": "Talks only about exes"}, {"k": "D", "t": "Doesn't laugh"},
    ]},
    {"id": 8, "q": "What are you actually after?", "options": [
        {"k": "A", "t": "Long-term love"}, {"k": "B", "t": "Something fun & casual"},
        {"k": "C", "t": "Speed-dating events first"}, {"k": "D", "t": "Just curious, leave me alone"},
    ]},
]


@api.get("/quiz/questions")
async def get_quiz():
    return VIBE_QUESTIONS


@api.post("/users/me/quiz", response_model=User)
async def submit_quiz(
    body: QuizSubmit,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if len(body.answers) != 8:
        raise HTTPException(400, "Need exactly 8 answers")
    await db.users.update_one({"user_id": me.user_id}, {"$set": {"quiz": body.answers}})
    fresh = await db.users.find_one({"user_id": me.user_id}, {"_id": 0})
    complete = bool(fresh.get("age") and fresh.get("bio") and fresh.get("photos") and fresh.get("quiz"))
    await db.users.update_one({"user_id": me.user_id}, {"$set": {"onboarding_complete": complete}})
    fresh["onboarding_complete"] = complete
    if isinstance(fresh.get("created_at"), str):
        fresh["created_at"] = datetime.fromisoformat(fresh["created_at"])
    return User(**fresh)


# ---------------------------------------------------------------------------
# Matching algorithm
# ---------------------------------------------------------------------------
def compatibility_score(me: dict, other: dict) -> float:
    # 70% quiz overlap
    q1, q2 = me.get("quiz") or [], other.get("quiz") or []
    if q1 and q2 and len(q1) == len(q2):
        overlap = sum(1 for a, b in zip(q1, q2) if a == b) / len(q1)
    else:
        overlap = 0.0
    quiz_part = 0.70 * overlap

    # 20% location/age
    loc_match = 1.0 if me.get("location") == other.get("location") else 0.5
    age_ok = 0.0
    if other.get("age") and me.get("age_min") and me.get("age_max"):
        if me["age_min"] <= other["age"] <= me["age_max"]:
            age_ok = 1.0
    loc_age_part = 0.20 * (0.5 * loc_match + 0.5 * age_ok)

    # 10% behaviour boost
    boost = min(other.get("dates_completed", 0) / 5, 1.0)
    boost_part = 0.10 * boost

    return quiz_part + loc_age_part + boost_part


def london_today_str() -> str:
    return datetime.now(LONDON_TZ).strftime("%Y-%m-%d")


@api.get("/matches/daily")
async def daily_matches(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    today = london_today_str()
    me_doc = await db.users.find_one({"user_id": me.user_id}, {"_id": 0})

    set_doc = await db.daily_sets.find_one({"user_id": me.user_id, "date": today}, {"_id": 0})
    if not set_doc:
        # gather pool: opposite-or-any gender, has quiz, not me, not previously swiped, not blocked
        already = await db.swipes.find({"actor_id": me.user_id}, {"_id": 0, "target_id": 1}).to_list(5000)
        already_ids = {a["target_id"] for a in already}
        already_ids.add(me.user_id)
        already_ids.update(me_doc.get("blocked_user_ids") or [])
        # also exclude users who blocked me
        blockers = await db.users.find({"blocked_user_ids": me.user_id}, {"_id": 0, "user_id": 1}).to_list(5000)
        already_ids.update(b["user_id"] for b in blockers)

        candidates_cursor = db.users.find(
            {"user_id": {"$nin": list(already_ids)},
             "onboarding_complete": True,
             "is_banned": {"$ne": True},
             "photos.0": {"$exists": True}},
            {"_id": 0},
        )
        pool = await candidates_cursor.to_list(500)
        # gender filter (soft)
        if me_doc.get("looking_for") and me_doc["looking_for"] != "everyone":
            pool = [u for u in pool if not u.get("gender") or u["gender"] == me_doc["looking_for"]]

        scored = sorted(
            ((compatibility_score(me_doc, u), u) for u in pool),
            key=lambda x: x[0], reverse=True,
        )
        # premium gets 15, free gets 12
        cap = 15 if me_doc.get("premium") else 12
        chosen = [u["user_id"] for _, u in scored[:cap]]
        await db.daily_sets.insert_one({
            "user_id": me.user_id, "date": today,
            "candidate_user_ids": chosen,
            "reviewed_user_ids": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        set_doc = {"candidate_user_ids": chosen, "reviewed_user_ids": []}

    remaining_ids = [u for u in set_doc["candidate_user_ids"] if u not in set_doc["reviewed_user_ids"]]
    profiles = []
    for uid in remaining_ids:
        u = await db.users.find_one({"user_id": uid}, {"_id": 0})
        if not u:
            continue
        score = compatibility_score(me_doc, u)
        profiles.append({
            "user_id": u["user_id"], "name": u["name"],
            "age": u.get("age"), "bio": u.get("bio"),
            "job": u.get("job"), "height_cm": u.get("height_cm"),
            "interests": u.get("interests", []),
            "photos": u.get("photos", []),
            "score": round(score, 2),
        })
    return {
        "date": today,
        "total": len(set_doc["candidate_user_ids"]),
        "remaining": len(remaining_ids),
        "profiles": profiles,
    }


@api.post("/matches/swipe")
async def swipe(
    body: SwipeIn,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if body.action not in ("like", "pass", "super"):
        raise HTTPException(400, "Bad action")
    await db.swipes.insert_one({
        "actor_id": me.user_id, "target_id": body.target_id,
        "action": body.action,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    today = london_today_str()
    await db.daily_sets.update_one(
        {"user_id": me.user_id, "date": today},
        {"$addToSet": {"reviewed_user_ids": body.target_id}},
    )
    matched = False
    match_id = None
    date_request_id = None
    # Optional date-request attached to a like/super
    if body.action in ("like", "super") and body.date_request:
        dr = body.date_request
        date_request_id = f"dr_{uuid.uuid4().hex[:12]}"
        await db.date_requests.insert_one({
            "request_id": date_request_id,
            "from_user_id": me.user_id,
            "to_user_id": body.target_id,
            "activity": dr.activity,
            "timeframe": dr.timeframe,
            "message": (dr.message or "")[:280],
            "status": "pending",
            "match_id": None,
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    if body.action in ("like", "super"):
        # check reciprocity
        rev = await db.swipes.find_one(
            {"actor_id": body.target_id, "target_id": me.user_id, "action": {"$in": ["like", "super"]}},
            {"_id": 0},
        )
        if rev:
            existing = await db.matches.find_one(
                {"$or": [
                    {"user_a": me.user_id, "user_b": body.target_id},
                    {"user_a": body.target_id, "user_b": me.user_id},
                ]}, {"_id": 0},
            )
            if not existing:
                match_id = f"match_{uuid.uuid4().hex[:12]}"
                await db.matches.insert_one({
                    "match_id": match_id,
                    "user_a": me.user_id, "user_b": body.target_id,
                    "source": "daily", "chat_open": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "last_message_at": None,
                })
            else:
                match_id = existing["match_id"]
            matched = True
            # Attach any pending date-requests between these two users to this match
            await db.date_requests.update_many(
                {"$or": [
                    {"from_user_id": me.user_id, "to_user_id": body.target_id},
                    {"from_user_id": body.target_id, "to_user_id": me.user_id},
                ], "status": "pending"},
                {"$set": {"match_id": match_id}},
            )
    return {"matched": matched, "match_id": match_id, "date_request_id": date_request_id}


# ---------------------------------------------------------------------------
# Events – Speed Dating
# ---------------------------------------------------------------------------
async def seed_default_events():
    """Create the next two Tuesday and Thursday 7-9pm London events if not present."""
    now_london = datetime.now(LONDON_TZ)
    targets = []
    for delta in range(0, 21):
        d = now_london + timedelta(days=delta)
        if d.weekday() in (1, 3):  # Tue=1, Thu=3
            starts = d.replace(hour=19, minute=0, second=0, microsecond=0)
            if starts > now_london:
                ends = starts + timedelta(hours=2)
                targets.append((starts, ends))
        if len(targets) >= 4:
            break
    for starts, ends in targets:
        title = f"Snog Speed-Dating · {starts.strftime('%a %d %b · 7pm')}"
        existing = await db.events.find_one({"title": title}, {"_id": 0})
        if existing:
            continue
        await db.events.insert_one({
            "event_id": f"evt_{uuid.uuid4().hex[:10]}",
            "title": title,
            "starts_at": starts.astimezone(timezone.utc).isoformat(),
            "ends_at": ends.astimezone(timezone.utc).isoformat(),
            "capacity": 40,
            "registered_user_ids": [],
            "status": "upcoming",
            "pairings": {},  # user_id -> [opponent_a, opponent_b, opponent_c]
            "round_decisions": {},  # f"{round}:{a}:{b}" -> "yes"/"no"
            "round_started_at": None,
            "current_round": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


@api.get("/events")
async def list_events():
    rows = await db.events.find({"status": {"$ne": "ended"}}, {"_id": 0}).sort("starts_at", 1).to_list(50)
    return rows


@api.post("/events/{event_id}/signup")
async def signup_event(
    event_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    evt = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not evt:
        raise HTTPException(404, "Event not found")
    if len(evt["registered_user_ids"]) >= evt["capacity"] and me.user_id not in evt["registered_user_ids"]:
        raise HTTPException(400, "Event is full, mate. Try the next one!")
    await db.events.update_one({"event_id": event_id}, {"$addToSet": {"registered_user_ids": me.user_id}})
    return {"ok": True}


@api.delete("/events/{event_id}/signup")
async def unsignup_event(
    event_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    await db.events.update_one({"event_id": event_id}, {"$pull": {"registered_user_ids": me.user_id}})
    return {"ok": True}


def build_pairings(participants: List[dict]) -> Dict[str, List[str]]:
    """Return {user_id: [opp_round1, opp_round2, opp_round3]} based on quiz overlap."""
    n = len(participants)
    pairings = {p["user_id"]: [None, None, None] for p in participants}
    for r in range(3):
        used = set()
        ordered = sorted(participants, key=lambda x: random.random())
        for p in ordered:
            if p["user_id"] in used:
                continue
            best, best_score = None, -1
            for q in ordered:
                if q["user_id"] == p["user_id"] or q["user_id"] in used:
                    continue
                if q["user_id"] in [pairings[p["user_id"]][i] for i in range(r) if pairings[p["user_id"]][i]]:
                    continue
                s = compatibility_score(p, q)
                if s > best_score:
                    best, best_score = q, s
            if best:
                pairings[p["user_id"]][r] = best["user_id"]
                pairings[best["user_id"]][r] = p["user_id"]
                used.add(p["user_id"]); used.add(best["user_id"])
    return pairings


@api.post("/events/{event_id}/start")
async def start_event(
    event_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if not me.is_admin:
        raise HTTPException(403, "Admin only")
    evt = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not evt:
        raise HTTPException(404, "Event not found")
    user_ids = evt["registered_user_ids"]
    if len(user_ids) < 2:
        raise HTTPException(400, "Need at least 2 sign-ups")
    users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0}).to_list(100)
    pairings = build_pairings(users)
    await db.events.update_one(
        {"event_id": event_id},
        {"$set": {
            "pairings": pairings, "status": "live",
            "current_round": 1,
            "round_started_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True, "pairings": pairings}


@api.post("/events/{event_id}/next_round")
async def next_round(
    event_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if not me.is_admin:
        raise HTTPException(403, "Admin only")
    evt = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not evt:
        raise HTTPException(404, "Event not found")
    cr = evt.get("current_round", 0)
    if cr >= 3:
        await db.events.update_one({"event_id": event_id}, {"$set": {"status": "ended"}})
        await _resolve_event_matches(event_id)
        return {"ok": True, "ended": True}
    await db.events.update_one(
        {"event_id": event_id},
        {"$set": {"current_round": cr + 1,
                  "round_started_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "current_round": cr + 1}


async def _resolve_event_matches(event_id: str):
    evt = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not evt:
        return
    seen = set()
    for r in range(3):
        for uid, opps in evt["pairings"].items():
            if r >= len(opps): continue
            opp = opps[r]
            if not opp: continue
            pair = tuple(sorted([uid, opp]))
            if pair in seen: continue
            seen.add(pair)
            d_a = evt["round_decisions"].get(f"{r}:{uid}:{opp}")
            d_b = evt["round_decisions"].get(f"{r}:{opp}:{uid}")
            if d_a == "yes" and d_b == "yes":
                existing = await db.matches.find_one(
                    {"$or": [{"user_a": uid, "user_b": opp}, {"user_a": opp, "user_b": uid}]},
                    {"_id": 0},
                )
                if not existing:
                    await db.matches.insert_one({
                        "match_id": f"match_{uuid.uuid4().hex[:12]}",
                        "user_a": uid, "user_b": opp,
                        "source": "event", "chat_open": True,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "last_message_at": None,
                    })


@api.post("/events/{event_id}/round_decision")
async def round_decision(
    event_id: str,
    body: RoundDecision,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if body.decision not in ("yes", "no"):
        raise HTTPException(400, "Bad decision")
    key = f"round_decisions.{body.round_idx}:{me.user_id}:{body.opponent_id}"
    await db.events.update_one({"event_id": event_id}, {"$set": {key: body.decision}})
    return {"ok": True}


@api.get("/events/{event_id}/state")
async def event_state(
    event_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    evt = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not evt:
        raise HTTPException(404, "Event not found")
    cr = evt.get("current_round", 0)
    pairings = evt.get("pairings") or {}
    opp_id = None
    if cr >= 1 and me.user_id in pairings:
        idx = cr - 1
        opps = pairings[me.user_id]
        if idx < len(opps):
            opp_id = opps[idx]
    opp = None
    if opp_id:
        u = await db.users.find_one({"user_id": opp_id}, {"_id": 0})
        if u:
            opp = {"user_id": u["user_id"], "name": u["name"],
                   "age": u.get("age"), "bio": u.get("bio"),
                   "photos": u.get("photos", []), "interests": u.get("interests", [])}
    icebreakers = [
        "Worst pick-up line you've ever heard?",
        "Most overrated thing in London?",
        "Sunday roast – yorkshire pudding or no?",
    ]
    ice = icebreakers[(cr - 1) % 3] if cr else None
    started = evt.get("round_started_at")
    return {
        "event_id": event_id, "status": evt["status"],
        "current_round": cr, "round_started_at": started,
        "round_seconds": 300, "icebreaker": ice,
        "opponent": opp, "registered": me.user_id in evt["registered_user_ids"],
        "is_admin": me.is_admin,
    }


# ---------------------------------------------------------------------------
# Live event WebSocket chat
# ---------------------------------------------------------------------------
class WSManager:
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, room: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(room, []).append(ws)

    def disconnect(self, room: str, ws: WebSocket):
        if room in self.rooms and ws in self.rooms[room]:
            self.rooms[room].remove(ws)

    async def broadcast(self, room: str, payload: dict):
        for ws in list(self.rooms.get(room, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                pass


ws_manager = WSManager()


@app.websocket("/api/ws/event/{event_id}")
async def ws_event(websocket: WebSocket, event_id: str, token: str = Query(...)):
    # WebSocket auth: pass Cognito JWT as `token` query param.
    try:
        claims = verify_cognito_jwt(token)
        sub = claims.get("sub")
        if not sub:
            raise ValueError("missing sub")
        user_id = f"user_{sub}"
    except Exception:
        await websocket.close(code=4401)
        return
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        await websocket.close(code=4401)
        return
    evt = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not evt:
        await websocket.close(code=4404); return
    cr = evt.get("current_round", 0)
    pairings = evt.get("pairings") or {}
    opps = pairings.get(user["user_id"], [])
    if cr < 1 or not opps or cr - 1 >= len(opps) or not opps[cr - 1]:
        room = f"{event_id}:lobby"
    else:
        opp = opps[cr - 1]
        pair = tuple(sorted([user["user_id"], opp]))
        room = f"{event_id}:{cr}:{pair[0]}:{pair[1]}"
    await ws_manager.connect(room, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            msg = {"from": user["user_id"], "from_name": user["name"],
                   "body": str(data.get("body", ""))[:500],
                   "ts": datetime.now(timezone.utc).isoformat()}
            await ws_manager.broadcast(room, msg)
    except WebSocketDisconnect:
        ws_manager.disconnect(room, websocket)


# ---------------------------------------------------------------------------
# 1:1 Chats, Date Organiser, Feedback Gate
# ---------------------------------------------------------------------------
async def _get_match(match_id: str, me_id: str) -> dict:
    m = await db.matches.find_one({"match_id": match_id}, {"_id": 0})
    if not m or me_id not in (m["user_a"], m["user_b"]):
        raise HTTPException(404, "Match not found")
    return m


@api.get("/chat/threads")
async def list_threads(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    matches = await db.matches.find(
        {"$or": [{"user_a": me.user_id}, {"user_b": me.user_id}]}, {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    out = []
    for m in matches:
        other_id = m["user_b"] if m["user_a"] == me.user_id else m["user_a"]
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0})
        if not other: continue
        last = await db.messages.find_one({"match_id": m["match_id"]}, {"_id": 0}, sort=[("created_at", -1)])
        out.append({
            "match_id": m["match_id"],
            "source": m.get("source"),
            "chat_open": m.get("chat_open", True),
            "other": {"user_id": other["user_id"], "name": other["name"],
                      "photos": other.get("photos", [])[:1]},
            "last_message": last,
        })
    return out


async def _gate_status(match_id: str) -> dict:
    plan = await db.date_plans.find_one({"match_id": match_id}, {"_id": 0})
    if not plan:
        return {"gated": False}
    planned_at = plan.get("planned_at")
    if isinstance(planned_at, str):
        planned_at = datetime.fromisoformat(planned_at)
    if planned_at.tzinfo is None:
        planned_at = planned_at.replace(tzinfo=timezone.utc)
    cutoff = planned_at + timedelta(hours=24)
    now = datetime.now(timezone.utc)
    if now < cutoff:
        return {"gated": False}
    fb = plan.get("feedback") or {}
    return {"gated": True, "feedback": fb, "plan": plan}


@api.get("/chat/threads/{match_id}/messages")
async def get_messages(
    match_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    m = await _get_match(match_id, me.user_id)
    msgs = await db.messages.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    other_id = m["user_b"] if m["user_a"] == me.user_id else m["user_a"]
    other = await db.users.find_one({"user_id": other_id}, {"_id": 0})
    return {
        "match": m,
        "other": {"user_id": other["user_id"], "name": other["name"],
                  "photos": other.get("photos", [])} if other else None,
        "messages": msgs,
        "gate": await _gate_status(match_id),
    }


@api.post("/chat/threads/{match_id}/messages")
async def send_message(
    match_id: str,
    body: MessageIn,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    m = await _get_match(match_id, me.user_id)
    if not m.get("chat_open", True):
        raise HTTPException(403, "Chat is closed")
    gate = await _gate_status(match_id)
    if gate.get("gated"):
        fb = gate.get("feedback", {})
        a = fb.get(m["user_a"]); b = fb.get(m["user_b"])
        if not (a and b and a.get("enjoyed") and a.get("want_continue")
                and b.get("enjoyed") and b.get("want_continue")):
            raise HTTPException(403, "Chat paused – please complete post-date feedback first")
    msg = {
        "id": uuid.uuid4().hex,
        "match_id": match_id, "sender_id": me.user_id,
        "body": body.body[:1000],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.messages.insert_one(msg)
    await db.matches.update_one({"match_id": match_id}, {"$set": {"last_message_at": msg["created_at"]}})
    msg.pop("_id", None)
    return msg


@api.post("/chat/threads/{match_id}/plan_date")
async def plan_date(
    match_id: str,
    body: DatePlanIn,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    m = await _get_match(match_id, me.user_id)
    plan = await db.date_plans.find_one({"match_id": match_id}, {"_id": 0})
    safety_token = (plan or {}).get("safety_token") or secrets.token_urlsafe(18)
    doc = {
        "match_id": match_id,
        "planned_at": body.planned_at.astimezone(timezone.utc).isoformat()
            if body.planned_at.tzinfo else body.planned_at.replace(tzinfo=timezone.utc).isoformat(),
        "venue_name": body.venue_name, "venue_address": body.venue_address,
        "lat": body.lat, "lng": body.lng,
        "planner_id": me.user_id,
        "safety_token": safety_token,
        "feedback": (plan or {}).get("feedback", {}),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.date_plans.update_one({"match_id": match_id}, {"$set": doc}, upsert=True)
    return {**doc, "safety_url": f"/safety/{safety_token}"}


@api.get("/chat/threads/{match_id}/plan")
async def get_plan(
    match_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    await _get_match(match_id, me.user_id)
    plan = await db.date_plans.find_one({"match_id": match_id}, {"_id": 0})
    return plan or {}


@api.post("/chat/threads/{match_id}/feedback")
async def submit_feedback(
    match_id: str,
    body: FeedbackIn,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    m = await _get_match(match_id, me.user_id)
    plan = await db.date_plans.find_one({"match_id": match_id}, {"_id": 0})
    if not plan:
        raise HTTPException(400, "No date planned")
    fb = plan.get("feedback") or {}
    fb[me.user_id] = {"enjoyed": body.enjoyed, "want_continue": body.want_continue,
                      "at": datetime.now(timezone.utc).isoformat()}
    await db.date_plans.update_one({"match_id": match_id}, {"$set": {"feedback": fb}})
    a = fb.get(m["user_a"]); b = fb.get(m["user_b"])
    chat_open = True
    if a and b:
        both_yes = a["enjoyed"] and a["want_continue"] and b["enjoyed"] and b["want_continue"]
        chat_open = both_yes
        await db.matches.update_one({"match_id": match_id}, {"$set": {"chat_open": chat_open}})
        if both_yes:
            # behaviour boost – count completed dates
            await db.users.update_one({"user_id": m["user_a"]}, {"$inc": {"dates_completed": 1}})
            await db.users.update_one({"user_id": m["user_b"]}, {"$inc": {"dates_completed": 1}})
    return {"feedback": fb, "chat_open": chat_open,
            "both_submitted": bool(a and b)}


@api.get("/safety/{token}")
async def safety_view(token: str):
    plan = await db.date_plans.find_one({"safety_token": token}, {"_id": 0})
    if not plan:
        raise HTTPException(404, "Not found")
    m = await db.matches.find_one({"match_id": plan["match_id"]}, {"_id": 0})
    other_id = m["user_b"] if m["user_a"] == plan["planner_id"] else m["user_a"]
    other = await db.users.find_one({"user_id": other_id}, {"_id": 0})
    me = await db.users.find_one({"user_id": plan["planner_id"]}, {"_id": 0})
    return {
        "planned_at": plan["planned_at"],
        "venue_name": plan["venue_name"], "venue_address": plan["venue_address"],
        "you": {"name": me["name"]} if me else None,
        "date_with": {"first_name": (other["name"] or "").split(" ")[0] if other else "",
                      "photo": (other.get("photos") or [None])[0] if other else None},
    }


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
@api.get("/admin/me")
async def admin_me(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    return {"is_admin": me.is_admin}


@api.post("/admin/events")
async def admin_create_event(
    body: EventCreate,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if not me.is_admin:
        raise HTTPException(403, "Admin only")
    doc = {
        "event_id": f"evt_{uuid.uuid4().hex[:10]}",
        "title": body.title,
        "starts_at": body.starts_at.astimezone(timezone.utc).isoformat()
            if body.starts_at.tzinfo else body.starts_at.replace(tzinfo=timezone.utc).isoformat(),
        "ends_at": body.ends_at.astimezone(timezone.utc).isoformat()
            if body.ends_at.tzinfo else body.ends_at.replace(tzinfo=timezone.utc).isoformat(),
        "capacity": body.capacity,
        "registered_user_ids": [], "status": "upcoming",
        "pairings": {}, "round_decisions": {}, "current_round": 0,
        "round_started_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return doc


# Quick stats for admin
@api.get("/admin/stats")
async def admin_stats(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if not me.is_admin:
        raise HTTPException(403, "Admin only")
    return {
        "users": await db.users.count_documents({}),
        "matches": await db.matches.count_documents({}),
        "events": await db.events.count_documents({}),
        "messages": await db.messages.count_documents({}),
    }


# ---------------------------------------------------------------------------
# Date Requests (sent with a like, 48h to respond)
# ---------------------------------------------------------------------------
async def _expire_date_requests():
    """Mark expired requests."""
    now = datetime.now(timezone.utc).isoformat()
    await db.date_requests.update_many(
        {"status": "pending", "expires_at": {"$lt": now}},
        {"$set": {"status": "expired"}},
    )


@api.get("/date_requests")
async def list_date_requests(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    await _expire_date_requests()
    incoming = await db.date_requests.find(
        {"to_user_id": me.user_id, "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    outgoing = await db.date_requests.find(
        {"from_user_id": me.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    async def hydrate(rows, who_field):
        out = []
        for r in rows:
            u = await db.users.find_one({"user_id": r[who_field]}, {"_id": 0})
            if not u:
                continue
            out.append({**r, "other": {"user_id": u["user_id"], "name": u["name"],
                                        "photos": u.get("photos", [])[:1],
                                        "age": u.get("age")}})
        return out

    return {
        "incoming": await hydrate(incoming, "from_user_id"),
        "outgoing": await hydrate(outgoing, "to_user_id"),
    }


@api.post("/date_requests/{request_id}/respond")
async def respond_date_request(
    request_id: str,
    body: DateRequestRespond,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    dr = await db.date_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not dr or dr["to_user_id"] != me.user_id:
        raise HTTPException(404, "Request not found")
    if dr["status"] != "pending":
        raise HTTPException(400, f"Already {dr['status']}")
    expires_at = dr["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await db.date_requests.update_one({"request_id": request_id}, {"$set": {"status": "expired"}})
        raise HTTPException(400, "Request expired")

    new_status = "accepted" if body.accept else "declined"
    match_id = None
    if body.accept:
        # mutual-like equivalent: log a like-back, create match if not exists
        await db.swipes.insert_one({
            "actor_id": me.user_id, "target_id": dr["from_user_id"],
            "action": "like",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        existing = await db.matches.find_one(
            {"$or": [{"user_a": me.user_id, "user_b": dr["from_user_id"]},
                     {"user_a": dr["from_user_id"], "user_b": me.user_id}]}, {"_id": 0},
        )
        if not existing:
            match_id = f"match_{uuid.uuid4().hex[:12]}"
            await db.matches.insert_one({
                "match_id": match_id,
                "user_a": dr["from_user_id"], "user_b": me.user_id,
                "source": "date_request", "chat_open": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_message_at": None,
            })
        else:
            match_id = existing["match_id"]
        # Auto-seed a system message in chat about the date request
        await db.messages.insert_one({
            "id": uuid.uuid4().hex,
            "match_id": match_id,
            "sender_id": dr["from_user_id"],
            "body": f"💌 {dr['activity'].replace('_',' ').title()} — {dr['timeframe'].replace('_',' ')}"
                    + (f" · {dr['message']}" if dr.get('message') else ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "system": True,
        })
    await db.date_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": new_status, "match_id": match_id,
                  "responded_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"status": new_status, "match_id": match_id}


# ---------------------------------------------------------------------------
# Reports & Blocks
# ---------------------------------------------------------------------------
@api.post("/reports")
async def create_report(
    body: ReportIn,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    await db.reports.insert_one({
        "report_id": f"rep_{uuid.uuid4().hex[:10]}",
        "reporter_id": me.user_id,
        "reported_user_id": body.reported_user_id,
        "match_id": body.match_id,
        "reason": body.reason[:120],
        "detail": (body.detail or "")[:1000],
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@api.post("/blocks")
async def block_user(
    body: BlockIn,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if body.user_id == me.user_id:
        raise HTTPException(400, "Can't block yourself")
    await db.users.update_one({"user_id": me.user_id}, {"$addToSet": {"blocked_user_ids": body.user_id}})
    # close any matches with that user
    await db.matches.update_many(
        {"$or": [{"user_a": me.user_id, "user_b": body.user_id},
                 {"user_a": body.user_id, "user_b": me.user_id}]},
        {"$set": {"chat_open": False}},
    )
    return {"ok": True}


@api.delete("/blocks/{user_id}")
async def unblock_user(
    user_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    await db.users.update_one({"user_id": me.user_id}, {"$pull": {"blocked_user_ids": user_id}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Admin – expanded
# ---------------------------------------------------------------------------
@api.get("/admin/users")
async def admin_list_users(
    request: Request,
    q: Optional[str] = None,
    limit: int = 50,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if not me.is_admin:
        raise HTTPException(403, "Admin only")
    flt = {}
    if q:
        flt = {"$or": [
            {"email": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
            {"user_id": q},
        ]}
    rows = await db.users.find(flt, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 200))
    return rows


@api.post("/admin/users/{user_id}/ban")
async def admin_ban_user(
    user_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if not me.is_admin:
        raise HTTPException(403, "Admin only")
    await db.users.update_one({"user_id": user_id}, {"$set": {"is_banned": True}})
    await db.sessions.delete_many({"user_id": user_id})
    return {"ok": True}


@api.post("/admin/users/{user_id}/unban")
async def admin_unban_user(
    user_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if not me.is_admin:
        raise HTTPException(403, "Admin only")
    await db.users.update_one({"user_id": user_id}, {"$set": {"is_banned": False}})
    return {"ok": True}


@api.get("/admin/messages")
async def admin_list_messages(
    request: Request,
    limit: int = 100,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if not me.is_admin:
        raise HTTPException(403, "Admin only")
    rows = await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 500))
    # Hydrate sender name
    out = []
    for m in rows:
        u = await db.users.find_one({"user_id": m["sender_id"]}, {"_id": 0})
        out.append({**m, "sender_name": u["name"] if u else "?"})
    return out


@api.get("/admin/reports")
async def admin_list_reports(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if not me.is_admin:
        raise HTTPException(403, "Admin only")
    rows = await db.reports.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    out = []
    for r in rows:
        rpt = await db.users.find_one({"user_id": r["reporter_id"]}, {"_id": 0})
        rpd = await db.users.find_one({"user_id": r["reported_user_id"]}, {"_id": 0})
        out.append({**r,
                    "reporter": {"name": rpt["name"], "email": rpt["email"]} if rpt else None,
                    "reported": {"name": rpd["name"], "email": rpd["email"], "is_banned": rpd.get("is_banned", False)} if rpd else None})
    return out


@api.post("/admin/reports/{report_id}/resolve")
async def admin_resolve_report(
    report_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if not me.is_admin:
        raise HTTPException(403, "Admin only")
    await db.reports.update_one({"report_id": report_id}, {"$set": {"status": "resolved",
                                  "resolved_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}


@api.get("/admin/events_all")
async def admin_list_events(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    if not me.is_admin:
        raise HTTPException(403, "Admin only")
    return await db.events.find({}, {"_id": 0}).sort("starts_at", 1).to_list(200)


# Profile prompt suggestions (shared list for onboarding/profile)
@api.get("/profile_prompts")
async def get_profile_prompts():
    return [
        "Give me a reason to delete this app",
        "I'm happiest when",
        "My most controversial opinion",
        "Two truths and a lie",
        "The way to win me over is",
        "I'll fall for you if",
        "Best Sunday roast in London is",
        "My toxic trait",
        "Don't hate me if I",
        "A shower thought I recently had",
        "My simple pleasures",
        "Dating me is like",
        "I geek out on",
        "Together, we could",
    ]


# ---------------------------------------------------------------------------
# Snog AI – LLM-powered icebreakers + match insights
# ---------------------------------------------------------------------------
import json as _json

BEDROCK_REGION = os.environ.get("BEDROCK_REGION") or AWS_REGION
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID") or "anthropic.claude-3-5-sonnet-20240620-v1:0"
ENABLE_SNOG_AI = os.environ.get("ENABLE_SNOG_AI", "false").lower() in ("1", "true", "yes", "on")


def _bedrock_client():
    return boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)


def _profile_card_for_ai(u: dict) -> dict:
    return {
        "name": u.get("name"),
        "age": u.get("age"),
        "pronouns": u.get("pronouns"),
        "bio": u.get("bio"),
        "job": u.get("job"),
        "interests": (u.get("interests") or [])[:6],
        "prompts": [p for p in (u.get("prompts") or []) if p.get("q") and p.get("a")][:3],
        "drinks": u.get("drinks"), "smokes": u.get("smokes"), "workout": u.get("workout"),
        "wants_kids": u.get("wants_kids"), "zodiac": u.get("zodiac"),
    }


async def _snog_ai_call(system: str, prompt: str, session_key: str) -> str:
    if not ENABLE_SNOG_AI:
        raise HTTPException(503, "Snog AI is disabled.")

    # Bedrock Runtime is blocking; run in a thread.
    def _invoke() -> str:
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 500,
            "temperature": 0.7,
            "system": system,
            "messages": [
                {"role": "user", "content": [{"type": "text", "text": prompt}]}
            ],
        }
        resp = _bedrock_client().invoke_model(
            modelId=BEDROCK_MODEL_ID,
            body=_json.dumps(body),
            contentType="application/json",
            accept="application/json",
        )
        raw = resp["body"].read()
        data = _json.loads(raw)
        # Anthropic format: {"content":[{"type":"text","text":"..."}], ...}
        parts = data.get("content") or []
        text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
        return text or ""

    try:
        return await asyncio.to_thread(_invoke)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bedrock invoke failed: {e}")
        raise HTTPException(502, "Snog AI is being shy right now.")


def _strip_to_json(text: str) -> dict:
    """Extract JSON from an LLM reply that may include markdown fences."""
    if not text:
        return {}
    s = text.strip()
    if s.startswith("```"):
        s = s.split("```", 2)[1]
        if s.startswith("json"):
            s = s[4:]
        s = s.strip().rstrip("```").strip()
    start = s.find("{"); end = s.rfind("}")
    if start >= 0 and end > start:
        s = s[start:end+1]
    try:
        return _json.loads(s)
    except Exception:
        return {}


@api.post("/snog_ai/icebreaker/{match_id}")
async def snog_ai_icebreaker(
    match_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    me = await get_current_user(request, session_token, authorization)
    m = await db.matches.find_one({"match_id": match_id}, {"_id": 0})
    if not m or me.user_id not in (m["user_a"], m["user_b"]):
        raise HTTPException(404, "Match not found")
    other_id = m["user_b"] if m["user_a"] == me.user_id else m["user_a"]
    other = await db.users.find_one({"user_id": other_id}, {"_id": 0})
    me_doc = await db.users.find_one({"user_id": me.user_id}, {"_id": 0})
    if not other:
        raise HTTPException(404, "Other user gone")

    sys_msg = (
        "You are 'Snog AI' — a witty British wingman/woman for the Let's Snog dating app. "
        "Tone: cheeky, modern London, playful but never crude or creepy. "
        "Reply with VALID JSON ONLY in the shape {\"icebreakers\":[\"...\",\"...\",\"...\"]}. "
        "Each icebreaker is one short message (under 140 chars), addressed FROM the user TO their match. "
        "Reference at least one specific detail from the match's prompts/interests/bio. "
        "No emojis except at most one tasteful one. Avoid 'hey' and 'sup'."
    )
    payload = {"me": _profile_card_for_ai(me_doc), "match": _profile_card_for_ai(other)}
    prompt = f"Profiles:\n{_json.dumps(payload)}\n\nWrite 3 icebreakers."
    try:
        text = await _snog_ai_call(sys_msg, prompt, session_key=f"ice:{match_id}:{me.user_id}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Snog AI icebreaker error: {e}")
        raise HTTPException(502, "Snog AI is being shy right now.")
    data = _strip_to_json(text)
    lines = data.get("icebreakers") or []
    if not lines or not isinstance(lines, list):
        lines = [text.strip()] if text else []
    lines = [str(x).strip().strip('"') for x in lines if str(x).strip()][:3]
    return {"icebreakers": lines}


@api.get("/snog_ai/insights")
async def snog_ai_insights(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Generate cached AI insights for today's daily set: one cheeky 'why' + vibe label per candidate."""
    me = await get_current_user(request, session_token, authorization)
    today = london_today_str()
    set_doc = await db.daily_sets.find_one({"user_id": me.user_id, "date": today}, {"_id": 0})
    if not set_doc:
        return {"insights": {}}
    cached = await db.snog_ai_insights.find_one(
        {"user_id": me.user_id, "date": today}, {"_id": 0}
    ) or {"map": {}}
    cmap = cached.get("map", {})
    me_doc = await db.users.find_one({"user_id": me.user_id}, {"_id": 0})

    needed = [uid for uid in set_doc["candidate_user_ids"] if uid not in cmap]
    if needed and ENABLE_SNOG_AI:
        # Single batched call to keep cost down
        others = await db.users.find({"user_id": {"$in": needed}}, {"_id": 0}).to_list(50)
        sys_msg = (
            "You are 'Snog AI' — a cheeky British matchmaker for Let's Snog. "
            "Reply with VALID JSON ONLY: {\"items\":[{\"user_id\":\"...\",\"why\":\"...\",\"vibe\":\"...\"}, ...]}. "
            "'why' is a one-sentence reason this person could be a brilliant snog (under 22 words, "
            "second-person addressed to the user, reference one specific overlap with their profile). "
            "'vibe' is a 1-3 word vibe label (e.g. 'pub-quiz energy', 'arty calm', 'chaos good')."
        )
        payload = {
            "me": _profile_card_for_ai(me_doc),
            "candidates": [{"user_id": u["user_id"], **_profile_card_for_ai(u)} for u in others],
        }
        try:
            text = await _snog_ai_call(sys_msg, _json.dumps(payload),
                                       session_key=f"ins:{me.user_id}:{today}")
            data = _strip_to_json(text)
            for it in (data.get("items") or []):
                uid = it.get("user_id")
                if uid in needed:
                    cmap[uid] = {"why": str(it.get("why",""))[:200],
                                 "vibe": str(it.get("vibe",""))[:40]}
        except Exception as e:
            logger.warning(f"Snog AI insights call failed: {e}")
        await db.snog_ai_insights.update_one(
            {"user_id": me.user_id, "date": today},
            {"$set": {"user_id": me.user_id, "date": today, "map": cmap,
                      "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    return {"insights": cmap}


# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "Let's Snog", "status": "ok"}


@api.get("/london/venues")
async def london_venues():
    """Curated London venues for date planning."""
    return [
        {"name": "Gordon's Wine Bar", "address": "47 Villiers St, WC2N 6NE", "lat": 51.508, "lng": -0.124},
        {"name": "Frank's Cafe (Peckham)", "address": "95A Rye Ln, SE15 4ST", "lat": 51.470, "lng": -0.069},
        {"name": "The Garrison (Bermondsey)", "address": "99-101 Bermondsey St, SE1 3XB", "lat": 51.499, "lng": -0.082},
        {"name": "Sky Garden", "address": "20 Fenchurch St, EC3M 8AF", "lat": 51.511, "lng": -0.084},
        {"name": "Gloria (Shoreditch)", "address": "54-56 Great Eastern St, EC2A 3QR", "lat": 51.526, "lng": -0.080},
        {"name": "Dishoom Covent Garden", "address": "12 Upper St Martin's Ln, WC2H 9FB", "lat": 51.512, "lng": -0.127},
        {"name": "The Mayflower (Rotherhithe)", "address": "117 Rotherhithe St, SE16 4NF", "lat": 51.501, "lng": -0.052},
        {"name": "Kew Gardens", "address": "Richmond, TW9 3AE", "lat": 51.478, "lng": -0.295},
    ]


# ---------------------------------------------------------------------------
# Wire up
# ---------------------------------------------------------------------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.matches.create_index("match_id", unique=True)
    await db.events.create_index("event_id", unique=True)
    await seed_default_events()
    logger.info("Let's Snog backend ready")


@app.on_event("shutdown")
async def shutdown():
    client.close()
