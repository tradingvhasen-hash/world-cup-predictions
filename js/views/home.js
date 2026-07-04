/* ============================================================================
   HOME VIEW
   - Live matches (only while a game is actually being played)
   - "Next up": the next 3 matches — tap a flag to add a goal ⚽, tap the balls
     to remove one. Predictions auto-save and lock once the match kicks off.
   - "Later": further fixtures, shown but not yet predictable.
   - "Results": finished matches.
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

  const now = Date.now();
  const live = MATCHES.filter(m => m.status === 'live');
  const upcoming = MATCHES
    .filter(m => m.status === 'upcoming' && hasRealTeams(m) && new Date(m.kickoff).getTime() > now)
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const predictable = upcoming.slice(0, 3);
  const later = upcoming.slice(3, 9);
  const finished = MATCHES.filter(m => m.status === 'finished' && hasRealTeams(m))
                          .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff)).slice(0, 6);

  let html = `<div class="page home-page">`;

  if (live.length) {
    html += `<h2 class="section-title"><span class="live-dot"></span>Live</h2>`;
    html += live.map(liveRow).join('');
  }

  html += `<h2 class="section-title">Next up</h2>`;
  if (predictable.length) {
    html += `<p class="muted tap-hint">Tap a flag to add a goal ⚽ · tap the balls to remove</p>`;
    html += predictable.map(predictRow).join('');
  } else {
    html += `<p class="muted">No matches open for prediction right now.</p>`;
  }

  if (later.length) {
    html += `<h2 class="section-title">Later</h2>`;
    html += `<p class="muted tap-hint">Come back closer to kick-off to predict these.</p>`;
    html += later.map(laterRow).join('');
  }

  if (finished.length) {
    html += `<h2 class="section-title">Results</h2>`;
    html += finished.map(resultRow).join('');
  }

  html += `</div>`;
  return html;
}

/* ---- shared row halves ---- */
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

/* not-yet-predictable fixture (display only) */
function laterRow(m) {
  return `<div class="mrow later">
    ${sideTeam(m.home, false)}
    <div class="mrow-mid">
      <div class="cd" data-kickoff="${m.kickoff}"></div>
      <div class="later-lock">🔒 opens soon</div>
    </div>
    ${sideTeam(m.away, true)}
  </div>`;
}

/* ---- upcoming: tap-a-flag prediction ---- */
function predictRow(m) {
  const p = getPrediction(m.id);
  const hv = p ? p.home : 0;
  const av = p ? p.away : 0;
  return `<div class="mrow predict" data-match="${m.id}">
    ${tapTeam(m.id, m.home, 'h', hv, false)}
    <div class="mrow-mid">
      <div class="tap-score"><span id="ph-${m.id}">${hv}</span> – <span id="pa-${m.id}">${av}</span></div>
      <div class="cd" data-kickoff="${m.kickoff}"></div>
      <span class="save-flash" id="sf-${m.id}">✓ saved</span>
    </div>
    ${tapTeam(m.id, m.away, 'a', av, true)}
  </div>`;
}

function tapTeam(id, code, side, val, right) {
  const flag = `<button class="tapflag" id="flag-${side}-${id}" type="button" aria-label="Add goal for ${teamName(code)}">${flagImg(code, 'flag')}</button>`;
  const name = `<span class="team-name">${teamName(code)}</span>`;
  const balls = `<button class="balls" id="balls-${side}-${id}" type="button" aria-label="Remove a goal">${ballsHtml(val)}</button>`;
  return `<div class="tapteam${right ? ' right' : ''}">${flag}${name}${balls}</div>`;
}

function ballsHtml(n) {
  if (!n) return `<span class="ball-hint">–</span>`;
  let s = '';
  for (let i = 0; i < n; i++) s += `<span class="ball${i === n - 1 ? ' pop' : ''}">⚽</span>`;
  return s;
}

/* ---- wire up ---- */
let tapSaveTimers = {};

function bindHome() {
  if (!matchesLoaded) {
    const retry = document.getElementById('retry-load');
    if (retry) retry.addEventListener('click', () => { matchesError = false; navigate('home'); });
    refreshMatches().then(() => navigate('home')).catch(() => { matchesError = true; navigate('home'); });
    return;
  }

  document.querySelectorAll('.mrow.predict').forEach(row => {
    const id = row.getAttribute('data-match');
    document.getElementById('flag-h-' + id).addEventListener('click', () => bumpGoal(id, 'h', 1));
    document.getElementById('flag-a-' + id).addEventListener('click', () => bumpGoal(id, 'a', 1));
    document.getElementById('balls-h-' + id).addEventListener('click', () => bumpGoal(id, 'h', -1));
    document.getElementById('balls-a-' + id).addEventListener('click', () => bumpGoal(id, 'a', -1));
  });

  updateScoreStrip();
  startLiveEngine();
  startCountdowns();
}

function bumpGoal(id, side, delta) {
  const span = document.getElementById((side === 'h' ? 'ph-' : 'pa-') + id);
  const v = Math.max(0, Math.min(20, parseInt(span.textContent || '0', 10) + delta));
  span.textContent = v;
  document.getElementById('balls-' + side + '-' + id).innerHTML = ballsHtml(v);
  autoSaveTap(id);
}

function autoSaveTap(id) {
  clearTimeout(tapSaveTimers[id]);
  tapSaveTimers[id] = setTimeout(async () => {
    const h = document.getElementById('ph-' + id).textContent;
    const a = document.getElementById('pa-' + id).textContent;
    const ok = await setPrediction(id, h, a);
    if (ok) flashSaved(id);
    updateScoreStrip();
  }, 450);
}

function flashSaved(id) {
  const el = document.getElementById('sf-' + id);
  if (!el) return;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1400);
}
