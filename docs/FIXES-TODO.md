# Design & behaviour fixes

## ✅ Done
- **Live score now horizontal** — home crest · "1 – 0" · away crest, clear which
  number is whose, with a live-minute / FT badge.
- **Hamburger menu** — bars now render with an explicit width (were collapsing).
- **Predictions limited** to the next 6 upcoming matches (not every fixture).
- **Prediction input redesigned** — big +/- steppers instead of typed boxes.
- **Countdown to kickoff** on each upcoming card (updates every second).
- **My Score clarity** — "Your pick" vs "Actual" side by side, coloured
  left-border per state (green correct / red wrong / gold pending) + points badge.
- **Login hint** — small line recommending Google sign-in.
- **Live event feed** — collapsed to the newest 3 with a "show more" toggle;
  noise (delays, drinks breaks, half-start/end) filtered out; each event carries
  its team's flag + a home/away colour accent; feed only redraws when it changes
  (no more per-second flag flicker).
- **Lineups page** added (Starting XI + subs + formation, real ESPN data).

## ⏳ Remaining
- **Bracket page** — still a placeholder. A proper connected knockout tree is
  hard from the free feed (completed matches aren't cleanly tagged by round);
  needs a different data approach. Next up.
- **Coaches** — not in the ESPN feed we use; find another free source or skip.

## ⏰ REMINDER — re-enable email confirmation before going public
"Confirm email" is OFF in Supabase (Authentication → Providers → Email) so we
could test without the free email rate limit. Before launch, turn it back ON and
attach a real email provider (Resend / SendGrid) so confirmation + password-reset
emails send reliably and unlimited. Google sign-in is unaffected by this.
