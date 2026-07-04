/* ============================================================================
   DATA  —  live state, filled from ESPN's free World Cup feed (see espn.js)
   ----------------------------------------------------------------------------
   TEAMS and MATCHES start empty and are populated at runtime by espn.js from
   ESPN's public scoreboard. Flags/crests are the team logo URLs ESPN provides.
   ========================================================================== */

const TEAMS = {};    // code -> { name, logo }
const MATCHES = [];  // populated from ESPN; each: { id, status, home, away,
                     // kickoff, homeScore, awayScore, minute, statusDetail, stage }

/* Build a short, stable code for a team from ESPN data. */
function teamCode(t) {
  const abbr = (t.abbreviation || t.displayName || t.name || 'TBD');
  return abbr.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'TBD';
}
function teamLogo(t) {
  return t.logo || (t.logos && t.logos[0] && t.logos[0].href) || '';
}

/* Remember a team (name + logo) so views can look it up by code. */
function registerTeam(t) {
  const code = teamCode(t);
  if (!TEAMS[code] || !TEAMS[code].logo) {
    TEAMS[code] = { name: t.displayName || t.name || code, logo: teamLogo(t) };
  }
  return code;
}

function teamName(code) { return TEAMS[code] ? TEAMS[code].name : 'TBD'; }

/* Flag/crest <img> with a graceful fallback badge (the team code) if the image
   is missing or fails to load. `w` is accepted for backwards compatibility. */
function flagImg(code, cls, w) {
  const t = TEAMS[code];
  if (t && t.logo) {
    return `<img class="${cls}" src="${t.logo}" alt="${t.name} flag" loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'">` +
      `<span class="flag-fallback ${cls}" style="display:none">${code.slice(0, 3)}</span>`;
  }
  return `<span class="flag-fallback ${cls}">${code.slice(0, 3)}</span>`;
}
