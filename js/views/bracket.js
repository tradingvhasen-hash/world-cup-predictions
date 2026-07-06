/* ============================================================================
   BRACKET — one round per screen, Apple-quiet.
   Segmented control (R32 · R16 · QF · SF · Final) → that round's matches as
   clean rows. Winners bold, losers fade. In edit mode you tap the team you
   think wins — a green ring marks it IN PLACE (no re-render, no blink) — and
   your winners flow into the next round. Save once; saved forever.
   Scoring: R16 1 · QF 2 · SF 4 · Final 8 per correct pick.
   ========================================================================== */

let BR = null;             // { r32,r16,qf,sf,f, byId, feeders }
let brRound = null;        // 'r32'|'r16'|'qf'|'sf'|'f'
let brView = 'live';       // 'live' | 'picks'
let brEditing = false;
let brDraft = {};
let brError = false;

const BR_ROUNDS = [
  { key: 'r32', label: 'R32' }, { key: 'r16', label: 'R16' },
  { key: 'qf', label: 'QF' }, { key: 'sf', label: 'SF' }, { key: 'f', label: 'Final' },
];
const BR_W = { r16: 1, qf: 2, sf: 4, f: 8 };

/* ---------- data ---------- */
async function loadBracketData() {
  const evs = await espnFetchKnockout();
  if (evs.length < 32) throw new Error('incomplete');
  const r32 = evs.slice(0, 16), r16 = evs.slice(16, 24),
        qf = evs.slice(24, 28), sf = evs.slice(28, 30),
        f = evs[evs.length - 1];
  const byId = {};
  [...r32, ...r16, ...qf, ...sf, f].forEach(m => byId[m.id] = m);
  const feeders = {};
  wireRound(r16, r32, /Round of 32 (\d+)/i, feeders);
  wireRound(qf, r16, /Round of 16 (\d+)/i, feeders);
  wireRound(sf, qf, /Quarterfinal (\d+)/i, feeders);
  wireRound([f], sf, /Semifinal (\d+)/i, feeders);
  BR = { r32, r16, qf, sf, f, byId, feeders };
  if (!brRound) brRound = defaultRound();
}

function wireRound(round, prev, rx, feeders) {
  round.forEach(m => {
    feeders[m.id] = ['home', 'away'].map(s => {
      const real = s === 'home' ? m.homeReal : m.awayReal;
      const code = s === 'home' ? m.home : m.away;
      if (real) { const hit = prev.find(p => brWinner(p) === code); if (hit) return hit.id; }
      const g = rx.exec(s === 'home' ? m.homeName : m.awayName);
      if (g && prev[+g[1] - 1]) return prev[+g[1] - 1].id;
      return null;
    });
  });
}

function brWinner(m) {
  if (!m || m.state !== 'post') return null;
  if (m.homeWin) return m.home;
  if (m.awayWin) return m.away;
  if (m.homeScore > m.awayScore) return m.home;
  if (m.awayScore > m.homeScore) return m.away;
  const adv = /^(.+?) advance/.exec(m.note || '');
  if (adv) {
    if (teamName(m.home) === adv[1]) return m.home;
    if (teamName(m.away) === adv[1]) return m.away;
  }
  return null;
}

function roundMatches(key) { return key === 'f' ? [BR.f] : BR[key]; }
function brRoundOf(m) {
  return BR.r16.includes(m) ? 'r16' : BR.qf.includes(m) ? 'qf'
       : BR.sf.includes(m) ? 'sf' : m === BR.f ? 'f' : 'r32';
}
function defaultRound() {
  for (const r of BR_ROUNDS) if (roundMatches(r.key).some(m => m.state !== 'post')) return r.key;
  return 'f';
}
function pickableMatches() {
  return [...BR.r16, ...BR.qf, ...BR.sf, BR.f].filter(m => m.state === 'pre');
}
function activePicks() { return brEditing ? brDraft : (userBracket ? userBracket.picks : {}); }

function slotInfo(m, side, usePicks) {
  const real = side === 'home' ? m.homeReal : m.awayReal;
  if (real) return { code: side === 'home' ? m.home : m.away };
  const fid = (BR.feeders[m.id] || [])[side === 'home' ? 0 : 1];
  if (!fid) return { code: null };
  const w = brWinner(BR.byId[fid]);
  if (usePicks) {
    const p = activePicks()[fid];
    if (p) return { code: p, picked: true, real: w };
    if (w) return { code: w };
    return { code: null };
  }
  return w ? { code: w } : { code: null };
}

function bracketScore() {
  if (!BR || !userBracket) return null;
  let got = 0, max = 0, decided = 0, total = 0;
  for (const [id, code] of Object.entries(userBracket.picks)) {
    const m = BR.byId[id]; if (!m) continue;
    const w = BR_W[brRoundOf(m)] || 1;
    max += w; total++;
    const win = brWinner(m);
    if (win) { decided++; if (win === code) got += w; }
  }
  return { got, max, decided, total };
}

/* ---------- render ---------- */
function renderBracket() {
  if (brError) {
    return `<div class="page"><h1 class="page-title">Bracket</h1>
      <p class="muted">Couldn't load the bracket. Check your connection.</p>
      <button class="pred-save" id="br-retry">Try again</button></div>`;
  }
  if (!BR) return `<div class="page"><h1 class="page-title">Bracket</h1><div class="loading">Loading…</div></div>`;

  const usePicks = brEditing || brView === 'picks';
  let head = '';

  if (brEditing) {
    head = `<div class="br-bar">
      <p class="br-note">Tap the team you think wins each match, round by round.<br>Saving is permanent — one bracket, forever.</p>
    </div>`;
  } else if (userBracket) {
    const s = bracketScore();
    head = `<div class="br-bar">
      <div class="br-score"><span class="br-pts">${s.got}</span><span class="br-max">/ ${s.max} pts</span></div>
      <div class="br-sub">${s.decided} of ${s.total} picks decided</div>
      <div class="seg">
        <button class="seg-btn ${brView === 'live' ? 'on' : ''}" data-view="live">Live</button>
        <button class="seg-btn ${brView === 'picks' ? 'on' : ''}" data-view="picks">My picks</button>
      </div>
    </div>`;
  } else {
    head = `<div class="br-bar">
      <button class="br-btn solid wide" id="br-make">Make my bracket</button>
      <p class="br-note">Pick every winner through to the trophy — one shot, no edits.</p>
    </div>`;
  }

  const segs = BR_ROUNDS.map(r =>
    `<button class="seg-btn ${brRound === r.key ? 'on' : ''}" data-round="${r.key}">${r.label}</button>`).join('');

  return `<div class="page br-page ${brEditing ? 'editing' : ''}">
    <div class="br-title-row">
      <h1 class="page-title">Bracket</h1>
      ${brEditing ? `<button class="br-cancel" id="br-cancel">Cancel</button>` : ''}
    </div>
    ${head}
    <div class="seg rseg">${segs}</div>
    <div id="br-body">${roundHtml(brRound, usePicks)}</div>
    ${brEditing ? editFooter() : ''}
  </div>`;
}

function editFooter() {
  const need = pickableMatches();
  const done = need.filter(m => brDraft[m.id]).length;
  return `<div class="br-foot">
    <span class="br-progress" id="br-progress">${done}/${need.length}</span>
    <button class="br-btn solid" id="br-save" ${done === need.length ? '' : 'disabled'}>Save — final</button>
  </div>`;
}

function roundHtml(rkey, usePicks) {
  const ms = roundMatches(rkey);
  let html = `<div class="group">${ms.map(m => matchRow(m, usePicks)).join('')}</div>`;
  if (rkey === 'f') html += champCard(usePicks);
  return html;
}

function matchRow(m, usePicks) {
  const h = slotInfo(m, 'home', usePicks);
  const a = slotInfo(m, 'away', usePicks);
  const pickable = brEditing && m.state === 'pre';
  const pick = activePicks()[m.id];
  const win = brWinner(m);

  const mid = m.state === 'post'
    ? `<div class="gscore">${m.homeScore}–${m.awayScore}</div><div class="g-sub">FT</div>`
    : m.state === 'in'
      ? `<div class="gscore">${m.homeScore}–${m.awayScore}</div><div class="g-sub"><span class="min">LIVE</span></div>`
      : `<div class="g-sub" style="font-size:.7rem">${brDate(m.date)}</div>`;

  return `<div class="grow bmatch" data-mid="${m.id}">
    ${sideBtn(m, 'home', h, pickable, pick, win, usePicks)}
    <div class="gmid">${mid}</div>
    ${sideBtn(m, 'away', a, pickable, pick, win, usePicks)}
  </div>`;
}

function sideBtn(m, side, info, pickable, pick, win, usePicks) {
  const right = side === 'away';
  if (!info.code) {
    return `<div class="gteam bside ${right ? 'right' : ''}">
      ${right ? `<span class="tbd">TBD</span><span class="bempty"></span>` : `<span class="bempty"></span><span class="tbd">TBD</span>`}
    </div>`;
  }
  const cls = ['gteam', 'bside']; if (right) cls.push('right');
  let attrs = '';
  if (pickable && info.code) {
    attrs = `data-act data-side="${side}" data-code="${info.code}"`;
    if (pick === info.code) cls.push('sel');
    else if (pick) cls.push('dim');
  } else if (win) {
    cls.push(win === info.code ? 'won' : 'lost');
  }
  if (info.picked && info.real) cls.push(info.real === info.code ? 'correct' : 'wrong');
  const flag = flagImg(info.code, 'flag');
  const name = `<span>${teamName(info.code)}</span>`;
  const tag = pickable ? 'button' : 'div';
  return `<${tag} class="${cls.join(' ')}" ${attrs} ${pickable ? 'type="button"' : ''}>
    ${right ? name + flag : flag + name}</${tag}>`;
}

function champCard(usePicks) {
  const champ = usePicks ? (activePicks()[BR.f.id] || brWinner(BR.f)) : brWinner(BR.f);
  return `<div class="champ-card">
    <svg class="trophy" viewBox="0 0 24 24"><path d="M6 3h12v2h3v3c0 2.8-2.2 5-5 5h-.4A6 6 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1A6 6 0 0 1 8.4 13H8c-2.8 0-5-2.2-5-5V5h3V3zm-1 4v1c0 1.7 1.3 3 3 3V7H5zm14 0h-3v4c1.7 0 3-1.3 3-3V7z" fill="#C7A24A"/></svg>
    <div class="champ ${champ ? '' : 'empty'}">${champ ? flagImg(champ, 'bflag') : ''}</div>
    <div class="champ-name">${champ ? teamName(champ) : 'Champion'}</div>
  </div>`;
}

function brDate(iso) {
  const dt = new Date(iso), now = new Date();
  if (dt.toDateString() === now.toDateString())
    return 'Today ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/* ---------- interactions (no full re-renders while picking) ---------- */
function bindBracket() {
  if (brError) {
    const r = document.getElementById('br-retry');
    if (r) r.addEventListener('click', () => { brError = false; navigate('bracket'); });
    return;
  }
  if (!BR) {
    loadBracketData()
      .then(() => { updateScoreStrip(); navigate('bracket'); })
      .catch(() => { brError = true; navigate('bracket'); });
    return;
  }

  const make = document.getElementById('br-make');
  if (make) make.addEventListener('click', () => {
    brEditing = true;
    try { brDraft = JSON.parse(localStorage.getItem('wc-bracket-draft') || '{}'); } catch (e) { brDraft = {}; }
    brRound = defaultRound();
    navigate('bracket');
  });

  const cancel = document.getElementById('br-cancel');
  if (cancel) cancel.addEventListener('click', () => { brEditing = false; navigate('bracket'); });

  const save = document.getElementById('br-save');
  if (save) save.addEventListener('click', async () => {
    if (!confirm('Save your bracket? This is final — it can never be changed.')) return;
    save.disabled = true; save.textContent = 'Saving…';
    const res = await saveBracketToDb(brDraft);
    if (res.ok) {
      brEditing = false; brView = 'picks';
      localStorage.removeItem('wc-bracket-draft');
      updateScoreStrip();
      navigate('bracket');
    } else {
      save.disabled = false; save.textContent = 'Save — final';
      alert('Could not save: ' + res.msg);
    }
  });

  // Live | My picks
  document.querySelectorAll('[data-view]').forEach(b =>
    b.addEventListener('click', () => { brView = b.getAttribute('data-view'); navigate('bracket'); }));

  // round switcher — swaps only the list body
  document.querySelectorAll('[data-round]').forEach(b =>
    b.addEventListener('click', () => {
      brRound = b.getAttribute('data-round');
      document.querySelectorAll('[data-round]').forEach(x =>
        x.classList.toggle('on', x.getAttribute('data-round') === brRound));
      document.getElementById('br-body').innerHTML =
        roundHtml(brRound, brEditing || brView === 'picks');
    }));

  // picking — updates the tapped row IN PLACE (no blink)
  const body = document.getElementById('br-body');
  if (body) body.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn || !brEditing) return;
    const row = btn.closest('.bmatch');
    const mid = row.getAttribute('data-mid');
    brDraft[mid] = btn.getAttribute('data-code');
    pruneDraft();
    try { localStorage.setItem('wc-bracket-draft', JSON.stringify(brDraft)); } catch (e) {}
    row.querySelectorAll('[data-act]').forEach(s => {
      const isSel = s.getAttribute('data-code') === brDraft[mid];
      s.classList.toggle('sel', isSel);
      s.classList.toggle('dim', !isSel);
    });
    // picking the Final also crowns the champion card, in place
    const cc = document.querySelector('.champ-card');
    if (cc && mid === BR.f.id) cc.outerHTML = champCard(true);
    refreshEditFooter();
  });
}

function refreshEditFooter() {
  const need = pickableMatches();
  const done = need.filter(m => brDraft[m.id]).length;
  const prog = document.getElementById('br-progress');
  const save = document.getElementById('br-save');
  if (prog) prog.textContent = `${done}/${need.length}`;
  if (save) save.disabled = done !== need.length;
}

function pruneDraft() {
  [...BR.r16, ...BR.qf, ...BR.sf, BR.f].forEach(m => {
    const p = brDraft[m.id];
    if (!p) return;
    const c = [slotInfo(m, 'home', true).code, slotInfo(m, 'away', true).code];
    if (!c.includes(p)) delete brDraft[m.id];
  });
}
