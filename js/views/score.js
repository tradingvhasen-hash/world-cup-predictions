/* ============================================================================
   MY SCORE VIEW  —  the user's points and every prediction they made
   Correct predictions are highlighted; wrong ones show your pick vs the actual.
   ========================================================================== */

function renderScore() {
  const preds = allPredictions();
  const ids = Object.keys(preds);
  const total = totalScore();

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

  let played = 0, correct = 0;
  const rows = ids.map(id => {
    const m = MATCHES.find(x => x.id === id);
    if (!m) return null;
    const res = scorePrediction(preds[id], m);
    if (m.status === 'finished') { played++; if (res.points > 0) correct++; }
    return { m, pred: preds[id], res };
  }).filter(Boolean);

  const pct = played ? Math.round((correct / played) * 100) : 0;
  html += `<div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
    <p class="muted">${correct} of ${played} finished predictions earned points (${pct}%).</p>`;

  // finished first, then pending
  rows.sort((a, b) => (a.m.status === 'finished' ? 0 : 1) - (b.m.status === 'finished' ? 0 : 1));
  html += rows.map(scoreRow).join('');
  html += `</div>`;
  return html;
}

function scoreRow({ m, pred, res }) {
  const cls = res.verdict === 'wrong' ? 'wrong'
            : res.verdict === 'pending' ? 'pending' : 'correct';

  let badge;
  if (res.verdict === 'exact')       badge = `<span class="badge good">+3 exact score</span>`;
  else if (res.verdict === 'winner') badge = `<span class="badge ok">+1 right winner</span>`;
  else if (res.verdict === 'wrong')  badge = `<span class="badge bad">Wrong · 0 pts</span>`;
  else                               badge = `<span class="badge wait">Not played yet</span>`;

  const actual = m.status === 'finished'
    ? `<div class="row-scorebox"><span class="lbl">Actual</span><span class="val">${m.homeScore} – ${m.awayScore}</span></div>`
    : '';

  return `<div class="pred-row ${cls}">
    <div class="row-top">
      ${miniTeam(m.home)}
      <span class="vs">vs</span>
      ${miniTeam(m.away)}
    </div>
    <div class="row-scores">
      <div class="row-scorebox"><span class="lbl">Your pick</span><span class="val">${pred.home} – ${pred.away}</span></div>
      ${actual}
    </div>
    <div class="row-meta">${m.stage} · ${fmtDate(m.kickoff)}</div>
    ${badge}
  </div>`;
}

function miniTeam(code) {
  return `<div class="mini-team">
    ${flagImg(code, 'flag-sm', 40)}
    <span>${teamName(code)}</span>
  </div>`;
}
