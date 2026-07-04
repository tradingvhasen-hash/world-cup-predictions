# Design & behaviour fixes — saved for later

These are UI / dynamic issues the user reported after the site went live. They
are **deferred**: we finish the plan (Google sign-in + real API data) first,
then come back and fix these together. Not bugs that block progress.

## Live "Live now" section
1. **Flags flicker / flash white.** The home/away team flags (and the scoring
   team's flag in the event feed) blink every second.
   - Likely cause: `tickLive()` rebuilds `feed.innerHTML` every second, which
     reloads every flag `<img>` and briefly shows the white fallback badge.
   - Fix idea: don't re-render the whole feed each tick — only append the new
     event rows; update score/minute text nodes in place.
2. **Live score is stacked vertically.** "3 – 1" shows with 3 above 1, so you
   can't tell which number belongs to which team. Should read clearly left↔right
   next to each team's flag.

## Home page
3. **Hamburger menu missing.** The ☰ menu we agreed on isn't visible after login.
   Need to check the top bar / burger renders once signed in.
4. **Predictions open for ALL upcoming matches.** Should only allow predicting
   the *next* match (or a small window near kickoff), not every future match.
5. **Prediction input UX disliked.** Redesign how you enter a predicted score —
   the current two number boxes feel bad. Needs a nicer control.
6. **Show kickoff date + a live countdown** to when each match starts.

## My Score / Results
7. **Right vs wrong not clear.** The page doesn't visibly show which predictions
   were correct, which were wrong (greyed out), and the points earned. Make the
   correct / wrong / pending states obvious.

---

## Note on email confirmation (user concern)
The Supabase built-in email sender is rate-limited on the free tier (only a few
messages/hour) — that's why sign-up confirmation "barely worked". This is a
convenience sender for testing, **not** a permanent limit: in production we
attach a real email provider (Resend / SendGrid / etc.) and it's unlimited.

For now "Confirm email" is turned OFF so accounts work instantly. The user
prefers **Google sign-in** (no passwords, no reset, no confirmation emails,
safer) — we plan to add it. Email+password stays as a fallback option.
