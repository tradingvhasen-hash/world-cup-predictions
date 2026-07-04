/* ============================================================================
   HOME — focused, calm.
   · If a match is live: it is the hero (big score, minute, quiet feed).
   · Otherwise the NEXT match is the hero: big flags, tap a flag to add a goal,
     tap a number to undo. Auto-saves, locks at kick-off.
   · Two more upcoming matches follow as quiet rows.
   · Results & further fixtures live on their own page (menu → Results).
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

  let html = `<div class="page home-page">`;

  if (live.length) {
    // Live takes the hero; the next match to predict follows, compact.
    html += liveHero(live[0]);
    live.slice(1).forEach(m => { html += `<div class="group" style="margin-top:10px">${liveRowCompact(m)}</div>`; });
    const nextUp = upcoming.slice(0, 3);
    if (nextUp.length) {
      html += `<h2 class="glabel">Up next</h2>`;
      html += `<div class="group">${nextUp.map(predictRowCompact).join('')}</div>`;
    }
  } else if (upcoming.length) {
    html += predictHero(upcoming[0]);
    const more = upcoming.slice(1, 3);
    if (more.length) {
      html += `<h2 class="glabel">After that</h2>`;
      html += `<div class="group">${more.map(predictRowCompact).join('')}</div>`;
    }
  } else {
    html += `<p class="muted" style="margin-top:40px; text-align:center">No matches right now.</p>`;
  }

  html += `</div>`;
  return html;
}

/* ---------- heroes ---------- */
function predictHero(m) {
  const p = getPrediction(m.id);
  const hv = p ? p.home : 0;
  const av = p ? p.away : 0;
  return `<section class="hero" data-predict="${m.id}">
    <div class="hero-date">${fmtDate(m.kickoff)}</div>
    <div class="hero-grid">
      ${heroTeam(m.id, m.home, 'h')}
      <div class="hero-mid">
        <div class="hero-score">
          <button class="gnum" id="ph-${m.id}" type="button" aria-label="Remove a goal">${hv}</button>
          <span class="gdash">–</span>
          <button class="gnum" id="pa-${m.id}" type="button" aria-label="Remove a goal">${av}</button>
        </div>
        <div class="hero-sub">
          <span class="cd" data-kickoff="${m.kickoff}"></span>
          <span class="save-flash" id="sf-${m.id}">Saved</span>
        </div>
      </div>
      ${heroTeam(m.id, m.away, 'a')}
    </div>
    <div class="hero-hint">Tap a flag to add a goal · tap a number to undo</div>
  </section>`;
}

function heroTeam(id, code, side) {
  return `<button class="hero-team" id="flag-${side}-${id}" type="button"
    aria-label="Add goal for ${teamName(code)}">
    ${flagImg(code, 'flag')}<span>${teamName(code)}</span>
  </button>`;
}

function liveHero(m) {
  return `<section class="hero" id="live-${m.id}">
    <div class="live-pill"><span class="live-dot"></span>LIVE</div>
    <div class="hero-grid">
      <div class="hero-team">${flagImg(m.home, 'flag')}<span>${teamName(m.home)}</span></div>
      <div class="hero-mid">
        <div class="hero-score static"><span id="hs-${m.id}">${m.homeScore ?? 0}</span><span class="gdash">–</span><span id="as-${m.id}">${m.awayScore ?? 0}</span></div>
        <div class="hero-sub"><span class="min" id="min-${m.id}">${m.minute || ''}</span></div>
      </div>
      <div class="hero-team">${flagImg(m.away, 'flag')}<span>${teamName(m.away)}</span></div>
    </div>
    <div class="event-feed" id="feed-${m.id}"></div>
  </section>`;
}

/* extra live matches beyond the first, as one-line rows */
function liveRowCompact(m) {
  return `<div class="grow live" id="live-${m.id}">
    <div class="gteam">${flagImg(m.home, 'flag')}<span>${teamName(m.home)}</span></div>
    <div class="gmid">
      <div class="gscore"><span id="hs-${m.id}">${m.homeScore ?? 0}</span>–<span id="as-${m.id}">${m.awayScore ?? 0}</span></div>
      <div class="g-sub"><span class="min" id="min-${m.id}">${m.minute || 'LIVE'}</span></div>
    </div>
    <div class="gteam right"><span>${teamName(m.away)}</span>${flagImg(m.away, 'flag')}</div>
  </div>
  <div class="event-feed" id="feed-${m.id}"></div>`;
}

/* compact predictable row (same interaction as the hero) */
function predictRowCompact(m) {
  const p = getPrediction(m.id);
  const hv = p ? p.home : 0;
  const av = p ? p.away : 0;
  return `<div class="grow" data-predict="${m.id}">
    <button class="gteam" id="flag-h-${m.id}" type="button" aria-label="Add goal for ${teamName(m.home)}">
      ${flagImg(m.home, 'flag')}<span>${teamName(m.home)}</span>
    </button>
    <div class="gmid">
      <div class="gscore pred">
        <button class="gnum" id="ph-${m.id}" type="button" aria-label="Remove a goal">${hv}</button><span class="gdash">–</span><button class="gnum" id="pa-${m.id}" type="button" aria-label="Remove a goal">${av}</button>
      </div>
      <div class="g-sub">
        <span class="cd" data-kickoff="${m.kickoff}"></span>
        <span class="save-flash" id="sf-${m.id}">Saved</span>
      </div>
    </div>
    <button class="gteam right" id="flag-a-${m.id}" type="button" aria-label="Add goal for ${teamName(m.away)}">
      <span>${teamName(m.away)}</span>${flagImg(m.away, 'flag')}
    </button>
  </div>`;
}

/* ---------- wire up ---------- */
let tapSaveTimers = {};

function bindHome() {
  if (!matchesLoaded) {
    const retry = document.getElementById('retry-load');
    if (retry) retry.addEventListener('click', () => { matchesError = false; navigate('home'); });
    refreshMatches().then(() => navigate('home')).catch(() => { matchesError = true; navigate('home'); });
    return;
  }

  document.querySelectorAll('[data-predict]').forEach(el => {
    const id = el.getAttribute('data-predict');
    const fh = document.getElementById('flag-h-' + id);
    const fa = document.getElementById('flag-a-' + id);
    if (fh) fh.addEventListener('click', () => bumpGoal(id, 'h', 1));
    if (fa) fa.addEventListener('click', () => bumpGoal(id, 'a', 1));
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
  void el.offsetWidth;
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
  el._t = setTimeout(() => el.classList.remove('show'), 1100);
}
