/* ============================================================================
   APP  —  navigation (hamburger menu), routing, and the live-score engine
   ========================================================================== */

/* ---------- date formatting ---------- */
function fmtDate(iso) {
  const dt = new Date(iso);
  const now = new Date();
  const sameDay = dt.toDateString() === now.toDateString();
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
   Polls ESPN every ~15s while a match is live: refreshes scores/clock in place
   and pulls the latest goal/card/sub events into each live card's feed. If the
   set of live matches changes (a game starts or ends), re-render the page.
*/
let liveTimer = null;

function startLiveEngine() {
  if (!MATCHES.some(m => m.status === 'live')) return;
  liveTick();
  liveTimer = setInterval(liveTick, 15000);
}
function stopLiveEngine() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
}

async function liveTick() {
  const liveIds = () => MATCHES.filter(m => m.status === 'live').map(m => m.id).join(',');
  const before = liveIds();
  try { await refreshMatches(); } catch (e) { return; }

  // If a game started or finished, the sections change — re-render the page.
  if (liveIds() !== before) {
    if (document.getElementById('feed-' + before.split(',')[0]) || document.querySelector('.match-card.live')) {
      navigate('home');
    }
    return;
  }

  // Otherwise update each live card's score, clock and event feed in place.
  for (const m of MATCHES.filter(x => x.status === 'live')) {
    const hsEl = document.getElementById('hs-' + m.id);
    const asEl = document.getElementById('as-' + m.id);
    const minEl = document.getElementById('min-' + m.id);
    if (hsEl) hsEl.textContent = m.homeScore ?? 0;
    if (asEl) asEl.textContent = m.awayScore ?? 0;
    if (minEl) minEl.textContent = m.minute || 'LIVE';

    const feed = document.getElementById('feed-' + m.id);
    if (feed) feed.innerHTML = renderFeed(await espnFetchEvents(m.id));
  }
}

function renderFeed(events) {
  if (!events.length) return `<div class="event"><span class="ev-text">No events yet.</span></div>`;
  return events.slice(0, 20).map(feedRow).join('');
}

function feedRow(e) {
  const t = (e.typeText || '').toLowerCase();
  const txt = (e.text || '').toLowerCase();
  let icon = '•';
  if (t.includes('yellow')) icon = '🟨';
  else if (t.includes('red')) icon = '🟥';
  else if (t.includes('substitution')) icon = '🔄';
  else if (txt.includes('disallow') || txt.includes('var')) icon = '🚫';
  else if (t.includes('goal') || t.includes('penalty')) icon = txt.includes('miss') ? '❌' : '⚽';
  const min = e.minute ? `${e.minute}` : '';
  return `<div class="event">
    <span class="ev-min">${min}</span>
    <span class="ev-icon">${icon}</span>
    <span class="ev-text">${e.text || e.typeText}</span>
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
