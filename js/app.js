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
  home:    { render: renderHome,    after: bindHome,     title: 'Home' },
  lineups: { render: renderLineups, after: bindLineups,  title: 'Lineups' },
  bracket: { render: renderBracket, after: null,         title: 'Bracket' },
  score:   { render: renderScore,   after: null,         title: 'My Score' },
};

function navigate(name) {
  stopLiveEngine();
  stopCountdowns();
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
                       document.getElementById('backdrop').classList.add('show');
                       const t = document.getElementById('burger-toggle'); if (t) t.checked = true; }
function closeMenu() { document.getElementById('side-menu').classList.remove('open');
                       document.getElementById('backdrop').classList.remove('show');
                       const t = document.getElementById('burger-toggle'); if (t) t.checked = false; }

/* ---------- LIVE ENGINE ----------
   Polls ESPN every ~15s while a match is live: refreshes scores/clock in place
   and pulls the latest goal/card/sub events into each live card's feed. If the
   set of live matches changes (a game starts or ends), re-render the page.
*/
let liveTimer = null;
let liveExpanded = {};   // matchId -> show full feed?
let lastFeedHtml = {};   // matchId -> last feed html (avoid needless redraws)

function startLiveEngine() {
  if (!MATCHES.some(m => m.status === 'live')) return;
  liveTick();
  liveTimer = setInterval(liveTick, 15000);
}
function stopLiveEngine() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
  lastFeedHtml = {};
}

async function liveTick() {
  const liveIds = () => MATCHES.filter(m => m.status === 'live').map(m => m.id).join(',');
  const before = liveIds();
  try { await refreshMatches(); } catch (e) { return; }

  // If a game started or finished, the sections change — re-render the page.
  if (liveIds() !== before) {
    if (document.querySelector('.match-card.live')) navigate('home');
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
    if (feed) {
      const html = renderFeed(await espnFetchEvents(m.id), m);
      if (html !== lastFeedHtml[m.id]) { feed.innerHTML = html; lastFeedHtml[m.id] = html; }
    }
  }
}

/* Feed: newest 3 by default, "show more" reveals the rest. */
function renderFeed(events, m) {
  if (!events.length) return `<div class="event"><span class="ev-text muted">No key events yet.</span></div>`;
  const expanded = !!liveExpanded[m.id];
  const shown = expanded ? events.slice(0, 30) : events.slice(0, 3);
  let html = shown.map(e => feedRow(e, m)).join('');
  if (events.length > 3) {
    html += `<button class="feed-toggle" type="button" data-expand="${m.id}">` +
      (expanded ? 'Show less ▲' : `Show ${events.length - 3} more ▼`) + `</button>`;
  }
  return html;
}

function feedRow(e, m) {
  const t = (e.typeText || '').toLowerCase();
  const x = (e.text || '').toLowerCase();
  let icon = '•';
  if (t.includes('yellow')) icon = '🟨';
  else if (t.includes('red')) icon = '🟥';
  else if (t.includes('substitution')) icon = '🔄';
  else if (x.includes('disallow') || x.includes('var')) icon = '🚫';
  else if (t.includes('goal') || t.includes('penalty')) icon = x.includes('miss') ? '❌' : '⚽';
  const code = e.side === 'home' ? m.home : e.side === 'away' ? m.away : null;
  const flag = code ? flagImg(code, 'flag-xs') : '<span class="flag-xs"></span>';
  return `<div class="event ev-${e.side || 'none'}">
    <span class="ev-min">${e.minute || ''}</span>
    <span class="ev-icon">${icon}</span>
    ${flag}
    <span class="ev-text">${e.text || e.typeText}</span>
  </div>`;
}

function toggleFeed(id) {
  liveExpanded[id] = !liveExpanded[id];
  const feed = document.getElementById('feed-' + id);
  const m = MATCHES.find(x => x.id === id);
  if (feed && m) espnFetchEvents(id).then(evs => {
    feed.innerHTML = renderFeed(evs, m);
    lastFeedHtml[id] = feed.innerHTML;
  });
}

/* ---------- countdown to kickoff (upcoming cards) ---------- */
let countdownTimer = null;
function startCountdowns() {
  stopCountdowns();
  updateCountdowns();
  countdownTimer = setInterval(updateCountdowns, 1000);
}
function stopCountdowns() { if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; } }
function updateCountdowns() {
  const els = document.querySelectorAll('[data-kickoff]');
  if (!els.length) { stopCountdowns(); return; }
  const now = Date.now();
  els.forEach(el => { el.textContent = fmtCountdown(new Date(el.getAttribute('data-kickoff')).getTime() - now); });
}
function fmtCountdown(ms) {
  if (ms <= 0) return '⚽ Kicking off';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `⏳ Starts in ${d}d ${h}h`;
  if (h > 0) return `⏳ Starts in ${h}h ${m}m`;
  if (m > 0) return `⏳ Starts in ${m}m ${sec}s`;
  return `⏳ Starts in ${sec}s`;
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('burger-toggle').addEventListener('change', (e) => {
    e.target.checked ? openMenu() : closeMenu();
  });
  document.getElementById('backdrop').addEventListener('click', closeMenu);
  document.querySelectorAll('.nav').forEach(b =>
    b.addEventListener('click', () => navigate(b.getAttribute('data-nav'))));
  // Expand/collapse a live match's event feed (delegated — feeds re-render).
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-expand]');
    if (b) toggleFeed(b.getAttribute('data-expand'));
  });
  // Check the sign-in state first; authBoot() shows either the login screen
  // or the app (and calls navigate('home') once the user is signed in).
  authBoot();
});
