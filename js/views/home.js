/* ============================================================================
   HOME VIEW  —  one clean, uniform row per match. Simple.
   Live / upcoming / finished all share the same slim row; only the middle
   differs (live score · prediction inputs · final score). Predictions
   auto-save, so there are no buttons.
   ========================================================================== */

function renderHome() {
  if (!matchesLoaded) {
    if (matchesError) {
      return `<div class="page home-page">
        <p class="muted">Couldn't load matches. Check your connection.</p>
        <button class="pred-save" id="retry-load">Try again</button></div>`;
    }
    return `<div class="page home-page"><div class="loading">Loading…</div></div>`;
  }

  const live     = MATCHES.filter(m => m.status === 'live');
  const upcoming  = MATCHES.filter(m => m.status === 'upcoming' && hasRealTeams(m)).slice(0, 6);
  const finished = MATCHES.filter(m => m.status === 'finished' && hasRealTeams(m))
                          .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff)).slice(0, 6);

  let html = `<div class="page home-page">
    <div class="score-strip">
      <span class="score-strip-label">Your score</span>
      <span class="score-strip-value">${totalScore()} pts</span>
    </div>`;

  if (live.length) {
    html += `<h2 class="section-title"><span class="live-dot"></span>Live</h2>`;
    html += live.map(liveRow).join('');
  }

  html += `<h2 class="section-title">Next up</h2>`;
  html += upcoming.length ? upcoming.map(predictRow).join('')
                          : `<p class="muted">No upcoming matches right now.</p>`;

  if (finished.length) {
    html += `<h2 class="section-title">Results</h2>`;
    html += finished.map(resultRow).join('');
  }

  html += `</div>`;
  return html;
}

function sideTeam(code, right) {
  return `<div class="mrow-team${right ? ' right' : ''}">
    ${right ? `<span>${teamName(code)}</span>${flagImg(code, 'flag')}`
            : `${flagImg(code, 'flag')}<span>${teamName(code)}</span>`}
  </div>`;
}

function liveRow(m) {
  return `<div class="mrow live" id="live-${m.id}">
      ${sideTeam(m.home, false)}
      <div class="mrow-mid">
        <div class="mrow-score"><span id="hs-${m.id}">${m.homeScore ?? 0}</span>–<span id="as-${m.id}">${m.awayScore ?? 0}</span></div>
        <div class="live-min" id="min-${m.id}">${m.minute || 'LIVE'}</div>
      </div>
      ${sideTeam(m.away, true)}
    </div>
    <div class="event-feed" id="feed-${m.id}"></div>`;
}

function resultRow(m) {
  return `<div class="mrow">
    ${sideTeam(m.home, false)}
    <div class="mrow-mid"><div class="mrow-score">${m.homeScore}–${m.awayScore}</div></div>
    ${sideTeam(m.away, true)}
  </div>`;
}

function predictRow(m) {
  const p = getPrediction(m.id);
  const hv = p ? p.home : '';
  const av = p ? p.away : '';
  return `<div class="mrow" data-match="${m.id}">
    ${sideTeam(m.home, false)}
    <div class="mrow-mid">
      <div class="sc-inputs">
        <input class="sc-in" id="ph-${m.id}" type="number" min="0" max="99" inputmode="numeric" value="${hv}" aria-label="${teamName(m.home)} score">
        <span class="sc-sep">–</span>
        <input class="sc-in" id="pa-${m.id}" type="number" min="0" max="99" inputmode="numeric" value="${av}" aria-label="${teamName(m.away)} score">
      </div>
      <div class="mrow-time ${p ? 'saved' : ''}" id="hint-${m.id}">${p ? '✓ saved' : timeShort(m.kickoff)}</div>
    </div>
    ${sideTeam(m.away, true)}
  </div>`;
}

function timeShort(iso) {
  const dt = new Date(iso), now = new Date();
  const t = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (dt.toDateString() === now.toDateString()) return `Today ${t}`;
  return `${dt.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${t}`;
}

/* ---- wire up ---- */
function bindHome() {
  if (!matchesLoaded) {
    const retry = document.getElementById('retry-load');
    if (retry) retry.addEventListener('click', () => { matchesError = false; navigate('home'); });
    refreshMatches().then(() => navigate('home')).catch(() => { matchesError = true; navigate('home'); });
    return;
  }

  // Auto-save a prediction when both score boxes are filled.
  document.querySelectorAll('.mrow[data-match]').forEach(row => {
    const id = row.getAttribute('data-match');
    row.querySelectorAll('.sc-in').forEach(inp => {
      inp.addEventListener('change', async () => {
        const h = document.getElementById('ph-' + id).value;
        const a = document.getElementById('pa-' + id).value;
        const hint = document.getElementById('hint-' + id);
        if (h === '' || a === '') return;
        const ok = await setPrediction(id, h, a);
        hint.textContent = ok ? '✓ saved' : 'not saved';
        hint.className = 'mrow-time ' + (ok ? 'saved' : 'err');
        updateScoreStrip();
      });
    });
  });

  startLiveEngine();
}
