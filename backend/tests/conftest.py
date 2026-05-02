import os
import requests
import pytest
import uuid
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if 'REACT_APP_BACKEND_URL' in os.environ else None
if not BASE_URL:
    # read from frontend .env
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip()
                break

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _create_user(db, suffix="a", is_admin=False, photos=None, quiz=None, age=29):
    uid = f"TEST_user_{suffix}_{uuid.uuid4().hex[:6]}"
    email = f"TEST_{suffix}_{uuid.uuid4().hex[:6]}@test.local"
    db.users.insert_one({
        "user_id": uid,
        "email": email,
        "name": f"TestUser{suffix.upper()}",
        "picture": None,
        "age": age,
        "gender": "everyone",
        "looking_for": "everyone",
        "bio": f"Test bio {suffix}",
        "height_cm": 175,
        "job": "Tester",
        "interests": ["coffee"],
        "photos": photos or ["letssnog/test/p.jpg"],
        "quiz": quiz or ["A","B","C","D","A","B","C","D"],
        "location": "London",
        "age_min": 21, "age_max": 45,
        "dates_completed": 0, "premium": False,
        "is_admin": is_admin,
        "is_banned": False,
        "is_restricted": False,
        "blocked_user_ids": [],
        "onboarding_complete": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    token = f"TESTTOK_{uuid.uuid4().hex}"
    db.sessions.insert_one({
        "session_token": token,
        "user_id": uid,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return uid, token, email


@pytest.fixture(scope="session")
def user_a(db):
    uid, tok, email = _create_user(db, suffix="A", is_admin=True,
                                    quiz=["A","A","A","A","A","A","A","A"])
    yield {"user_id": uid, "token": tok, "email": email}


@pytest.fixture(scope="session")
def user_b(db):
    uid, tok, email = _create_user(db, suffix="B",
                                    quiz=["A","A","A","A","A","A","A","A"])
    yield {"user_id": uid, "token": tok, "email": email}


@pytest.fixture
def auth_headers_a(user_a):
    return {"Authorization": f"Bearer {user_a['token']}", "Content-Type": "application/json"}


@pytest.fixture
def auth_headers_b(user_b):
    return {"Authorization": f"Bearer {user_b['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="session", autouse=True)
def cleanup(db):
    yield
    # Cleanup test data
    test_users = list(db.users.find({"user_id": {"$regex": "^TEST_"}}, {"user_id": 1}))
    uids = [u["user_id"] for u in test_users]
    db.users.delete_many({"user_id": {"$in": uids}})
    db.sessions.delete_many({"session_token": {"$regex": "^TESTTOK_"}})
    db.matches.delete_many({"$or": [{"user_a": {"$in": uids}}, {"user_b": {"$in": uids}}]})
    db.swipes.delete_many({"$or": [{"actor_id": {"$in": uids}}, {"target_id": {"$in": uids}}]})
    db.daily_sets.delete_many({"user_id": {"$in": uids}})
    db.messages.delete_many({"sender_id": {"$in": uids}})
    db.date_plans.delete_many({"planner_id": {"$in": uids}})
    db.events.delete_many({"title": {"$regex": "^TEST_"}})
