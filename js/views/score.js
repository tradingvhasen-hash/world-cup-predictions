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

  html += scoreChart();

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
    <div class="row-meta">${fmtDate(m.kickoff)}</div>
    ${badge}
  </div>`;
}

/* ---- points-over-time line chart (adapted from Uiverse code-town3) ----
   Builds an SVG line chart of the user's cumulative points across their
   finished predictions, recoloured to the theme (deep green card, gold line). */
function scoreChart() {
  const preds = allPredictions();
  const done = Object.keys(preds).map(id => {
    const m = MATCHES.find(x => x.id === id);
    return (m && m.status === 'finished') ? { m, points: scorePrediction(preds[id], m).points } : null;
  }).filter(Boolean).sort((a, b) => new Date(a.m.kickoff) - new Date(b.m.kickoff));

  if (done.length < 2) return '';  // need at least 2 points to draw a line

  let cum = 0;
  const series = done.map(d => { cum += d.points; return { label: shortDate(d.m.kickoff), value: cum }; });

  const W = 360, H = 130, padL = 16, padR = 16, padTop = 12, padBot = 26;
  const maxV = Math.max(...series.map(s => s.value), 1);
  const minV = Math.min(...series.map(s => s.value), 0);
  const xAt = i => padL + i * (W - padL - padR) / (series.length - 1);
  const yAt = v => padTop + (1 - (v - minV) / ((maxV - minV) || 1)) * (H - padTop - padBot);

  const pts = series.map((s, i) => `${xAt(i).toFixed(1)},${yAt(s.value).toFixed(1)}`);
  const area = `M${pts[0]} L${pts.join(' L')} L${xAt(series.length - 1).toFixed(1)},${H - padBot} L${xAt(0).toFixed(1)},${H - padBot} Z`;
  const dots = series.map((s, i) => `<circle class="ch-dot" r="4" cx="${xAt(i).toFixed(1)}" cy="${yAt(s.value).toFixed(1)}"></circle>`).join('');

  const labIdx = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])];
  const xlabels = labIdx.map(i => `<text class="ch-x" text-anchor="middle" x="${xAt(i).toFixed(1)}" y="${H - 8}">${series[i].label}</text>`).join('');

  return `<div class="score-chart">
    <div class="sc-head"><span class="sc-title">Your points over time</span>
      <span class="sc-total">${series[series.length - 1].value} pts</span></div>
    <svg class="ch-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--gold)"></stop>
          <stop offset="100%" stop-color="#63c79a"></stop>
        </linearGradient>
        <linearGradient id="chArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(201,154,59,.35)"></stop>
          <stop offset="100%" stop-color="rgba(201,154,59,0)"></stop>
        </linearGradient>
      </defs>
      <path fill="url(#chArea)" d="${area}"></path>
      <polyline fill="none" stroke="url(#chLine)" stroke-width="3" stroke-linecap="round"
        stroke-linejoin="round" points="${pts.join(' ')}"></polyline>
      ${dots}
      ${xlabels}
    </svg>
  </div>`;
}

function shortDate(iso) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function miniTeam(code) {
  return `<div class="mini-team">
    ${flagImg(code, 'flag-sm', 40)}
    <span>${teamName(code)}</span>
  </div>`;
}
