# Let's Snog – PRD

## Original problem statement
Build "Let's Snog" (letssnog.co.uk) — a cheeky, London-first dating app that fixes
Tinder/Bumble/Hinge frustrations. Free core experience, 10–15 daily smart matches,
in-app speed-dating events (Tue/Thu 7–9pm), 1:1 realtime chat with London venue
date-organiser, post-date mutual feedback gate that kills ghosting, premium tier
£4.99/mo. PWA, dark/light, deep-navy + hot-pink branding, British humour.

## User-confirmed choices (2026-04-26)
1. Stack: React + FastAPI + MongoDB
2. Auth: AWS Cognito User Pool (custom in-app signup/login)
3. Photos: S3 (presigned upload)
4. Realtime: WebSockets via FastAPI (live event chat)
5. Stripe premium: **deferred** to phase 2

## Architecture (current)
- Backend `/app/backend/server.py` — FastAPI single-file (auth, profiles, photos,
  matches, events, WebSocket event chat, 1:1 chat, date plans, feedback gate, admin).
  Routes prefixed `/api`. WS at `/api/ws/event/{event_id}?token=`.
- Frontend `/app/frontend/src/` — React 19, react-router-dom v7, Tailwind, shadcn/ui,
  Outfit + Unbounded + Caveat fonts, dark navy+hot-pink palette, glassmorphism.
  PWA manifest + icons in `/app/frontend/public`.
- DB: MongoDB collections — users, swipes, matches, daily_sets, messages,
  events, date_plans.
- Storage: S3 (public URLs stored in `users.photos`).

## What's been implemented
### v1 (2026-04-26)
- Landing page (hero, stages, CTAs, branded Unbounded/Caveat type, neon backdrop)
- Emergent Google auth (session cookie + Authorization Bearer dual-mode)
- Onboarding (profile form + photo upload via Emergent storage + 8Q vibe quiz)
- Daily smart matches (10/12/15 cap by tier, 70/20/10 scoring, midnight-London reset)
- Like / Pass / Super-like with mutual-match toast
- Speed-dating events: Tue/Thu pre-seeded, signup, lobby, admin start,
  3 rounds × 5min timer, icebreaker question, WebSocket chat per pair,
  Yes/No decision per round, mutual-yes auto-creates match
- 1:1 chat (4s polling), Plan-a-date modal with curated London venues + custom
- Safety share link (token URL, copy + WhatsApp deep-link)
- Post-date feedback gate (24h, both yes → re-open, either no → close)
- Admin v1: stats + create event
- Public /safety/{token} viewer
- PWA manifest + icons
- Backend test suite 25/25 pass

### v2 (2026-04-26)
- **Multi-page onboarding wizard** with framer-motion transitions + 4 fun
  "holding" interstitials between groups
- **Expanded profile fields**: pronouns, smokes, drinks, workout, has_kids,
  wants_kids, religion, zodiac, education + 14 selectable prompts (×3)
- **Photo manager** in profile: reorder, set primary (★), remove
- **Tap-to-open Profile Detail** modal from swipe deck (full bio, gallery,
  prompts, lifestyle chips, action bar with pass/like/suggest-date)
- **Date-Request flow**: ⭐ super-like opens Activity + Timeframe + optional
  message sheet; recipient sees a card on Chats with 48h countdown +
  Accept/Decline; accept → instant match + auto system message in chat
- **Match overlay animation**: floating hearts + spring scale + cheeky copy
- **Report + Block** on chat menu (kebab → modal); blocked users excluded
  from match pool (and users who blocked me)
- **Admin v2 dashboard tabs**: Stats / Users (search + ban/unban + session purge)
  / Messages / Reports (resolve + ban-from-report) / Events (create + start)
- Daily-match pool now also excludes banned users
- Backend regression suite 22/22 pass (iter-2) plus 25/25 (iter-1)
- Fixed: SwipeIn model now correctly carries optional `date_request` payload
  (was raising 500 on super-like with date request)

## Backlog
P0 (next):
- Stripe premium £4.99/mo + £39/yr (Stripe SDK + checkout + webhooks; gate the
  premium-only flags `unlimited_matches`, `extra_event_slots`, `profile_boost`,
  `see_who_liked_you`)
- Push notifications (web push subscription + 24h date reminder + new match)
- Photo verification (selfie liveness or Emergent moderation hook)

P1:
- Light theme finishing pass + theme toggle (CSS vars exist, toggle UI pending)
- Block / report user, in-app safety reporting
- Better matching: read-receipts, reply-rate boost, geo-radius slider
- Map embed (Leaflet+OSM) on date-plan modal
- Chat WebSocket for 1:1 (currently polling)

P2:
- Apple Sign-In + Email OTP
- Admin: ban users, manual match override, event analytics
- Native push (PWA → background sync)
- A/B test landing CTAs

## Setup notes
- AWS S3 / RDS / Vercel / Next.js NOT used; replaced with Emergent's S3-compatible
  object storage and MongoDB on the platform per environment constraints.
- EMERGENT_LLM_KEY in `/app/backend/.env` powers object storage init.
