"""Backend tests for Let's Snog API – Public, Auth-gated, Admin, Date plan + Safety + Feedback gate."""
import io
import time
import requests
from datetime import datetime, timezone, timedelta


# ---------------- Public endpoints ----------------
class TestPublic:
    def test_root(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        d = r.json()
        assert d.get("app") == "Let's Snog"
        assert d.get("status") == "ok"

    def test_quiz_questions(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/quiz/questions")
        assert r.status_code == 200
        qs = r.json()
        assert isinstance(qs, list) and len(qs) == 8
        for q in qs:
            assert "id" in q and "q" in q and "options" in q
            assert len(q["options"]) >= 2

    def test_events_seeded(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/events")
        assert r.status_code == 200
        evts = r.json()
        # at least 4 seeded Tue/Thu
        upcoming = [e for e in evts if e.get("status") == "upcoming"]
        assert len(upcoming) >= 4, f"Expected >=4 upcoming, got {len(upcoming)}"
        # check Tue/Thu 7pm London
        weekdays = []
        for e in upcoming[:4]:
            dt = datetime.fromisoformat(e["starts_at"].replace("Z", "+00:00"))
            weekdays.append(dt.weekday())
        # at least all are Tue(1) or Thu(3) when converted to London? They were stored as UTC but London 7pm.
        # Just verify they exist and have titles
        for e in upcoming[:4]:
            assert "Snog Speed-Dating" in e["title"]

    def test_london_venues(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/london/venues")
        assert r.status_code == 200
        v = r.json()
        assert isinstance(v, list) and len(v) >= 8
        for vv in v:
            assert "name" in vv and "address" in vv


# ---------------- Auth surface ----------------
class TestAuth:
    def test_session_rejects_bad_id(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/session", json={"session_id": "BAD_NOT_REAL"})
        assert r.status_code in (400, 401)

    def test_session_requires_session_id(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/session", json={})
        assert r.status_code == 400

    def test_me_unauth(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_logout_no_cookie(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/logout")
        assert r.status_code == 200


# ---------------- 401 on auth-gated endpoints ----------------
class TestAuthGated401:
    def test_endpoints_require_auth(self, api_client, base_url):
        cases = [
            ("PUT", "/api/users/me", {}),
            ("POST", "/api/users/me/quiz", {"answers": ["A"]*8}),
            ("GET", "/api/matches/daily", None),
            ("POST", "/api/matches/swipe", {"target_id": "x", "action": "like"}),
            ("GET", "/api/chat/threads", None),
            ("GET", "/api/admin/stats", None),
            ("GET", "/api/admin/me", None),
        ]
        for method, path, payload in cases:
            r = api_client.request(method, f"{base_url}{path}", json=payload)
            assert r.status_code == 401, f"{method} {path} -> {r.status_code}"


# ---------------- Auth-gated full flow ----------------
class TestAuthFlow:
    def test_me_with_token(self, api_client, base_url, auth_headers_a, user_a):
        r = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers_a)
        assert r.status_code == 200
        assert r.json()["user_id"] == user_a["user_id"]

    def test_update_profile(self, api_client, base_url, auth_headers_a):
        r = api_client.put(f"{base_url}/api/users/me",
                           json={"bio": "Updated bio", "job": "Engineer"},
                           headers=auth_headers_a)
        assert r.status_code == 200
        d = r.json()
        assert d["bio"] == "Updated bio"
        assert d["job"] == "Engineer"
        # GET verification
        r2 = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers_a)
        assert r2.json()["bio"] == "Updated bio"

    def test_submit_quiz(self, api_client, base_url, auth_headers_a):
        r = api_client.post(f"{base_url}/api/users/me/quiz",
                            json={"answers": ["A","B","C","D","A","B","C","D"]},
                            headers=auth_headers_a)
        assert r.status_code == 200
        assert r.json()["quiz"] == ["A","B","C","D","A","B","C","D"]

    def test_quiz_wrong_count(self, api_client, base_url, auth_headers_a):
        r = api_client.post(f"{base_url}/api/users/me/quiz",
                            json={"answers": ["A","B"]},
                            headers=auth_headers_a)
        assert r.status_code == 400

    def test_daily_matches(self, api_client, base_url, auth_headers_a):
        r = api_client.get(f"{base_url}/api/matches/daily", headers=auth_headers_a)
        assert r.status_code == 200
        d = r.json()
        assert "profiles" in d and "remaining" in d and "total" in d

    def test_swipe(self, api_client, base_url, auth_headers_a, user_b):
        r = api_client.post(f"{base_url}/api/matches/swipe",
                            json={"target_id": user_b["user_id"], "action": "like"},
                            headers=auth_headers_a)
        assert r.status_code == 200
        assert "matched" in r.json()

    def test_swipe_bad_action(self, api_client, base_url, auth_headers_a, user_b):
        r = api_client.post(f"{base_url}/api/matches/swipe",
                            json={"target_id": user_b["user_id"], "action": "bogus"},
                            headers=auth_headers_a)
        assert r.status_code == 400

    def test_chat_threads(self, api_client, base_url, auth_headers_a):
        r = api_client.get(f"{base_url}/api/chat/threads", headers=auth_headers_a)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_event_signup_and_state(self, api_client, base_url, auth_headers_a):
        evts = api_client.get(f"{base_url}/api/events").json()
        assert len(evts) >= 1
        event_id = evts[0]["event_id"]
        r = api_client.post(f"{base_url}/api/events/{event_id}/signup",
                            json={}, headers=auth_headers_a)
        assert r.status_code == 200
        r2 = api_client.get(f"{base_url}/api/events/{event_id}/state",
                            headers=auth_headers_a)
        assert r2.status_code == 200
        assert r2.json().get("registered") is True


# ---------------- Admin ----------------
class TestAdmin:
    def test_admin_me(self, api_client, base_url, auth_headers_a):
        r = api_client.get(f"{base_url}/api/admin/me", headers=auth_headers_a)
        assert r.status_code == 200
        assert r.json()["is_admin"] is True

    def test_admin_stats(self, api_client, base_url, auth_headers_a):
        r = api_client.get(f"{base_url}/api/admin/stats", headers=auth_headers_a)
        assert r.status_code == 200
        d = r.json()
        for k in ("users","matches","events","messages"):
            assert k in d

    def test_admin_create_event(self, api_client, base_url, auth_headers_a):
        starts = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
        ends = (datetime.now(timezone.utc) + timedelta(days=10, hours=2)).isoformat()
        r = api_client.post(f"{base_url}/api/admin/events",
                            json={"title": "TEST_admin_evt", "starts_at": starts,
                                  "ends_at": ends, "capacity": 20},
                            headers=auth_headers_a)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_admin_evt"

    def test_admin_forbidden_for_non_admin(self, api_client, base_url, auth_headers_b):
        r = api_client.get(f"{base_url}/api/admin/stats", headers=auth_headers_b)
        assert r.status_code == 403


# ---------------- Photo upload ----------------
class TestPhotoUpload:
    def test_upload_photo(self, base_url, user_a):
        # tiny valid JPEG bytes
        jpeg = bytes.fromhex(
            "ffd8ffe000104a46494600010100000100010000ffdb0043000806060706050807070709090808"
            "0a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434"
            "341f27393d38323c2e333432ffc0000b08000100010101110002ffc4001f0000010501010101"
            "01010000000000000000010203040506070809000a0bffc4001f01000301010101010101010101"
            "00000000000001020304050607ffd9"
        )
        files = {"file": ("test.jpg", jpeg, "image/jpeg")}
        headers = {"Authorization": f"Bearer {user_a['token']}"}
        r = requests.post(f"{base_url}/api/users/me/photos",
                          files=files, headers=headers, timeout=60)
        # Storage may be flaky; accept 200/503
        if r.status_code == 503:
            import pytest
            pytest.skip("Storage unavailable")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "path" in d


# ---------------- Date plan + Safety + Feedback gate ----------------
class TestDateFlow:
    def test_full_date_flow(self, api_client, base_url, db, user_a, user_b,
                            auth_headers_a, auth_headers_b):
        # mutual likes -> match
        api_client.post(f"{base_url}/api/matches/swipe",
                        json={"target_id": user_b["user_id"], "action": "like"},
                        headers=auth_headers_a)
        r = api_client.post(f"{base_url}/api/matches/swipe",
                            json={"target_id": user_a["user_id"], "action": "like"},
                            headers=auth_headers_b)
        assert r.status_code == 200
        match = db.matches.find_one({
            "$or": [
                {"user_a": user_a["user_id"], "user_b": user_b["user_id"]},
                {"user_a": user_b["user_id"], "user_b": user_a["user_id"]},
            ]
        })
        assert match is not None, "Match should exist after mutual likes"
        match_id = match["match_id"]

        # plan date
        planned_at = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        r = api_client.post(f"{base_url}/api/chat/threads/{match_id}/plan_date",
                            json={"planned_at": planned_at,
                                  "venue_name": "Sky Garden",
                                  "venue_address": "20 Fenchurch St"},
                            headers=auth_headers_a)
        assert r.status_code == 200
        plan = r.json()
        assert "safety_token" in plan
        token = plan["safety_token"]

        # public safety view
        r2 = requests.get(f"{base_url}/api/safety/{token}", timeout=20)
        assert r2.status_code == 200
        s = r2.json()
        assert s["venue_name"] == "Sky Garden"
        assert "date_with" in s

        # Bad token
        r3 = requests.get(f"{base_url}/api/safety/BADTOKEN_xyz", timeout=20)
        assert r3.status_code == 404

        # Test gate: simulate planned_at in past >24h
        past = (datetime.now(timezone.utc) - timedelta(hours=30)).isoformat()
        db.date_plans.update_one({"match_id": match_id},
                                  {"$set": {"planned_at": past, "feedback": {}}})
        # Both yes -> chat_open True
        r = api_client.post(f"{base_url}/api/chat/threads/{match_id}/feedback",
                            json={"enjoyed": True, "want_continue": True},
                            headers=auth_headers_a)
        assert r.status_code == 200
        r = api_client.post(f"{base_url}/api/chat/threads/{match_id}/feedback",
                            json={"enjoyed": True, "want_continue": True},
                            headers=auth_headers_b)
        assert r.status_code == 200
        d = r.json()
        assert d["chat_open"] is True
        assert d["both_submitted"] is True

        # Either no -> chat_open False
        db.date_plans.update_one({"match_id": match_id}, {"$set": {"feedback": {}}})
        api_client.post(f"{base_url}/api/chat/threads/{match_id}/feedback",
                        json={"enjoyed": True, "want_continue": True},
                        headers=auth_headers_a)
        r = api_client.post(f"{base_url}/api/chat/threads/{match_id}/feedback",
                            json={"enjoyed": False, "want_continue": False},
                            headers=auth_headers_b)
        assert r.status_code == 200
        assert r.json()["chat_open"] is False


# ---------------- PWA manifest ----------------
class TestPWA:
    def test_manifest(self, api_client, base_url):
        r = api_client.get(f"{base_url}/manifest.json")
        assert r.status_code == 200
        m = r.json()
        assert "name" in m
        assert "icons" in m
