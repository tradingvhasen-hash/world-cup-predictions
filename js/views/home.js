/* ============================================================================
   HOME VIEW
   - Live matches (only while a game is being played)
   - "Next up": next 3 matches — tap a flag to add a goal, tap the dots to
     remove one; auto-saves and locks at kick-off. Countdown shows as a small
     pill on the card's top edge.
   - "Later": further fixtures (not yet predictable)
   - "Results": finished matches
   Hints are shown as small "?" tooltips, not full lines.
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
    html += sectionTitle(`<span class="live-dot"></span>Live`);
    html += live.map(liveRow).join('');
  }

  html += sectionTitle('Next up', 'Tap a flag to add a goal, tap the dots under it to remove one. Predictions lock when the match kicks off.');
  html += predictable.length ? predictable.map(predictRow).join('')
                             : `<p class="muted">No matches open for prediction right now.</p>`;

  if (later.length) {
    html += sectionTitle('Later', 'These open for prediction closer to kick-off. Check back then.');
    html += later.map(laterRow).join('');
  }

  if (finished.length) {
    html += sectionTitle('Results');
    html += finished.map(resultRow).join('');
  }

  html += `</div>`;
  return html;
}

function sectionTitle(label, tipText) {
  const tip = tipText ? ` <button class="tip" type="button">?<span class="tip-bubble">${tipText}</span></button>` : '';
  return `<h2 class="section-title">${label}${tip}</h2>`;
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

function laterRow(m) {
  return `<div class="mrow later">
    <div class="cd-pill" data-kickoff="${m.kickoff}"></div>
    ${sideTeam(m.home, false)}
    <div class="mrow-mid"><div class="later-lock">🔒</div></div>
    ${sideTeam(m.away, true)}
  </div>`;
}

/* ---- upcoming: tap-a-flag prediction ---- */
function predictRow(m) {
  const p = getPrediction(m.id);
  const hv = p ? p.home : 0;
  const av = p ? p.away : 0;
  return `<div class="mrow predict" data-match="${m.id}">
    <div class="cd-pill" data-kickoff="${m.kickoff}"></div>
    ${tapTeam(m.id, m.home, 'h', hv, false)}
    <div class="mrow-mid">
      <div class="tap-score"><span id="ph-${m.id}">${hv}</span> – <span id="pa-${m.id}">${av}</span></div>
      <span class="save-flash" id="sf-${m.id}">✓ saved</span>
    </div>
    ${tapTeam(m.id, m.away, 'a', av, true)}
  </div>`;
}

function tapTeam(id, code, side, val, right) {
  const flag = `<button class="tapflag" id="flag-${side}-${id}" type="button" aria-label="Add goal for ${teamName(code)}">${flagImg(code, 'flag')}</button>`;
  const name = `<span class="team-name">${teamName(code)}</span>`;
  const pips = `<button class="pips" id="pips-${side}-${id}" type="button" aria-label="Remove a goal">${pipsHtml(val)}</button>`;
  return `<div class="tapteam${right ? ' right' : ''}">${flag}${name}${pips}</div>`;
}

function pipsHtml(n) {
  if (!n) return '';
  let s = '';
  for (let i = 0; i < n; i++) s += `<span class="pip${i === n - 1 ? ' pop' : ''}"></span>`;
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
    document.getElementById('pips-h-' + id).addEventListener('click', () => bumpGoal(id, 'h', -1));
    document.getElementById('pips-a-' + id).addEventListener('click', () => bumpGoal(id, 'a', -1));
  });

  updateScoreStrip();
  startLiveEngine();
  startCountdowns();
}

function bumpGoal(id, side, delta) {
  const span = document.getElementById((side === 'h' ? 'ph-' : 'pa-') + id);
  const v = Math.max(0, Math.min(20, parseInt(span.textContent || '0', 10) + delta));
  span.textContent = v;
  document.getElementById('pips-' + side + '-' + id).innerHTML = pipsHtml(v);
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
