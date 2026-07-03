/* ============================================================================
   MY SCORE VIEW  —  the user's points and every prediction they made
   Wrong predictions are shown greyed out; correct ones show the points earned.
   ========================================================================== */

function renderScore() {
  const preds = allPredictions();
  const ids = Object.keys(preds);
  const total = totalScore();

  // How many points are still possible from matches not finished yet.
  let played = 0, correct = 0;

  let html = `<div class="page">
    <h2 class="section-title">My score</h2>
    <div class="score-hero">
      <div class="score-big">${total}</div>
      <div class="score-unit">points</div>
    </div>`;

  if (ids.length === 0) {
    html += `<p class="muted">You haven't made any predictions yet. Go to
      <b>Home</b> and predict the score of an upcoming match.</p></div>`;
    return html;
  }

  // Build rows, grouped: finished first (scored), then pending.
  const rows = ids.map(id => {
    const m = MATCHES.find(x => x.id === id);
    if (!m) return null;
    const pred = preds[id];
    const res = scorePrediction(pred, m);
    if (m.status === 'finished') { played++; if (res.points > 0) correct++; }
    return { m, pred, res };
  }).filter(Boolean);

  // progress bar (share of finished predictions that earned points)
  const pct = played ? Math.round((correct / played) * 100) : 0;
  html += `<div class="progress">
      <div class="progress-bar" style="width:${pct}%"></div>
    </div>
    <p class="muted">${correct} of ${played} finished predictions earned points (${pct}%).</p>`;

  rows.sort((a, b) => (a.m.status === 'finished' ? 0 : 1) - (b.m.status === 'finished' ? 0 : 1));

  html += rows.map(scoreRow).join('');
  html += `</div>`;
  return html;
}

function scoreRow({ m, pred, res }) {
  const wrong = res.verdict === 'wrong';
  const pending = res.verdict === 'pending';
  const cls = ['pred-row', wrong ? 'wrong' : '', pending ? 'pending' : ''].join(' ').trim();

  let badge = '';
  if (res.verdict === 'exact')  badge = `<span class="badge good">+3 exact score</span>`;
  else if (res.verdict === 'winner') badge = `<span class="badge ok">+1 right winner</span>`;
  else if (res.verdict === 'wrong')  badge = `<span class="badge bad">Wrong</span>`;
  else badge = `<span class="badge wait">Not played yet</span>`;

  const actual = m.status === 'finished'
    ? `<div class="row-sub">Actual: ${m.homeScore} – ${m.awayScore}</div>` : '';

  return `<div class="${cls}">
    <div class="row-top">
      ${miniTeam(m.home)}
      <div class="row-pred">${pred.home} – ${pred.away}</div>
      ${miniTeam(m.away)}
    </div>
    <div class="row-meta">${m.stage} · ${fmtDate(m.kickoff)}</div>
    ${actual}
    ${badge}
  </div>`;
}

function miniTeam(code) {
  return `<div class="mini-team">
    ${flagImg(code, 'flag-sm', 40)}
    <span>${teamName(code)}</span>
  </div>`;
}
