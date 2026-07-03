/* ============================================================================
   STORE  —  saves the user's predictions in the browser (localStorage)
   ----------------------------------------------------------------------------
   For now there is NO sign-in and NO server, so predictions live only on this
   device/browser. When we add accounts + a database later, this same interface
   ("getPrediction / setPrediction / allPredictions") will talk to the server
   instead — the rest of the app won't need to change.

   Scoring rules:
     • Correct winner (or draw)  = 1 point
     • Exact final score         = 3 points
   ========================================================================== */

const STORE_KEY = 'wc_predictions_v1';

function loadPredictions() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch (e) { return {}; }
}
function savePredictions(obj) {
  localStorage.setItem(STORE_KEY, JSON.stringify(obj));
}

function getPrediction(matchId) {
  return loadPredictions()[matchId] || null;
}
function setPrediction(matchId, home, away) {
  const all = loadPredictions();
  all[matchId] = { home: Number(home), away: Number(away) };
  savePredictions(all);
}
function allPredictions() { return loadPredictions(); }

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
  const preds = loadPredictions();
  let total = 0;
  MATCHES.forEach(m => {
    const p = preds[m.id];
    if (p) total += scorePrediction(p, m).points;
  });
  return total;
}
