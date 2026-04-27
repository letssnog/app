"""Iteration-2 backend tests for Let's Snog."""
import os
import uuid
import requests
import pytest
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip(); break
BASE_URL = BASE_URL.rstrip('/')

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

mc = MongoClient(MONGO_URL)
db = mc[DB_NAME]


def _seed_user(suffix="x", is_admin=False, banned=False, photos=None):
    uid = f"TEST_iter2_{suffix}_{uuid.uuid4().hex[:6]}"
    email = f"TEST_iter2_{suffix}_{uuid.uuid4().hex[:6]}@t.local"
    db.users.insert_one({
        "user_id": uid, "email": email, "name": f"User{suffix.upper()}",
        "age": 30, "bio": "bio", "photos": photos or ["letssnog/test/p1.jpg", "letssnog/test/p2.jpg"],
        "quiz": ["A"]*8, "interests": [], "location": "London",
        "age_min": 21, "age_max": 45, "looking_for": "everyone",
        "dates_completed": 0, "premium": False,
        "is_admin": is_admin, "is_banned": banned,
        "blocked_user_ids": [], "prompts": [],
        "onboarding_complete": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    tok = f"TESTTOK_iter2_{uuid.uuid4().hex}"
    db.sessions.insert_one({
        "session_token": tok, "user_id": uid,
        "expires_at": (datetime.now(timezone.utc)+timedelta(days=1)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return uid, tok, email


@pytest.fixture(scope="module")
def admin_user():
    uid, tok, email = _seed_user("admin", is_admin=True)
    yield {"user_id": uid, "token": tok, "email": email}


@pytest.fixture(scope="module")
def user_a():
    uid, tok, email = _seed_user("A")
    yield {"user_id": uid, "token": tok, "email": email}


@pytest.fixture(scope="module")
def user_b():
    uid, tok, email = _seed_user("B")
    yield {"user_id": uid, "token": tok, "email": email}


@pytest.fixture(scope="module")
def banned_user():
    uid, tok, email = _seed_user("banned", banned=True)
    yield {"user_id": uid, "token": tok, "email": email}


def H(tok): return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module", autouse=True)
def cleanup_after():
    yield
    test_uids = [u["user_id"] for u in db.users.find({"user_id": {"$regex": "^TEST_iter2_"}}, {"user_id":1})]
    db.users.delete_many({"user_id": {"$in": test_uids}})
    db.sessions.delete_many({"session_token": {"$regex": "^TESTTOK_iter2_"}})
    db.matches.delete_many({"$or":[{"user_a":{"$in":test_uids}},{"user_b":{"$in":test_uids}}]})
    db.swipes.delete_many({"$or":[{"actor_id":{"$in":test_uids}},{"target_id":{"$in":test_uids}}]})
    db.date_requests.delete_many({"$or":[{"from_user_id":{"$in":test_uids}},{"to_user_id":{"$in":test_uids}}]})
    db.reports.delete_many({"$or":[{"reporter_id":{"$in":test_uids}},{"reported_user_id":{"$in":test_uids}}]})
    db.messages.delete_many({"sender_id":{"$in":test_uids}})


# ---------- Profile prompts ----------
class TestPrompts:
    def test_profile_prompts(self):
        r = requests.get(f"{BASE_URL}/api/profile_prompts")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 14, f"Expected 14, got {len(data)}"
        assert all(isinstance(x, str) for x in data)


# ---------- Profile expanded fields ----------
class TestProfileFields:
    def test_put_users_me_new_fields(self, user_a):
        payload = {
            "pronouns": "she/her", "smokes": "never", "drinks": "sometimes",
            "workout": "often", "has_kids": "no", "wants_kids": "maybe",
            "religion": "spiritual", "zodiac": "aries", "education": "MSc",
            "prompts": [{"q":"My toxic trait","a":"snacks"},{"q":"Dating me is like","a":"a meme"}]
        }
        r = requests.put(f"{BASE_URL}/api/users/me", headers=H(user_a["token"]), json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        for k, v in payload.items():
            assert body.get(k) == v, f"{k} mismatch: {body.get(k)} vs {v}"
        # Verify persistence
        doc = db.users.find_one({"user_id": user_a["user_id"]})
        assert doc["pronouns"] == "she/her"
        assert doc["zodiac"] == "aries"
        assert len(doc["prompts"]) == 2


# ---------- Photos reorder ----------
class TestPhotoReorder:
    def test_reorder(self, user_a):
        # set known photos first
        db.users.update_one({"user_id": user_a["user_id"]},
                            {"$set": {"photos": ["letssnog/test/p1.jpg","letssnog/test/p2.jpg","letssnog/test/p3.jpg"]}})
        r = requests.post(f"{BASE_URL}/api/users/me/photos/reorder",
                          headers=H(user_a["token"]),
                          json={"paths": ["letssnog/test/p3.jpg","letssnog/test/p1.jpg","letssnog/test/p2.jpg"]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["photos"][0] == "letssnog/test/p3.jpg"
        doc = db.users.find_one({"user_id": user_a["user_id"]})
        assert doc["photos"][0] == "letssnog/test/p3.jpg"


# ---------- GET /api/users/{user_id} privacy + 404 banned ----------
class TestUserDetail:
    def test_safe_public_profile(self, user_a, user_b):
        r = requests.get(f"{BASE_URL}/api/users/{user_b['user_id']}", headers=H(user_a["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        # safe fields present
        assert body["user_id"] == user_b["user_id"]
        assert "name" in body
        # private fields absent
        for k in ("email","quiz","blocked_user_ids","is_admin","is_banned","age_min","age_max","premium"):
            assert k not in body, f"private field leaked: {k}"

    def test_banned_returns_404(self, user_a, banned_user):
        r = requests.get(f"{BASE_URL}/api/users/{banned_user['user_id']}", headers=H(user_a["token"]))
        assert r.status_code == 404


# ---------- Swipe with date_request ----------
class TestSwipeDateRequest:
    def test_swipe_with_date_request_creates_dr(self, user_a, user_b):
        # ensure clean slate of swipes/matches
        db.swipes.delete_many({"$or":[{"actor_id":user_a["user_id"]},{"actor_id":user_b["user_id"]}]})
        db.matches.delete_many({"$or":[{"user_a":user_a["user_id"]},{"user_b":user_a["user_id"]}]})
        db.date_requests.delete_many({"$or":[{"from_user_id":user_a["user_id"]},{"to_user_id":user_a["user_id"]}]})
        payload = {
            "target_id": user_b["user_id"], "action": "super",
            "date_request": {"activity":"drinks","timeframe":"this_weekend","message":"Up for a pint?"}
        }
        r = requests.post(f"{BASE_URL}/api/matches/swipe", headers=H(user_a["token"]), json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("date_request_id"), f"No date_request_id in {body}"
        # Verify in DB with 48h expiry
        dr = db.date_requests.find_one({"request_id": body["date_request_id"]})
        assert dr is not None
        assert dr["activity"] == "drinks"
        assert dr["status"] == "pending"
        exp = dr["expires_at"]
        if isinstance(exp, str): exp = datetime.fromisoformat(exp)
        delta = exp - datetime.now(timezone.utc)
        assert 47 <= delta.total_seconds()/3600 <= 49


# ---------- GET /api/date_requests ----------
class TestDateRequestsList:
    def test_list_hydrated(self, user_a, user_b):
        r = requests.get(f"{BASE_URL}/api/date_requests", headers=H(user_b["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "incoming" in body and "outgoing" in body
        # B should have an incoming from A
        assert any(x["from_user_id"] == user_a["user_id"] and x.get("other",{}).get("name")
                   for x in body["incoming"]), body


# ---------- Respond to date request ----------
class TestRespond:
    def test_accept_creates_match_and_system_message(self, user_a, user_b):
        # Find pending request from A to B
        dr = db.date_requests.find_one({"from_user_id": user_a["user_id"],
                                         "to_user_id": user_b["user_id"], "status":"pending"})
        assert dr, "no pending DR"
        r = requests.post(f"{BASE_URL}/api/date_requests/{dr['request_id']}/respond",
                          headers=H(user_b["token"]), json={"accept": True})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "accepted"
        assert body.get("match_id")
        # match exists
        m = db.matches.find_one({"match_id": body["match_id"]})
        assert m
        # system message exists
        msg = db.messages.find_one({"match_id": body["match_id"]})
        assert msg

    def test_already_responded_400(self, user_a, user_b):
        dr = db.date_requests.find_one({"from_user_id": user_a["user_id"],
                                         "to_user_id": user_b["user_id"], "status":"accepted"})
        assert dr
        r = requests.post(f"{BASE_URL}/api/date_requests/{dr['request_id']}/respond",
                          headers=H(user_b["token"]), json={"accept": False})
        assert r.status_code == 400

    def test_expired_returns_400(self, admin_user, user_a):
        # seed an expired pending DR
        rid = f"dr_exp_{uuid.uuid4().hex[:8]}"
        db.date_requests.insert_one({
            "request_id": rid,
            "from_user_id": admin_user["user_id"],
            "to_user_id": user_a["user_id"],
            "activity":"coffee","timeframe":"flexible","message":"",
            "status":"pending","match_id":None,
            "expires_at":(datetime.now(timezone.utc)-timedelta(hours=1)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        r = requests.post(f"{BASE_URL}/api/date_requests/{rid}/respond",
                          headers=H(user_a["token"]), json={"accept": True})
        assert r.status_code == 400


# ---------- Reports ----------
class TestReports:
    def test_create_and_admin_list_resolve(self, user_a, user_b, admin_user):
        r = requests.post(f"{BASE_URL}/api/reports", headers=H(user_a["token"]),
                          json={"reported_user_id": user_b["user_id"], "reason":"spam","detail":"xyz"})
        assert r.status_code == 200
        # admin list
        r = requests.get(f"{BASE_URL}/api/admin/reports", headers=H(admin_user["token"]))
        assert r.status_code == 200
        rows = r.json()
        ours = [x for x in rows if x["reporter_id"]==user_a["user_id"] and x["reported_user_id"]==user_b["user_id"]]
        assert ours
        rep = ours[0]
        assert rep["reporter"]["name"] and rep["reported"]["name"]
        # resolve
        r = requests.post(f"{BASE_URL}/api/admin/reports/{rep['report_id']}/resolve",
                          headers=H(admin_user["token"]))
        assert r.status_code == 200
        doc = db.reports.find_one({"report_id": rep["report_id"]})
        assert doc["status"] == "resolved"

    def test_admin_reports_403_for_non_admin(self, user_a):
        r = requests.get(f"{BASE_URL}/api/admin/reports", headers=H(user_a["token"]))
        assert r.status_code == 403


# ---------- Blocks ----------
class TestBlocks:
    def test_block_closes_match_and_unblock(self, user_a, user_b):
        # Should already have a match from the accept test
        m = db.matches.find_one({"$or":[
            {"user_a":user_a["user_id"],"user_b":user_b["user_id"]},
            {"user_a":user_b["user_id"],"user_b":user_a["user_id"]}]})
        assert m
        r = requests.post(f"{BASE_URL}/api/blocks", headers=H(user_a["token"]),
                          json={"user_id": user_b["user_id"]})
        assert r.status_code == 200
        m2 = db.matches.find_one({"match_id": m["match_id"]})
        assert m2["chat_open"] is False
        doc = db.users.find_one({"user_id": user_a["user_id"]})
        assert user_b["user_id"] in doc["blocked_user_ids"]
        # unblock
        r = requests.delete(f"{BASE_URL}/api/blocks/{user_b['user_id']}", headers=H(user_a["token"]))
        assert r.status_code == 200
        doc = db.users.find_one({"user_id": user_a["user_id"]})
        assert user_b["user_id"] not in doc["blocked_user_ids"]


# ---------- Admin users (search + ban/unban) ----------
class TestAdminUsers:
    def test_search(self, admin_user, user_a):
        r = requests.get(f"{BASE_URL}/api/admin/users?q={user_a['email']}",
                         headers=H(admin_user["token"]))
        assert r.status_code == 200
        rows = r.json()
        assert any(x["user_id"]==user_a["user_id"] for x in rows)

    def test_search_by_user_id(self, admin_user, user_a):
        r = requests.get(f"{BASE_URL}/api/admin/users?q={user_a['user_id']}",
                         headers=H(admin_user["token"]))
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 1

    def test_ban_unban_flow(self, admin_user, user_b):
        # Add a fresh session for user_b to verify deletion
        extra_tok = f"TESTTOK_iter2_extra_{uuid.uuid4().hex}"
        db.sessions.insert_one({"session_token":extra_tok,"user_id":user_b["user_id"],
                                "expires_at":(datetime.now(timezone.utc)+timedelta(days=1)).isoformat(),
                                "created_at": datetime.now(timezone.utc).isoformat()})
        r = requests.post(f"{BASE_URL}/api/admin/users/{user_b['user_id']}/ban",
                          headers=H(admin_user["token"]))
        assert r.status_code == 200
        d = db.users.find_one({"user_id": user_b["user_id"]})
        assert d["is_banned"] is True
        s = db.sessions.find_one({"session_token": extra_tok})
        assert s is None, "ban should delete sessions"
        # unban
        r = requests.post(f"{BASE_URL}/api/admin/users/{user_b['user_id']}/unban",
                          headers=H(admin_user["token"]))
        assert r.status_code == 200
        d = db.users.find_one({"user_id": user_b["user_id"]})
        assert d["is_banned"] is False

    def test_admin_users_403_for_non_admin(self, user_a):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=H(user_a["token"]))
        assert r.status_code == 403


# ---------- Admin messages + events_all ----------
class TestAdminMisc:
    def test_admin_messages_hydrated(self, admin_user):
        r = requests.get(f"{BASE_URL}/api/admin/messages", headers=H(admin_user["token"]))
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            assert "sender_name" in rows[0]

    def test_admin_messages_403(self, user_a):
        r = requests.get(f"{BASE_URL}/api/admin/messages", headers=H(user_a["token"]))
        assert r.status_code == 403

    def test_admin_events_all(self, admin_user):
        r = requests.get(f"{BASE_URL}/api/admin/events_all", headers=H(admin_user["token"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_events_all_403(self, user_a):
        r = requests.get(f"{BASE_URL}/api/admin/events_all", headers=H(user_a["token"]))
        assert r.status_code == 403


# ---------- Daily matches: blocks excluded both ways ----------
class TestBlocksExcludeDaily:
    def test_blocked_excluded(self, user_a, user_b):
        # Reset daily set + swipes, set blocking from B->A
        db.users.update_one({"user_id": user_b["user_id"]},
                            {"$addToSet": {"blocked_user_ids": user_a["user_id"]}})
        db.daily_sets.delete_many({"user_id": user_a["user_id"]})
        db.swipes.delete_many({"actor_id": user_a["user_id"]})
        r = requests.get(f"{BASE_URL}/api/matches/daily", headers=H(user_a["token"]))
        assert r.status_code == 200
        body = r.json()
        ids = [p["user_id"] for p in body["profiles"]]
        assert user_b["user_id"] not in ids, "blocker (B blocked A) leaked into A's pool"
        # cleanup
        db.users.update_one({"user_id": user_b["user_id"]},
                            {"$pull": {"blocked_user_ids": user_a["user_id"]}})
