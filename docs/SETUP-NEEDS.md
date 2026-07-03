# What we need next — your side vs. my side

Right now the website is a **working demo with fake data**. To make it real we
need two things: (1) real match & live-score **data**, and (2) **accounts** so
people can sign in and keep their score. Here's exactly what each of us does.

Nothing here is urgent — we can keep improving the demo first. This is just the
map so you know what's coming and what to sign up for when we're ready.

---

## Part A — Real matches & live scores (the football data)

The website should update **automatically**, not by me typing in scores. To do
that it reads from a "football data API" — a service that publishes fixtures,
live scores, goals, cards, lineups and coaches.

**Recommended service: API-Football** (https://www.api-football.com/).
- It has the World Cup: fixtures, **live scores updated every few seconds**,
  goal/card events (including VAR), lineups, and coaches — everything you asked
  for.
- It has a **free plan** (100 requests/day) to start and test with.

### 👉 Your side (about 5 minutes)
1. Go to https://www.api-football.com/ and click **Sign Up** (email + password).
2. After signing in, open the **Dashboard** — you'll see an **API key**
   (a long string of letters/numbers).
3. Send me that API key. *(It's a secret — we'll store it safely on the server,
   never inside the website code where people could see it.)*

### 👉 My side
- Connect the website to API-Football using your key.
- Replace all the fake demo data with the real World Cup schedule, flags, live
  scores, lineups and coaches — fetched automatically on a timer.
- Add the extra menu pages you mentioned (lineups / coach info per match).

> There are alternatives (football-data.org is also free; SportMonks is paid and
> very detailed). API-Football is the best balance of free + live detail, so I
> recommend starting there. If you'd rather use a different one, just tell me.

---

## Part B — Accounts & sign-in

You asked whether **"Sign in with Google"** is easy, or whether we should just
do our own username/password. Good news: there's one tool that gives us **both**
plus the database, and it's not hard.

**Recommended service: Supabase** (https://supabase.com/) — free plan.
It gives us, in one place:
- a **database** to store users, predictions and scores,
- **email + password** sign-in built in — *including a proper "forgot password"
  email*, so we don't need the "sorry, no way to reset" compromise you
  mentioned, and
- **"Sign in with Google"** as an optional toggle.

### 👉 Your side (about 10 minutes)
1. Go to https://supabase.com/ → **Start your project** (sign up with GitHub or
   email).
2. Click **New project**, give it a name (e.g. `world-cup-predictions`), pick a
   password for the database (save it somewhere), and create it.
3. Open **Project Settings → API**. Send me two things shown there:
   - the **Project URL**
   - the **anon public key** *(this one is safe to put in the website — it's
     designed to be public.)*

That's enough for **email + password** sign-in with password reset. 🎉

### Optional — turn on "Sign in with Google"
It's a few extra steps because Google requires it. Only if you want it:
1. Go to https://console.cloud.google.com/ → create a project.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   (type: *Web application*).
3. I'll give you the exact **redirect URL** to paste in (it comes from Supabase).
4. Google gives you a **Client ID** and **Client secret** — send me both, and I
   paste them into Supabase's Google setting. Done.

If that feels like too much, we skip it and just use email + password — which,
with Supabase, already includes password reset. Totally your call.

### 👉 My side
- Wire the website up to Supabase for sign-up / sign-in / sign-out.
- Move predictions & scores from "saved in the browser" to the real database, so
  a person's score follows them on any device.
- Add the login screen in front of the app, and (if you want it) the Google
  button.

---

## The plan in one picture

| Piece | Who signs up | What you send me | Cost |
|---|---|---|---|
| Live football data | You → API-Football | the API key | Free to start |
| Accounts + database + password reset | You → Supabase | Project URL + anon key | Free |
| Google sign-in (optional) | You → Google Cloud | Client ID + secret | Free |
| Building & connecting everything | Me | — | — |
| Hosting the website | (GitHub Pages, already set up) | — | Free |

**Order I suggest:** keep polishing the demo → add Supabase sign-in → then plug
in the real live data. But we can do it in whatever order you like.

Whenever you're ready for a step, just create that account and send me the
key(s). Until then, the demo runs fine on its own.
