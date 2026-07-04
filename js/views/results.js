/* ============================================================================
   RESULTS — finished matches + the remaining fixture list.
   Same quiet row grammar as everywhere else.
   ========================================================================== */

function renderResults() {
  if (!matchesLoaded) {
    return `<div class="page"><div class="loading">Loading…</div></div>`;
  }

  const now = Date.now();
  const finished = MATCHES.filter(m => m.status === 'finished' && hasRealTeams(m))
                          .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff));
  const fixtures = MATCHES
    .filter(m => m.status === 'upcoming' && hasRealTeams(m) && new Date(m.kickoff).getTime() > now)
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
    .slice(0, 12);

  let html = `<div class="page">
    <h1 class="page-title">Results</h1>`;

  html += finished.length
    ? `<div class="group" style="margin-top:14px">${finished.map(resRow).join('')}</div>`
    : `<p class="muted">No finished matches yet.</p>`;

  if (fixtures.length) {
    html += `<h2 class="glabel">Fixtures</h2>`;
    html += `<div class="group">${fixtures.map(fixRow).join('')}</div>`;
  }

  html += `</div>`;
  return html;
}

function resRow(m) {
  const hWin = m.homeScore > m.awayScore, aWin = m.awayScore > m.homeScore;
  return `<div class="grow">
    <div class="gteam">${flagImg(m.home, 'flag')}<span class="${hWin ? 'res-win' : aWin ? 'res-lose' : ''}">${teamName(m.home)}</span></div>
    <div class="gmid">
      <div class="gscore">${m.homeScore}–${m.awayScore}</div>
      <div class="g-sub">${resDate(m.kickoff)}</div>
    </div>
    <div class="gteam right"><span class="${aWin ? 'res-win' : hWin ? 'res-lose' : ''}">${teamName(m.away)}</span>${flagImg(m.away, 'flag')}</div>
  </div>`;
}

function fixRow(m) {
  return `<div class="grow">
    <div class="gteam">${flagImg(m.home, 'flag')}<span>${teamName(m.home)}</span></div>
    <div class="gmid">
      <div class="g-sub" style="font-size:.7rem">${resDate(m.kickoff)}</div>
    </div>
    <div class="gteam right"><span>${teamName(m.away)}</span>${flagImg(m.away, 'flag')}</div>
  </div>`;
}

function resDate(iso) {
  const dt = new Date(iso), now = new Date();
  if (dt.toDateString() === now.toDateString())
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function bindResults() {
  if (!matchesLoaded) {
    refreshMatches().then(() => navigate('results')).catch(() => { matchesError = true; navigate('results'); });
  }
}
