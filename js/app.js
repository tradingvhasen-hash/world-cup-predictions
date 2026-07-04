/* ============================================================================
   APP  —  navigation (hamburger menu), routing, and the live-score engine
   ========================================================================== */

/* ---------- date formatting ---------- */
function fmtDate(iso) {
  const dt = new Date(iso);
  const today = new Date(2026, 6, 3);           // demo "today"
  const sameDay = dt.toDateString() === today.toDateString();
  const time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  const date = dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${date} ${time}`;
}

/* ---------- routing ---------- */
const VIEWS = {
  home:    { render: renderHome,    after: bindHome,  title: 'Home' },
  bracket: { render: renderBracket, after: null,      title: 'Bracket' },
  score:   { render: renderScore,   after: null,      title: 'My Score' },
};

function navigate(name) {
  stopLiveEngine();
  const view = VIEWS[name] || VIEWS.home;
  document.getElementById('view').innerHTML = view.render();
  if (view.after) view.after();
  document.querySelectorAll('.nav').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-nav') === name));
  closeMenu();
  window.scrollTo(0, 0);
}

function updateScoreStrip() {
  const el = document.querySelector('.score-strip-value');
  if (el) el.textContent = totalScore() + ' pts';
}

/* ---------- hamburger menu ---------- */
function openMenu()  { document.getElementById('side-menu').classList.add('open');
                       document.getElementById('backdrop').classList.add('show'); }
function closeMenu() { document.getElementById('side-menu').classList.remove('open');
                       document.getElementById('backdrop').classList.remove('show'); }

/* ---------- LIVE ENGINE ----------
   Plays the scripted LIVE_TIMELINE against a fast demo clock so we can see the
   score change live, cards appear, and a VAR-disallowed goal revert the score.
*/
let liveTimer = null;
let liveStart = 0;

function startLiveEngine() {
  const liveMatches = MATCHES.filter(m => m.status === 'live');
  if (!liveMatches.length) return;
  liveStart = Date.now();
  tickLive();
  liveTimer = setInterval(tickLive, 1000);
}
function stopLiveEngine() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
}

function tickLive() {
  const m = MATCHES.find(x => x.status === 'live');
  if (!m) return;
  const feed = document.getElementById('feed-' + m.id);
  if (!feed) { stopLiveEngine(); return; }

  const elapsed = (Date.now() - liveStart) / 1000;
  const shown = LIVE_TIMELINE.filter(e => e.at <= elapsed);

  // current score = the last event that carried a score
  let hs = 0, as = 0, minute = 0;
  shown.forEach(e => {
    if (e.minute) minute = e.minute;
    if (e.score && e.type !== 'goal-var') { hs = e.score[0]; as = e.score[1]; }
  });

  const hsEl = document.getElementById('hs-' + m.id);
  const asEl = document.getElementById('as-' + m.id);
  const minEl = document.getElementById('min-' + m.id);
  if (hsEl) hsEl.textContent = hs;
  if (asEl) asEl.textContent = as;
  if (minEl) minEl.textContent = minute ? `${minute}'` : 'LIVE';

  // render event feed (newest first)
  feed.innerHTML = shown.slice().reverse().map(e => eventRow(e, m)).join('');
}

function eventRow(e, m) {
  const side = e.team === 'home' ? m.home : m.away;
  let icon, label;
  switch (e.type) {
    case 'goal':     icon = '⚽'; label = `<b>Goal!</b> ${e.player}`; break;
    case 'goal-var': icon = '🚫'; label = `${e.note || 'Goal disallowed (VAR)'} — ${e.player}`; break;
    case 'yellow':   icon = '🟨'; label = `Yellow card — ${e.player}`; break;
    case 'red':      icon = '🟥'; label = `Red card — ${e.player}`; break;
    default:         icon = '•';  label = e.player || '';
  }
  const varCls = e.type === 'goal-var' ? ' var' : '';
  return `<div class="event${varCls}">
    <span class="ev-min">${e.minute}'</span>
    <span class="ev-icon">${icon}</span>
    ${flagImg(side, 'flag-xs', 20)}
    <span class="ev-text">${label}</span>
  </div>`;
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('menu-btn').addEventListener('click', openMenu);
  document.getElementById('backdrop').addEventListener('click', closeMenu);
  document.querySelectorAll('.nav').forEach(b =>
    b.addEventListener('click', () => navigate(b.getAttribute('data-nav'))));
  // Check the sign-in state first; authBoot() shows either the login screen
  // or the app (and calls navigate('home') once the user is signed in).
  authBoot();
});
