/* ============================================================================
   HOME VIEW  —  tap a team's flag to add a goal (⚽). Hold to reset.
   Live / finished matches show as clean uniform rows; upcoming matches are
   predicted by tapping flags — no number boxes, no steppers. Auto-saves.
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
  if (upcoming.length) {
    html += `<p class="muted tap-hint">Tap a flag to add a goal ⚽ · hold to reset</p>`;
    html += upcoming.map(predictRow).join('');
  } else {
    html += `<p class="muted">No upcoming matches right now.</p>`;
  }

  if (finished.length) {
    html += `<h2 class="section-title">Results</h2>`;
    html += finished.map(resultRow).join('');
  }

  html += `</div>`;
  return html;
}

/* ---- live + result: clean uniform rows ---- */
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

/* ---- upcoming: tap-a-flag prediction ---- */
function predictRow(m) {
  const p = getPrediction(m.id);
  const hv = p ? p.home : 0;
  const av = p ? p.away : 0;
  return `<div class="mrow predict" data-match="${m.id}">
    <div class="tapteam" id="tap-h-${m.id}">
      ${flagImg(m.home, 'flag')}
      <span class="team-name">${teamName(m.home)}</span>
      <div class="balls" id="balls-h-${m.id}">${ballsHtml(hv)}</div>
    </div>
    <div class="mrow-mid">
      <div class="tap-score"><span id="ph-${m.id}">${hv}</span> – <span id="pa-${m.id}">${av}</span></div>
      <div class="mrow-time ${p ? 'saved' : ''}" id="hint-${m.id}">${p ? '✓ saved' : timeShort(m.kickoff)}</div>
    </div>
    <div class="tapteam" id="tap-a-${m.id}">
      ${flagImg(m.away, 'flag')}
      <span class="team-name">${teamName(m.away)}</span>
      <div class="balls" id="balls-a-${m.id}">${ballsHtml(av)}</div>
    </div>
  </div>`;
}

function ballsHtml(n) {
  if (!n) return `<span class="ball-hint">–</span>`;
  let s = '';
  for (let i = 0; i < n; i++) s += `<span class="ball${i === n - 1 ? ' pop' : ''}">⚽</span>`;
  return s;
}

function timeShort(iso) {
  const dt = new Date(iso), now = new Date();
  const t = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (dt.toDateString() === now.toDateString()) return `Today ${t}`;
  return `${dt.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${t}`;
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
    attachTap(document.getElementById('tap-h-' + id),
      () => bumpGoal(id, 'h', 1), () => setGoal(id, 'h', 0));
    attachTap(document.getElementById('tap-a-' + id),
      () => bumpGoal(id, 'a', 1), () => setGoal(id, 'a', 0));
  });

  startLiveEngine();
}

/* tap = onTap; long-press (500ms) = onHold */
function attachTap(el, onTap, onHold) {
  if (!el) return;
  let held = false, timer = null;
  const start = () => { held = false; timer = setTimeout(() => { held = true; onHold(); }, 500); };
  const cancel = () => { if (timer) clearTimeout(timer); };
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', cancel);
  el.addEventListener('touchmove', cancel, { passive: true });
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', cancel);
  el.addEventListener('mouseleave', cancel);
  el.addEventListener('click', () => { if (!held) onTap(); });
}

function bumpGoal(id, side, delta) {
  const span = document.getElementById((side === 'h' ? 'ph-' : 'pa-') + id);
  const v = Math.max(0, Math.min(20, parseInt(span.textContent || '0', 10) + delta));
  applyGoal(id, side, v);
}
function setGoal(id, side, v) { applyGoal(id, side, v); }

function applyGoal(id, side, v) {
  document.getElementById((side === 'h' ? 'ph-' : 'pa-') + id).textContent = v;
  document.getElementById('balls-' + side + '-' + id).innerHTML = ballsHtml(v);
  autoSaveTap(id);
}

function autoSaveTap(id) {
  const hint = document.getElementById('hint-' + id);
  hint.textContent = 'saving…'; hint.className = 'mrow-time';
  clearTimeout(tapSaveTimers[id]);
  tapSaveTimers[id] = setTimeout(async () => {
    const h = document.getElementById('ph-' + id).textContent;
    const a = document.getElementById('pa-' + id).textContent;
    const ok = await setPrediction(id, h, a);
    hint.textContent = ok ? '✓ saved' : 'not saved';
    hint.className = 'mrow-time ' + (ok ? 'saved' : 'err');
    updateScoreStrip();
  }, 500);
}
