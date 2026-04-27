"""
Seed 6 demo profiles into Let's Snog so you can test the swipe deck end-to-end.

Run from /app/backend:  python scripts/seed_demo.py

Idempotent: re-running upserts the same demo users (matched by email).
"""
import os
import sys
import uuid
import asyncio
import requests
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
APP_NAME = os.environ.get("APP_NAME", "letssnog")

DEMO = [
    {
        "name": "Maddy", "age": 27, "gender": "woman", "looking_for": "everyone",
        "pronouns": "she/her", "bio": "Pub-quiz captain, dog enthusiast. Will judge your roast potatoes.",
        "job": "Brand designer", "education": "Bachelor's", "height_cm": 168,
        "interests": ["Pub crawls", "Vinyl", "Foodie", "Comedy", "Dogs"],
        "smokes": "never", "drinks": "sometimes", "workout": "sometimes",
        "has_kids": "no", "wants_kids": "maybe", "religion": "Atheist", "zodiac": "Leo",
        "prompts": [
            {"q": "Give me a reason to delete this app", "a": "Show me the best Sunday roast in Hackney."},
            {"q": "I'm happiest when", "a": "There's a cold pint, warm sun, and someone good to argue with."},
            {"q": "My toxic trait", "a": "I will reorganise your spice rack."},
        ],
        "quiz": ["A","A","D","B","C","B","B","A"],
        "photos": [
            "https://images.unsplash.com/photo-1581292065130-c7a4155e854a?auto=format&fit=crop&w=800&q=70",
            "https://images.unsplash.com/photo-1517438476312-10d79c077509?auto=format&fit=crop&w=800&q=70",
            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=70",
        ],
    },
    {
        "name": "Olu", "age": 31, "gender": "man", "looking_for": "woman",
        "pronouns": "he/him", "bio": "Architect by day, vinyl rabbit-hole by night. Ride bikes, miss home cooking.",
        "job": "Architect at a Peckham studio", "education": "Master's", "height_cm": 184,
        "interests": ["Vinyl", "Cycling", "Art galleries", "Cooking", "Travel"],
        "smokes": "never", "drinks": "sometimes", "workout": "often",
        "has_kids": "no", "wants_kids": "yes", "religion": "Christian", "zodiac": "Virgo",
        "prompts": [
            {"q": "The way to win me over is", "a": "Bring a banger I haven't heard. Bonus if it's pressed on wax."},
            {"q": "Together, we could", "a": "Cycle the whole Thames Path with a picnic at the end."},
            {"q": "Two truths and a lie", "a": "I've designed a pub. I've met Kano. I can't ride a bike."},
        ],
        "quiz": ["A","C","D","A","C","A","B","A"],
        "photos": [
            "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=70",
            "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=800&q=70",
            "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=800&q=70",
        ],
    },
    {
        "name": "Sasha", "age": 29, "gender": "woman", "looking_for": "everyone",
        "pronouns": "she/they", "bio": "Climber, plant hoarder, mediocre poet. Not here for situationships.",
        "job": "Product manager", "education": "Bachelor's", "height_cm": 171,
        "interests": ["Climbing", "Plants", "Yoga", "Reading", "Coffee"],
        "smokes": "never", "drinks": "sometimes", "workout": "daily",
        "has_kids": "no", "wants_kids": "yes", "religion": "Spiritual", "zodiac": "Sagittarius",
        "prompts": [
            {"q": "Don't hate me if I", "a": "Refuse to leave a bookshop within 90 minutes."},
            {"q": "Best Sunday roast in London is", "a": "Blacklock. Fight me."},
            {"q": "My simple pleasures", "a": "Cold flat white, hot shower, fresh page."},
        ],
        "quiz": ["A","B","A","A","B","D","D","A"],
        "photos": [
            "https://images.unsplash.com/photo-1592943666198-fbd360dbf58e?auto=format&fit=crop&w=800&q=70",
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=70",
            "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=800&q=70",
        ],
    },
    {
        "name": "Theo", "age": 33, "gender": "man", "looking_for": "everyone",
        "pronouns": "he/they", "bio": "Comedian-ish. Will absolutely make a joke at the wrong moment.",
        "job": "Stand-up & copywriter", "education": "Self-taught", "height_cm": 178,
        "interests": ["Comedy", "Cinema", "Pub crawls", "Festivals", "Tea snob"],
        "smokes": "sometimes", "drinks": "regularly", "workout": "sometimes",
        "has_kids": "no", "wants_kids": "maybe", "religion": "Agnostic", "zodiac": "Gemini",
        "prompts": [
            {"q": "Dating me is like", "a": "A Wetherspoons brunch — questionable but you'll laugh."},
            {"q": "My most controversial opinion", "a": "Ketchup belongs on a roast. Sue me."},
            {"q": "I geek out on", "a": "Niche British sitcoms from 2003."},
        ],
        "quiz": ["B","A","C","C","C","C","C","B"],
        "photos": [
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=70",
            "https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=800&q=70",
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=70",
        ],
    },
    {
        "name": "Priya", "age": 26, "gender": "woman", "looking_for": "man",
        "pronouns": "she/her", "bio": "South-London-born, midweek-gigs-obsessed. Coffee snob, will share.",
        "job": "Junior doctor", "education": "Master's", "height_cm": 162,
        "interests": ["Live gigs", "Running", "Foodie", "Photography", "Travel"],
        "smokes": "never", "drinks": "sometimes", "workout": "often",
        "has_kids": "no", "wants_kids": "yes", "religion": "Hindu", "zodiac": "Pisces",
        "prompts": [
            {"q": "I'll fall for you if", "a": "You can keep up at Brixton Academy and the morning run."},
            {"q": "A shower thought I recently had", "a": "Pigeons absolutely have a Slack channel."},
            {"q": "Together, we could", "a": "Run the Thames Path 10k and reward ourselves with dim sum."},
        ],
        "quiz": ["A","C","A","D","A","B","A","A"],
        "photos": [
            "https://images.unsplash.com/photo-1548142813-c348350df52b?auto=format&fit=crop&w=800&q=70",
            "https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?auto=format&fit=crop&w=800&q=70",
            "https://images.unsplash.com/photo-1521252659862-eec69941b071?auto=format&fit=crop&w=800&q=70",
        ],
    },
    {
        "name": "Jamie", "age": 30, "gender": "nonbinary", "looking_for": "everyone",
        "pronouns": "they/them", "bio": "DJ at the weekend, ceramic-thrower at the weekday. Make me a flat white.",
        "job": "Ceramicist + DJ", "education": "Trade school", "height_cm": 175,
        "interests": ["Festivals", "Vinyl", "Art galleries", "Coffee", "Tattoos"],
        "smokes": "sometimes", "drinks": "regularly", "workout": "sometimes",
        "has_kids": "no", "wants_kids": "no", "religion": "Spiritual", "zodiac": "Aquarius",
        "prompts": [
            {"q": "I'm happiest when", "a": "Wheel's spinning and bass is dropping. Same energy."},
            {"q": "The way to win me over is", "a": "Show up to my next pop-up. Stay for one drink."},
            {"q": "My toxic trait", "a": "I will romanticise a 4am bus ride home."},
        ],
        "quiz": ["C","C","B","B","D","C","D","B"],
        "photos": [
            "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=70",
            "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=70",
            "https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=800&q=70",
        ],
    },
]


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"Seeding {len(DEMO)} demo profiles...")

    for d in DEMO:
        email = f"demo+{d['name'].lower()}@letssnog.local"
        existing = await db.users.find_one({"email": email}, {"_id": 0})
        if existing:
            user_id = existing["user_id"]
            print(f"  · {d['name']} exists → refreshing fields")
        else:
            user_id = f"user_demo_{uuid.uuid4().hex[:10]}"
            print(f"  · {d['name']} new → uploading {len(d['photos'])} photos")

        # For a self-sufficient deployment, demo photos are stored as absolute URLs.
        # (Production uploads should go through S3 via the app flow.)
        photos = existing.get("photos") if existing else d["photos"]

        doc = {
            "user_id": user_id,
            "email": email,
            "name": d["name"],
            "picture": None,
            "age": d["age"],
            "gender": d["gender"],
            "pronouns": d["pronouns"],
            "looking_for": d["looking_for"],
            "bio": d["bio"],
            "height_cm": d["height_cm"],
            "job": d["job"],
            "education": d["education"],
            "interests": d["interests"],
            "photos": photos,
            "quiz": d["quiz"],
            "prompts": d["prompts"],
            "location": "London",
            "age_min": 21, "age_max": 45,
            "smokes": d["smokes"], "drinks": d["drinks"], "workout": d["workout"],
            "has_kids": d["has_kids"], "wants_kids": d["wants_kids"],
            "religion": d["religion"], "zodiac": d["zodiac"],
            "dates_completed": 0, "premium": False,
            "is_admin": False, "is_banned": False, "blocked_user_ids": [],
            "onboarding_complete": True,
            "created_at": (existing.get("created_at") if existing else datetime.now(timezone.utc).isoformat()),
        }
        await db.users.update_one({"email": email}, {"$set": doc}, upsert=True)

    # Force-refresh today's daily set for any logged-in user so they see the demos
    await db.daily_sets.delete_many({})
    print("Cleared daily_sets so the demo profiles appear in everyone's deck immediately.")
    print("Done. Open the app → /matches.")


if __name__ == "__main__":
    asyncio.run(main())
