/* ============================================================================
   ESPN  —  free live World Cup data (fixtures, scores, live events, lineups)
   ----------------------------------------------------------------------------
   ESPN's public site API returns real FIFA World Cup data and allows direct
   browser access (CORS *), with no API key. We read the scoreboard for a date
   window around "now", map it into MATCHES/TEAMS, and poll it while a match is
   live. Per-match detail (goal/card/sub events, lineups) comes from /summary.

   This is an unofficial endpoint (the one ESPN's own site uses). It's free and
   works well, but could change one day — if it does, this file is where we fix.
   ========================================================================== */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

let matchesLoaded = false;
let matchesError = false;

/* A YYYYMMDD-YYYYMMDD window: two weeks back to a month ahead, so we catch
   recent results, live games, and upcoming fixtures in one request. */
function espnDateRange() {
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - 14);
  const to = new Date(now);   to.setDate(to.getDate() + 30);
  return `${fmt(from)}-${fmt(to)}`;
}

/* Fetch the scoreboard and (re)populate MATCHES + TEAMS in place. */
async function refreshMatches() {
  const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${espnDateRange()}`);
  if (!res.ok) throw new Error('ESPN scoreboard ' + res.status);
  ingestScoreboard(await res.json());
  matchesLoaded = true;
  matchesError = false;
}

function mapState(state) {
  return state === 'in' ? 'live' : state === 'post' ? 'finished' : 'upcoming';
}

function ingestScoreboard(json) {
  const out = [];
  (json.events || []).forEach((ev) => {
    const comp = ev.competitions && ev.competitions[0];
    if (!comp || !comp.competitors) return;
    const H = comp.competitors.find((c) => c.homeAway === 'home');
    const A = comp.competitors.find((c) => c.homeAway === 'away');
    if (!H || !A) return;

    const hc = registerTeam(H.team);
    const ac = registerTeam(A.team);
    const state = ev.status && ev.status.type && ev.status.type.state;

    out.push({
      id: String(ev.id),
      status: mapState(state),
      home: hc,
      away: ac,
      kickoff: ev.date,
      homeScore: state === 'pre' ? undefined : Number(H.score),
      awayScore: state === 'pre' ? undefined : Number(A.score),
      minute: (ev.status && ev.status.displayClock) || '',
      statusDetail: (ev.status && ev.status.type && (ev.status.type.shortDetail || ev.status.type.detail)) || '',
      stage: roundLabel(ev, comp),
    });
  });

  out.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  MATCHES.length = 0;
  out.forEach((m) => MATCHES.push(m));
}

function roundLabel(ev, comp) {
  const note = comp.notes && comp.notes[0] && comp.notes[0].headline;
  return note || 'FIFA World Cup';
}

/* True only for matches whose two teams are known (real crests) — used to hide
   placeholder future-round fixtures like "Semifinal 1 Winner". */
function hasRealTeams(m) {
  const h = TEAMS[m.home], a = TEAMS[m.away];
  return !!(h && h.logo && a && a.logo);
}

/* Per-match live events (goals, cards, subs...) newest-first, capped. */
async function espnFetchEvents(eventId) {
  try {
    const res = await fetch(`${ESPN_BASE}/summary?event=${eventId}`);
    if (!res.ok) return [];
    const j = await res.json();
    const ke = (j.keyEvents || []).map((e) => ({
      minute: (e.clock && e.clock.displayValue) || '',
      typeText: (e.type && e.type.text) || '',
      text: e.text || '',
    }));
    return ke.reverse();  // newest first
  } catch (e) {
    return [];
  }
}
