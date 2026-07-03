# World Cup Predictions ⚽🏆

A website where people predict World Cup match scores and earn points:
**+1** for the right winner, **+3** for the exact score. It also shows the
next matches, live scores, and the knockout bracket.

> **Status: Step 1 — basic website with demo data.**
> No sign-in yet, and the matches/scores below are *fake placeholder data* so
> we can see the design working. Real accounts and real live scores come next
> (see [`docs/SETUP-NEEDS.md`](docs/SETUP-NEEDS.md) for what's needed).

## What works right now
- **🍔 Hamburger menu** → Home · Bracket · My Score
- **Home** — next matches with country **flags**, date & time, and a box to
  predict each score. One match is shown **live** (a scripted demo) so you can
  see the score change, cards appear, and a VAR-disallowed goal make the score
  go back — like Google's live score.
- **Bracket** — the knockout tree. Winners advance; eliminated teams turn grey.
- **My Score** — your points, a progress bar, and every prediction you made
  (wrong ones greyed out, correct ones showing the points earned).

Predictions are saved in your browser for now (no account needed yet).

## Run / preview
It's a plain static site — no build step.
Open `index.html`, or serve the folder:
```
python3 -m http.server 8000
```
Then visit <http://localhost:8000>. It also deploys to GitHub Pages at
<https://yocf20.github.io/Claude/>.

## Project layout
```
index.html            page shell + hamburger menu
css/styles.css        all styles
js/data.js            DEMO data (teams, matches, live timeline, bracket)
js/store.js           saves predictions + scoring rules
js/app.js             menu, navigation, and the live-score engine
js/views/home.js      home page (live + next matches + predictions)
js/views/bracket.js   knockout bracket
js/views/score.js     "My Score" page
docs/SETUP-NEEDS.md   what we need to add real data, live scores & sign-in
```

## What's next
Read [`docs/SETUP-NEEDS.md`](docs/SETUP-NEEDS.md) — it lists exactly what I
(Claude) will do vs. what you need to sign up for (a football data API, and
optionally Google sign-in), step by step.
