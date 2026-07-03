/* ============================================================================
   MOCK DATA  —  World Cup 2026 (placeholder)
   ----------------------------------------------------------------------------
   This is fake demo data so we can see the website working before we connect
   a real football data API. Nothing here is live yet. Every match, score and
   bracket slot below is invented for the demo.

   Flags come from flagcdn.com using 2-letter country codes (ISO 3166-1),
   e.g. "br" = Brazil, "gb-eng" = England.
   ========================================================================== */

const TEAMS = {
  ARG: { name: 'Argentina',   flag: 'ar' },
  FRA: { name: 'France',      flag: 'fr' },
  BRA: { name: 'Brazil',      flag: 'br' },
  ENG: { name: 'England',     flag: 'gb-eng' },
  ESP: { name: 'Spain',       flag: 'es' },
  POR: { name: 'Portugal',    flag: 'pt' },
  NED: { name: 'Netherlands', flag: 'nl' },
  GER: { name: 'Germany',     flag: 'de' },
  CRO: { name: 'Croatia',     flag: 'hr' },
  MAR: { name: 'Morocco',     flag: 'ma' },
  USA: { name: 'USA',         flag: 'us' },
  MEX: { name: 'Mexico',      flag: 'mx' },
  URU: { name: 'Uruguay',     flag: 'uy' },
  COL: { name: 'Colombia',    flag: 'co' },
  BEL: { name: 'Belgium',     flag: 'be' },
  JPN: { name: 'Japan',       flag: 'jp' },
};

/* Helper to build ISO datetimes near "today" (2026-07-03) for the demo. */
function d(day, hour, min) {
  return new Date(2026, 6, day, hour, min).toISOString(); // month 6 = July
}

/* Match statuses: 'finished' | 'live' | 'upcoming' */
const MATCHES = [
  // ---- Already finished (Round of 16) ----
  {
    id: 'm1', stage: 'Round of 16', status: 'finished',
    home: 'ARG', away: 'JPN', kickoff: d(2, 18, 0),
    homeScore: 2, awayScore: 1,
  },
  {
    id: 'm2', stage: 'Round of 16', status: 'finished',
    home: 'FRA', away: 'MAR', kickoff: d(2, 21, 0),
    homeScore: 0, awayScore: 0, penalties: { home: 4, away: 3 },
  },

  // ---- LIVE right now (scripted demo timeline, see LIVE_TIMELINE) ----
  {
    id: 'm3', stage: 'Round of 16', status: 'live',
    home: 'ESP', away: 'CRO', kickoff: d(3, 17, 0),
    homeScore: 0, awayScore: 0, minute: 0,
  },

  // ---- Upcoming (the "next matches") ----
  {
    id: 'm4', stage: 'Round of 16', status: 'upcoming',
    home: 'ENG', away: 'COL', kickoff: d(3, 21, 0),
  },
  {
    id: 'm5', stage: 'Round of 16', status: 'upcoming',
    home: 'BRA', away: 'MEX', kickoff: d(4, 18, 0),
  },
  {
    id: 'm6', stage: 'Round of 16', status: 'upcoming',
    home: 'POR', away: 'USA', kickoff: d(4, 21, 0),
  },
  {
    id: 'm7', stage: 'Round of 16', status: 'upcoming',
    home: 'NED', away: 'URU', kickoff: d(5, 18, 0),
  },
  {
    id: 'm8', stage: 'Round of 16', status: 'upcoming',
    home: 'GER', away: 'BEL', kickoff: d(5, 21, 0),
  },
];

/* Scripted "live" timeline for the ESP vs CRO match (m3).
   The live engine plays these in order to demonstrate goals, cards, and a
   VAR-disallowed goal that makes the score go BACK — like Google's live score.
   `at` = seconds after you open the page (fast demo clock).            */
const LIVE_TIMELINE = [
  { at: 2,  minute: 12, type: 'goal',      team: 'home', player: 'Oyarzabal',  score: [1, 0] },
  { at: 7,  minute: 26, type: 'yellow',    team: 'away', player: 'Modrić' },
  { at: 12, minute: 34, type: 'goal',      team: 'away', player: 'Kramarić',   score: [1, 1] },
  { at: 18, minute: 41, type: 'goal-var',  team: 'home', player: 'Williams',   note: 'Goal ruled out — offside (VAR)', score: [1, 1] },
  { at: 24, minute: 58, type: 'goal',      team: 'home', player: 'Pedri',      score: [2, 1] },
  { at: 30, minute: 67, type: 'red',       team: 'away', player: 'Gvardiol' },
  { at: 36, minute: 79, type: 'goal',      team: 'home', player: 'Yamal',      score: [3, 1] },
];

/* Knockout bracket. Each slot references a team code, or null if undecided.
   'winner' marks who advanced (for greying out the loser).                */
const BRACKET = {
  'Round of 16': [
    { home: 'ARG', away: 'JPN', winner: 'ARG' },
    { home: 'FRA', away: 'MAR', winner: 'FRA' },
    { home: 'ESP', away: 'CRO', winner: null },   // live
    { home: 'ENG', away: 'COL', winner: null },
    { home: 'BRA', away: 'MEX', winner: null },
    { home: 'POR', away: 'USA', winner: null },
    { home: 'NED', away: 'URU', winner: null },
    { home: 'GER', away: 'BEL', winner: null },
  ],
  'Quarter-finals': [
    { home: 'ARG', away: null, winner: null },
    { home: 'FRA', away: null, winner: null },
    { home: null,  away: null, winner: null },
    { home: null,  away: null, winner: null },
  ],
  'Semi-finals': [
    { home: null, away: null, winner: null },
    { home: null, away: null, winner: null },
  ],
  'Final': [
    { home: null, away: null, winner: null },
  ],
};

const FLAG_BASE = 'https://flagcdn.com';
function flagUrl(code, w = 80) {
  const t = TEAMS[code];
  if (!t) return '';
  return `${FLAG_BASE}/w${w}/${t.flag}.png`;
}
function teamName(code) { return TEAMS[code] ? TEAMS[code].name : 'TBD'; }

/* Flag <img> with a graceful fallback: if the image can't load, a small
   coloured badge with the 3-letter team code is shown instead, so a country
   is always visually identified. */
function flagImg(code, cls, w = 80) {
  if (!TEAMS[code]) return `<span class="flag-fallback ${cls}">?</span>`;
  return `<img class="${cls}" src="${flagUrl(code, w)}" alt="${teamName(code)} flag"
      loading="lazy"
      onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'">` +
    `<span class="flag-fallback ${cls}" style="display:none">${code}</span>`;
}
