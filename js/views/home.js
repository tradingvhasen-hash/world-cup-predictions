/* ============================================================================
   HOME — display only. (Predicting now lives in the Bracket.)
   · Live match = hero with score, minute, quiet feed.
   · Otherwise the next match is the hero with a countdown.
   · A couple more fixtures follow, read-only.
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
    html += liveHero(live[0]);
    live.slice(1).forEach(m => { html += `<div class="group" style="margin-top:10px">${liveRowCompact(m)}</div>`; });
    const next = upcoming.slice(0, 3);
    if (next.length) {
      html += `<h2 class="glabel">Up next</h2>`;
      html += `<div class="group">${next.map(fixtureRow).join('')}</div>`;
    }
  } else if (upcoming.length) {
    html += nextHero(upcoming[0]);
    const more = upcoming.slice(1, 3);
    if (more.length) {
      html += `<h2 class="glabel">After that</h2>`;
      html += `<div class="group">${more.map(fixtureRow).join('')}</div>`;
    }
  } else {
    html += `<p class="muted" style="margin-top:40px; text-align:center">No matches right now.</p>`;
  }

  html += `</div>`;
  return html;
}

function nextHero(m) {
  return `<section class="hero">
    <div class="hero-date">${fmtDate(m.kickoff)}</div>
    <div class="hero-grid">
      <div class="hero-team">${flagImg(m.home, 'flag')}<span>${teamName(m.home)}</span></div>
      <div class="hero-mid">
        <div class="hero-cdbig cd" data-kickoff="${m.kickoff}"></div>
        <div class="hero-sub">until kick-off</div>
      </div>
      <div class="hero-team">${flagImg(m.away, 'flag')}<span>${teamName(m.away)}</span></div>
    </div>
  </section>`;
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

function fixtureRow(m) {
  return `<div class="grow">
    <div class="gteam">${flagImg(m.home, 'flag')}<span>${teamName(m.home)}</span></div>
    <div class="gmid"><div class="g-cd cd" data-kickoff="${m.kickoff}"></div></div>
    <div class="gteam right"><span>${teamName(m.away)}</span>${flagImg(m.away, 'flag')}</div>
  </div>`;
}

function bindHome() {
  if (!matchesLoaded) {
    const retry = document.getElementById('retry-load');
    if (retry) retry.addEventListener('click', () => { matchesError = false; navigate('home'); });
    refreshMatches().then(() => navigate('home')).catch(() => { matchesError = true; navigate('home'); });
    return;
  }
  updateScoreStrip();
  startLiveEngine();
  startCountdowns();
}
