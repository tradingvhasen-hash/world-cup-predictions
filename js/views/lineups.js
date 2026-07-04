/* ============================================================================
   LINEUPS VIEW  —  starting XI + substitutes per match (real ESPN data)
   ========================================================================== */

let lineupMatchId = null;

function renderLineups() {
  if (!matchesLoaded) {
    return `<div class="page"><div class="loading">Loading…</div></div>`;
  }
  const options = MATCHES
    .filter(m => (m.status === 'live' || m.status === 'finished') && hasRealTeams(m))
    .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff))
    .slice(0, 20);

  if (!options.length) {
    return `<div class="page"><h2 class="section-title">Lineups</h2>
      <p class="muted">Lineups appear once a match is about to start or under way.</p></div>`;
  }
  if (!lineupMatchId || !options.find(o => o.id === lineupMatchId)) lineupMatchId = options[0].id;

  return `<div class="page">
    <h2 class="section-title">Lineups</h2>
    <select id="lineup-select" class="lineup-select">
      ${options.map(m => `<option value="${m.id}" ${m.id === lineupMatchId ? 'selected' : ''}>${teamName(m.home)} v ${teamName(m.away)}</option>`).join('')}
    </select>
    <div id="lineup-body"><div class="loading">Loading lineups…</div></div>
  </div>`;
}

function bindLineups() {
  if (!matchesLoaded) {
    refreshMatches().then(() => navigate('lineups')).catch(() => { matchesError = true; navigate('lineups'); });
    return;
  }
  const sel = document.getElementById('lineup-select');
  if (sel) sel.addEventListener('change', () => { lineupMatchId = sel.value; loadLineupBody(); });
  loadLineupBody();
}

async function loadLineupBody() {
  const body = document.getElementById('lineup-body');
  if (!body) return;
  body.innerHTML = `<div class="loading">Loading lineups…</div>`;
  const lu = await espnFetchLineups(lineupMatchId);
  if (!lu) { body.innerHTML = `<p class="muted">Lineups aren't available for this match yet.</p>`; return; }
  body.innerHTML = `<div class="lineups">${lineupCol(lu.home)}${lineupCol(lu.away)}</div>`;
}

function lineupCol(side) {
  return `<div class="lineup-col">
    <div class="lineup-team">${flagImg(side.code, 'flag-sm')} <span>${side.teamName}</span></div>
    ${side.formation ? `<div class="lineup-formation">${side.formation}</div>` : ''}
    <div class="lineup-h">Starting XI</div>
    ${side.starters.map(playerRow).join('')}
    ${side.subs.length ? `<div class="lineup-h">Substitutes</div>${side.subs.map(playerRow).join('')}` : ''}
  </div>`;
}

function playerRow(p) {
  return `<div class="player">
    <span class="p-num">${p.jersey || ''}</span>
    <span class="p-name">${p.name}</span>
    <span class="p-pos">${p.pos || ''}</span>
  </div>`;
}
