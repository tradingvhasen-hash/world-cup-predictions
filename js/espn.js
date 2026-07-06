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
  injectDemoMatch();
  matchesLoaded = true;
  matchesError = false;
}

/* ---------- hidden demo mode (?demo in the URL) ----------
   Shows a fake live match with a full set of events so the live design can
   be previewed even when no real match is being played. */
const WC_DEMO = /[?&#]demo/.test(window.location.search + window.location.hash);

const DEMO_EVENTS = [
  { minute: "76'", typeText: 'Substitution', text: 'Substitution, Spain. Fermín López replaces Pedri.', side: 'away' },
  { minute: "71'", typeText: 'Goal', text: 'Goal! Portugal 2, Spain 1. Cristiano Ronaldo (Portugal) converts the penalty with a right footed shot to the bottom left corner.', side: 'home' },
  { minute: "70'", typeText: 'Yellow Card', text: 'Marc Cucurella (Spain) is shown the yellow card for a bad foul.', side: 'away' },
  { minute: "64'", typeText: 'Video Review', text: 'VAR Decision: No penalty to Spain after review.', side: 'away' },
  { minute: "58'", typeText: 'Goal', text: 'Goal! Portugal 1, Spain 1. Lamine Yamal (Spain) left footed shot from outside the box to the top right corner.', side: 'away' },
  { minute: "46'", typeText: 'Start 2nd Half', text: 'Start 2nd Half', side: null },
  { minute: "45'", typeText: 'Halftime', text: 'Halftime', side: null },
  { minute: "33'", typeText: 'Red Card', text: 'Robin Le Normand (Spain) is shown the red card.', side: 'away' },
  { minute: "21'", typeText: 'Goal', text: 'Goal! Portugal 1, Spain 0. Bruno Fernandes (Portugal) right footed shot from the centre of the box.', side: 'home' },
  { minute: "1'", typeText: 'Kickoff', text: 'Kickoff', side: null },
];

function injectDemoMatch() {
  if (!WC_DEMO) return;
  const withLogo = Object.keys(TEAMS).filter(c => TEAMS[c].logo);
  const h = withLogo.includes('POR') ? 'POR' : withLogo[0];
  const a = withLogo.includes('ESP') ? 'ESP' : withLogo[1] || withLogo[0];
  if (!h || !a) return;
  MATCHES.unshift({
    id: 'demo1', status: 'live', home: h, away: a,
    kickoff: new Date(Date.now() - 78 * 60000).toISOString(),
    homeScore: 2, awayScore: 1, minute: "78'", statusDetail: "78'",
    stage: 'FIFA World Cup',
  });
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

/* Low-value event types we hide from the feed (keep goals/cards/subs/VAR). */
function isNoiseEvent(e) {
  const t = (e.typeText || '').toLowerCase();
  const x = (e.text || '').toLowerCase();
  return t.includes('delay') || x.includes('delay') || x.includes('drinks break');
}

/* Per-match live events (goals, cards, subs, VAR) newest-first, noise removed. */
async function espnFetchEvents(eventId) {
  if (eventId === 'demo1') return DEMO_EVENTS.slice();
  try {
    const res = await fetch(`${ESPN_BASE}/summary?event=${eventId}`);
    if (!res.ok) return [];
    const j = await res.json();
    const homeId = espnHomeTeamId(j);
    const ke = (j.keyEvents || []).map((e) => ({
      minute: (e.clock && e.clock.displayValue) || '',
      typeText: (e.type && e.type.text) || '',
      text: e.text || '',
      side: e.team ? (String(e.team.id) === homeId ? 'home' : 'away') : null,
    })).filter((e) => !isNoiseEvent(e));
    return ke.reverse();  // newest first
  } catch (e) {
    return [];
  }
}

/* ---------- knockout bracket data ----------
   Fixed window covering the whole 2026 knockout stage (R32 → Final).
   Returns matches sorted by kickoff; classification into rounds is by count:
   16 R32, 8 R16, 4 QF, 2 SF, then 3rd-place match, then the Final. */
const KO_DATES = '20260628-20260721';

async function espnFetchKnockout() {
  const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${KO_DATES}`);
  if (!res.ok) throw new Error('ESPN knockout ' + res.status);
  const j = await res.json();
  const list = (j.events || []).map((ev) => {
    const c = ev.competitions[0];
    const H = c.competitors.find((x) => x.homeAway === 'home');
    const A = c.competitors.find((x) => x.homeAway === 'away');
    const note = (c.notes && c.notes[0] && c.notes[0].headline) || '';
    return {
      id: String(ev.id),
      date: ev.date,
      state: ev.status.type.state,               // pre | in | post
      home: registerTeam(H.team), away: registerTeam(A.team),
      homeName: H.team.displayName, awayName: A.team.displayName,
      homeReal: !!teamLogo(H.team), awayReal: !!teamLogo(A.team),
      homeScore: Number(H.score), awayScore: Number(A.score),
      homeWin: H.winner === true, awayWin: A.winner === true,
      note,
    };
  }).sort((a, b) => new Date(a.date) - new Date(b.date));
  return list;
}

function espnHomeTeamId(summary) {
  const comps = summary.header && summary.header.competitions && summary.header.competitions[0];
  const c = comps && comps.competitors && comps.competitors.find((x) => x.homeAway === 'home');
  return c ? String(c.team.id) : '';
}

/* Starting lineups + subs for a match, split into home/away with formation. */
async function espnFetchLineups(eventId) {
  try {
    const res = await fetch(`${ESPN_BASE}/summary?event=${eventId}`);
    if (!res.ok) return null;
    const j = await res.json();
    const homeId = espnHomeTeamId(j);
    const out = { home: null, away: null };
    (j.rosters || []).forEach((r) => {
      const side = String((r.team && r.team.id)) === homeId ? 'home' : 'away';
      const players = (r.roster || []).map((p) => ({
        name: (p.athlete && p.athlete.displayName) || '',
        jersey: p.jersey || '',
        pos: (p.position && p.position.abbreviation) || '',
        starter: !!p.starter,
      }));
      out[side] = {
        teamName: (r.team && r.team.displayName) || '',
        code: r.team ? registerTeam(r.team) : '',
        formation: r.formation || '',
        starters: players.filter((p) => p.starter),
        subs: players.filter((p) => !p.starter),
      };
    });
    return (out.home && out.away) ? out : null;
  } catch (e) {
    return null;
  }
}
