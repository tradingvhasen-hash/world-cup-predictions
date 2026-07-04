/* ============================================================================
   HOME VIEW — one strict visual grammar for everything.
   Each section is ONE grouped card (iOS inset-list style). Every match is one
   row on a fixed 3-column grid:  [team] [centre] [team].
   Only the centre changes:
     live     → score + minute
     predict  → tappable prediction numbers + countdown
     coming   → countdown only (dimmed row)
     result   → final score + FT (winner bold)
   Predict: tap a team to add a goal, tap a number to remove one. Auto-saves,
   locks at kick-off.
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
    html += glabel('Live', null, true);
    html += `<div class="group">${live.map(liveRow).join('')}</div>`;
  }

  html += glabel('Predict now', 'Tap a team to add a goal. Tap a number to remove one. Predictions lock at kick-off.');
  html += predictable.length
    ? `<div class="group">${predictable.map(predictRow).join('')}</div>`
    : `<p class="muted">No matches open for prediction right now.</p>`;

  if (later.length) {
    html += glabel('Coming up', 'These open for prediction closer to kick-off.');
    html += `<div class="group">${later.map(laterRow).join('')}</div>`;
  }

  if (finished.length) {
    html += glabel('Results');
    html += `<div class="group">${finished.map(resultRow).join('')}</div>`;
  }

  html += `</div>`;
  return html;
}

/* ---- section label (tiny caps, optional "?" tooltip) ---- */
function glabel(text, tipText, liveDot) {
  const tip = tipText ? `<button class="tip" type="button">?<span class="tip-bubble">${tipText}</span></button>` : '';
  return `<h2 class="glabel">${liveDot ? '<span class="live-dot"></span>' : ''}${text}${tip}</h2>`;
}

/* ---- team cell (fixed grammar, both sides) ---- */
function gteam(code, right, cls, nameCls) {
  return `<div class="gteam${right ? ' right' : ''}${cls ? ' ' + cls : ''}">
    ${right ? `<span class="${nameCls || ''}">${teamName(code)}</span>${flagImg(code, 'flag')}`
            : `${flagImg(code, 'flag')}<span class="${nameCls || ''}">${teamName(code)}</span>`}
  </div>`;
}

/* ---- rows ---- */
function liveRow(m) {
  return `<div class="grow live" id="live-${m.id}">
      ${gteam(m.home, false)}
      <div class="gmid">
        <div class="gscore"><span id="hs-${m.id}">${m.homeScore ?? 0}</span>–<span id="as-${m.id}">${m.awayScore ?? 0}</span></div>
        <div class="g-sub"><span class="min" id="min-${m.id}">${m.minute || 'LIVE'}</span></div>
      </div>
      ${gteam(m.away, true)}
    </div>
    <div class="event-feed" id="feed-${m.id}"></div>`;
}

function resultRow(m) {
  const hWin = m.homeScore > m.awayScore, aWin = m.awayScore > m.homeScore;
  return `<div class="grow">
    ${gteam(m.home, false, '', hWin ? 'res-win' : aWin ? 'res-lose' : '')}
    <div class="gmid">
      <div class="gscore">${m.homeScore}–${m.awayScore}</div>
      <div class="g-sub">FT</div>
    </div>
    ${gteam(m.away, true, '', aWin ? 'res-win' : hWin ? 'res-lose' : '')}
  </div>`;
}

function laterRow(m) {
  return `<div class="grow later">
    ${gteam(m.home, false)}
    <div class="gmid">
      <div class="g-cd cd" data-kickoff="${m.kickoff}"></div>
    </div>
    ${gteam(m.away, true)}
  </div>`;
}

function predictRow(m) {
  const p = getPrediction(m.id);
  const hv = p ? p.home : 0;
  const av = p ? p.away : 0;
  return `<div class="grow predict" data-match="${m.id}">
    <button class="gteam tap" id="flag-h-${m.id}" type="button" aria-label="Add goal for ${teamName(m.home)}">
      ${flagImg(m.home, 'flag')}<span>${teamName(m.home)}</span>
    </button>
    <div class="gmid">
      <div class="gscore pred">
        <button class="gnum" id="ph-${m.id}" type="button" aria-label="Remove a goal">${hv}</button><span class="gdash">–</span><button class="gnum" id="pa-${m.id}" type="button" aria-label="Remove a goal">${av}</button>
      </div>
      <div class="g-sub">
        <span class="cd" data-kickoff="${m.kickoff}"></span>
        <span class="save-flash" id="sf-${m.id}">✓ saved</span>
      </div>
    </div>
    <button class="gteam right tap" id="flag-a-${m.id}" type="button" aria-label="Add goal for ${teamName(m.away)}">
      <span>${teamName(m.away)}</span>${flagImg(m.away, 'flag')}
    </button>
  </div>`;
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

  document.querySelectorAll('.grow.predict').forEach(row => {
    const id = row.getAttribute('data-match');
    document.getElementById('flag-h-' + id).addEventListener('click', () => bumpGoal(id, 'h', 1));
    document.getElementById('flag-a-' + id).addEventListener('click', () => bumpGoal(id, 'a', 1));
    document.getElementById('ph-' + id).addEventListener('click', () => bumpGoal(id, 'h', -1));
    document.getElementById('pa-' + id).addEventListener('click', () => bumpGoal(id, 'a', -1));
  });

  updateScoreStrip();
  startLiveEngine();
  startCountdowns();
}

function bumpGoal(id, side, delta) {
  const el = document.getElementById((side === 'h' ? 'ph-' : 'pa-') + id);
  const v = Math.max(0, Math.min(20, parseInt(el.textContent || '0', 10) + delta));
  el.textContent = v;
  el.classList.remove('bump');
  void el.offsetWidth;              // restart the pop animation
  el.classList.add('bump');
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
  el._t = setTimeout(() => el.classList.remove('show'), 1200);
}
