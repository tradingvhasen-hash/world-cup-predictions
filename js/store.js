/* ============================================================================
   STORE  —  the signed-in user's predictions, saved in the Supabase database
   ----------------------------------------------------------------------------
   Predictions now live in the `predictions` table, tied to the user's account,
   so they follow the user on any device. To keep the views simple, we load the
   user's rows once after sign-in into an in-memory cache (`predCache`); the
   render code reads that cache synchronously, while saving writes through to
   the database.

   Scoring rules:
     • Correct winner (or draw)  = 1 point
     • Exact final score         = 3 points
   ========================================================================== */

/* In-memory copy of the signed-in user's predictions, keyed by match id.
   Shape: { m4: { home: 2, away: 1 }, ... } */
let predCache = {};

/* Load the current user's predictions from the database into predCache.
   Called once right after sign-in (see auth.js). */
async function loadPredictionsFromDb() {
  predCache = {};
  if (!sb || !currentUser) return;
  const { data, error } = await sb
    .from('predictions')
    .select('match_id, home_score, away_score')
    .eq('user_id', currentUser.id);
  if (error) { console.warn('Could not load predictions:', error.message); return; }
  data.forEach(r => { predCache[r.match_id] = { home: r.home_score, away: r.away_score }; });
}

/* Forget everything (used on sign-out so the next user starts clean). */
function clearPredictions() { predCache = {}; }

function getPrediction(matchId) { return predCache[matchId] || null; }
function allPredictions() { return predCache; }

/* Save/replace a prediction: update the cache immediately (so the UI feels
   instant), then write through to the database. Returns true on success. */
async function setPrediction(matchId, home, away) {
  const h = Number(home), a = Number(away);
  predCache[matchId] = { home: h, away: a };
  if (!sb || !currentUser) return false;
  const { error } = await sb.from('predictions').upsert({
    user_id: currentUser.id,
    match_id: matchId,
    home_score: h,
    away_score: a,
    updated_at: new Date().toISOString(),
  });
  if (error) { console.warn('Could not save prediction:', error.message); return false; }
  return true;
}

/* ---------- the user's saved bracket (permanent once saved) ---------- */
let userBracket = null;   // { picks:{eventId:teamCode}, saved_at } or null

async function loadBracketFromDb() {
  userBracket = null;
  if (!sb || !currentUser) return;
  const { data, error } = await sb.from('brackets')
    .select('picks, saved_at').eq('user_id', currentUser.id).maybeSingle();
  if (error) { console.warn('Could not load bracket:', error.message); return; }
  if (data) userBracket = { picks: data.picks || {}, saved_at: data.saved_at };
}

async function saveBracketToDb(picks) {
  if (!sb || !currentUser) return { ok: false, msg: 'You must be signed in.' };
  const { error } = await sb.from('brackets')
    .insert({ user_id: currentUser.id, picks });
  if (error) return { ok: false, msg: error.message };
  userBracket = { picks, saved_at: new Date().toISOString() };
  return { ok: true };
}

function clearBracket() { userBracket = null; }

/* Given a prediction and a finished match, return points + a verdict. */
function scorePrediction(pred, match) {
  if (!pred || match.status !== 'finished') return { points: 0, verdict: 'pending' };
  const exact = pred.home === match.homeScore && pred.away === match.awayScore;
  if (exact) return { points: 3, verdict: 'exact' };

  const predOutcome  = Math.sign(pred.home - pred.away);          // 1 / 0 / -1
  const realOutcome  = Math.sign(match.homeScore - match.awayScore);
  if (predOutcome === realOutcome) return { points: 1, verdict: 'winner' };
  return { points: 0, verdict: 'wrong' };
}

/* Total points across all finished matches. */
function totalScore() {
  let total = 0;
  MATCHES.forEach(m => {
    const p = predCache[m.id];
    if (p) total += scorePrediction(p, m).points;
  });
  return total;
}
