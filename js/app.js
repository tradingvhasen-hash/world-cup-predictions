/* ============================================================================
   APP  —  navigation (hamburger menu), routing, and the live-score engine
   ========================================================================== */

/* ---------- date formatting ---------- */
function fmtDate(iso) {
  const dt = new Date(iso);
  const now = new Date();
  const sameDay = dt.toDateString() === now.toDateString();
  const time = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  const date = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${date} ${time}`;
}

/* ---------- routing ---------- */
const VIEWS = {
  home:    { render: renderHome,    after: bindHome,     title: 'Home' },
  bracket: { render: renderBracket, after: bindBracket,  title: 'Bracket' },
  profile: { render: renderProfile, after: bindProfile,  title: 'Profile' },
};
let currentView = 'home';

function navigate(name) {
  stopLiveEngine();
  stopCountdowns();
  currentView = VIEWS[name] ? name : 'home';
  const view = VIEWS[name] || VIEWS.home;
  document.getElementById('view').innerHTML = view.render();
  if (view.after) view.after();
  document.querySelectorAll('.nav').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-nav') === name));
  closeMenu();
  window.scrollTo(0, 0);
}

function updateScoreStrip() {
  const el = document.getElementById('menu-points');
  if (!el) return;
  const s = (typeof bracketScore === 'function' && BR && userBracket) ? bracketScore() : null;
  el.textContent = s ? `${s.got} pts` : 'World Cup ’26';
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
    if (document.querySelector('.grow.live') || document.querySelector('.home-page')) navigate('home');
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

    updateLiveUI(m, await espnFetchEvents(m.id));
  }
}

/* ---------- live event feed (Google-style rows) ---------- */
const SUB_ICON = `<svg class="sub-ic" viewBox="0 0 16 16" fill="none" stroke-width="1.7"
  stroke-linecap="round" stroke-linejoin="round">
  <path d="M5.2 13V3.4M5.2 3.4 2.8 5.8M5.2 3.4l2.4 2.4" stroke="#1F8A5B"/>
  <path d="M10.8 3v9.6m0 0 2.4-2.4m-2.4 2.4-2.4-2.4" stroke="#D64545"/></svg>`;

function parseEvent(e) {
  const t = (e.typeText || '').toLowerCase();
  const x = e.text || '';
  const firstName = (rx) => { const g = rx.exec(x); return g ? g[1].trim() : ''; };

  if (/half|kick ?off|match end|end regular|full time/.test(t) ||
      /^(start|end).*(half)|^halftime|^kickoff|match ends/i.test(x)) {
    let label = 'Match update';
    if (/2nd half|second half/i.test(t + x)) label = 'Second half';
    else if (/halftime|1st half ends|first half ends/i.test(t + x)) label = 'Half time';
    else if (/1st half|first half|kick ?off/i.test(t + x)) label = 'Kick-off';
    else if (/match end|full time|end regular/i.test(t + x)) label = 'Full time';
    return { kind: 'period', label };
  }
  if (t.includes('substitution')) {
    const g = /\.\s*(.+?)\s+replaces\s+(.+?)\./.exec(x);
    return { kind: 'sub', title: 'Substitution',
      main: g ? g[1] : firstName(/^(.+?)\s*\(/) || x,
      det: g ? `for ${g[2]}` : '' };
  }
  if (t.includes('yellow')) return { kind: 'yellow', title: 'Yellow card', main: firstName(/^(.+?)\s*\(/) || x };
  if (t.includes('red'))    return { kind: 'red', title: 'Red card', main: firstName(/^(.+?)\s*\(/) || x };
  if (/disallow|var/i.test(x) || t.includes('var'))
    return { kind: 'var', title: 'VAR', main: x.replace(/\s+/g, ' ').slice(0, 80) };
  if (t.includes('penalty') && /miss|saved/i.test(x))
    return { kind: 'miss', title: 'Missed penalty', main: firstName(/\.\s*([^.]+?)\s*\(/) || firstName(/^(.+?)\s*\(/) || x };
  if (t.includes('goal') || t.includes('penalty')) {
    const det = /own goal/i.test(x) ? 'Own goal' : /penalt/i.test(x) ? 'Penalty' : '';
    return { kind: 'goal', title: 'Goal', main: firstName(/\.\s*([^.]+?)\s*\(/) || firstName(/^(.+?)\s*\(/) || x, det };
  }
  return { kind: 'info', title: '', main: x.replace(/\s+/g, ' ').slice(0, 90) };
}

/* Scorers under each team (the default, Apple-quiet view). */
function scorersHtml(events, side) {
  const list = events.slice().reverse().filter(e => e.side === side && parseEvent(e).kind === 'goal');
  if (!list.length) return '';
  return list.map(e => {
    const p = parseEvent(e);
    const tag = /Penalty/.test(p.det || '') ? ' (P)' : /Own goal/.test(p.det || '') ? ' (OG)' : '';
    return `<div class="sc"><span class="b">\u26BD</span><span class="sc-n">${p.main}</span><span class="sc-m">${e.minute || ''}${tag}</span></div>`;
  }).join('');
}

/* Collapsed: nothing but a quiet "All events" line. Expanded: one line per
   event, home events on the left, away on the right. */
function renderFeed(events, m) {
  const keep = events.filter(e => {
    const k = parseEvent(e).kind;
    if (k === 'period') return /Half time/.test(parseEvent(e).label);
    return k === 'goal' || k === 'yellow' || k === 'red' || k === 'sub';
  });
  if (!keep.length) return '';
  const expanded = !!liveExpanded[m.id];
  if (!expanded) {
    return `<button class="feed-toggle" type="button" data-expand="${m.id}">All events</button>`;
  }
  return keep.map(e => frRow(e)).join('') +
    `<button class="feed-toggle" type="button" data-expand="${m.id}">Hide events</button>`;
}

function frRow(e) {
  const p = parseEvent(e);
  if (p.kind === 'period') return `<div class="fr-ht"><span>Half time</span></div>`;
  let icon = '';
  if (p.kind === 'yellow') icon = '<span class="cardp y"></span>';
  else if (p.kind === 'red') icon = '<span class="cardp r"></span>';
  else if (p.kind === 'goal') icon = '<span class="ball-ic">\u26BD</span>';
  else if (p.kind === 'sub') icon = SUB_ICON;
  const suf = p.kind === 'sub' && p.det ? `<span class="suf">${p.det}</span>`
            : p.det ? `<span class="suf">${p.det}</span>` : '';
  return `<div class="fr ${e.side === 'away' ? 'away' : 'home'}">
    <span class="fr-ic">${icon}</span>
    <span class="name">${p.main}</span>${suf}
    <span class="min">${e.minute || ''}</span>
  </div>`;
}

/* Push fresh events into a live card: scorers under the teams + the feed. */
function updateLiveUI(m, evs) {
  const sh = document.getElementById('sc-h-' + m.id);
  const sa = document.getElementById('sc-a-' + m.id);
  if (sh) sh.innerHTML = scorersHtml(evs, 'home');
  if (sa) sa.innerHTML = scorersHtml(evs, 'away');
  const feed = document.getElementById('feed-' + m.id);
  if (feed) {
    const html = renderFeed(evs, m);
    if (html !== lastFeedHtml[m.id]) { feed.innerHTML = html; lastFeedHtml[m.id] = html; }
  }
}

function toggleFeed(id) {
  liveExpanded[id] = !liveExpanded[id];
  const m = MATCHES.find(x => x.id === id);
  if (m) espnFetchEvents(id).then(evs => { lastFeedHtml[id] = null; updateLiveUI(m, evs); });
}

/* ---------- countdown to kickoff (upcoming cards) ---------- */
let countdownTimer = null;
let cdRefreshing = false;
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
  let kickedOff = false;
  els.forEach(el => {
    const diff = new Date(el.getAttribute('data-kickoff')).getTime() - now;
    if (diff <= 0) { el.textContent = 'kicking off…'; kickedOff = true; }
    else el.textContent = fmtCountdown(diff);
  });
  // A match just started: pull fresh data so it moves to Live and locks
  // (prediction ends the moment the game starts).
  if (kickedOff && !cdRefreshing) {
    cdRefreshing = true;
    refreshMatches().then(() => { cdRefreshing = false; navigate('home'); })
                    .catch(() => { cdRefreshing = false; });
  }
}
function fmtCountdown(ms) {
  if (ms <= 0) return 'kicking off';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('burger-toggle').addEventListener('change', (e) => {
    e.target.checked ? openMenu() : closeMenu();
  });
  const tbs = document.getElementById('tb-signin');
  if (tbs) tbs.addEventListener('click', () => openAuth());
  document.getElementById('backdrop').addEventListener('click', closeMenu);
  document.querySelectorAll('.nav').forEach(b =>
    b.addEventListener('click', () => navigate(b.getAttribute('data-nav'))));
  // Delegated clicks: live-feed expand, and "?" tooltips.
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-expand]');
    if (b) { toggleFeed(b.getAttribute('data-expand')); return; }
    const tip = ev.target.closest('.tip');
    document.querySelectorAll('.tip.open').forEach(t => { if (t !== tip) t.classList.remove('open'); });
    if (tip) { tip.classList.toggle('open'); ev.stopPropagation(); }
  });
  // Auto-hide the top bar: hide on scroll down, show on scroll up.
  setupAutoHideBar();
  // Check the sign-in state first; authBoot() shows either the login screen
  // or the app (and calls navigate('home') once the user is signed in).
  authBoot();
});

function setupAutoHideBar() {
  const bar = document.querySelector('.topbar');
  if (!bar) return;
  let lastY = window.scrollY, ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (y > lastY && y > 60) bar.classList.add('hidden');        // scrolling down
      else if (y < lastY) bar.classList.remove('hidden');          // scrolling up
      lastY = y;
      ticking = false;
    });
  }, { passive: true });
}

/* ---------- in-app confirm dialog (replaces browser confirm) ---------- */
function appConfirm(o) {
  return new Promise(res => {
    const ov = document.createElement('div');
    ov.className = 'modal-ov';
    ov.innerHTML = `<div class="modal-card">
      <div class="modal-title">${o.title}</div>
      ${o.text ? `<p class="modal-text">${o.text}</p>` : ''}
      <div class="modal-btns">
        <button class="m-btn ghost" data-m="0">${o.cancel || 'Cancel'}</button>
        <button class="m-btn ${o.danger ? 'danger' : 'solid'}" data-m="1">${o.ok || 'OK'}</button>
      </div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    const done = v => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 220); res(v); };
    ov.querySelectorAll('[data-m]').forEach(b =>
      b.addEventListener('click', () => done(b.getAttribute('data-m') === '1')));
    ov.addEventListener('click', e => { if (e.target === ov) done(false); });
  });
}
