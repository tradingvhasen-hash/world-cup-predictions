/* ============================================================================
   BRACKET — the whole tournament on one screen.
   Mirrored tree with the trophy in the centre. Fully-finished early rounds are
   dropped automatically (R32 today), so the tree stays airy and elegant.
   · Live view: real state — winners advance, losers fade, future = soft rings.
   · Edit: tap a flag to send that team through; picks flow across the tree
     with surgical DOM updates (no re-render, no blink). Save once — forever.
   · Score: R16 1 · QF 2 · SF 4 · Final 8 per correct pick.
   ========================================================================== */

let BR = null;
let brView = 'live';       // 'live' | 'picks'
let brEditing = false;
let brDraft = {};
let brError = false;

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

function brRoundOf(m) {
  return BR.r16.includes(m) ? 'r16' : BR.qf.includes(m) ? 'qf'
       : BR.sf.includes(m) ? 'sf' : m === BR.f ? 'f' : 'r32';
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

/* first round that still has undecided matches — earlier rounds are hidden */
function brStartRound() {
  if (BR.r16.some(m => m.state !== 'post')) return 'r16';
  if (BR.qf.some(m => m.state !== 'post')) return 'qf';
  return 'sf';
}

/* ---------- render ---------- */
function renderBracket() {
  if (brError) {
    return `<div class="page"><h1 class="page-title">Bracket</h1>
      <p class="muted">Couldn't load the bracket. Check your connection.</p>
      <button class="pred-save" id="br-retry">Try again</button></div>`;
  }
  if (!BR) return `<div class="page"><h1 class="page-title">Bracket</h1><div class="loading">Loading…</div></div>`;

  let head = '';
  if (brEditing) {
    head = `<div class="br-bar">
      <p class="br-note">Tap a flag to send that team through — all the way to the trophy.<br>Saving is permanent: one bracket, forever.</p>
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

  return `<div class="page br-page ${brEditing ? 'editing' : ''}">
    <div class="br-title-row">
      <h1 class="page-title">Bracket</h1>
      ${brEditing ? `<button class="br-cancel" id="br-cancel">Cancel</button>` : ''}
    </div>
    ${head}
    ${treeHtml()}
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

/* Build the mirrored tree. Left half = SF1's subtree, right half = SF2's. */
function treeHtml() {
  const start = brStartRound();
  const sf1 = BR.sf[0], sf2 = BR.sf[1];
  const kids = m => (BR.feeders[m.id] || []).map(id => BR.byId[id]).filter(Boolean);

  const leftCols = [], rightCols = [];
  let L = [sf1], R = [sf2];
  const order = { sf: ['sf'], qf: ['qf', 'sf'], r16: ['r16', 'qf', 'sf'] }[start];
  // walk down from SF to the start round, collecting columns inner→outer
  const colsDown = [[sf1]], colsDownR = [[sf2]];
  while (true) {
    const nextL = colsDown[colsDown.length - 1].flatMap(kids);
    if (!nextL.length || brRoundOf(nextL[0]) === 'r32' ||
        (start === 'qf' && brRoundOf(nextL[0]) === 'r16') ||
        (start === 'sf' && brRoundOf(nextL[0]) !== 'sf')) break;
    colsDown.push(nextL);
    colsDownR.push(colsDownR[colsDownR.length - 1].flatMap(kids));
  }
  // outermost first
  const colsL = colsDown.slice().reverse();
  const colsR = colsDownR.slice().reverse();

  const slots = colsL[0].length * 2;
  const h = Math.max(300, slots * 58);
  const col = (ms, side) =>
    `<div class="bcol">${ms.map(m => pairHtml(m, side)).join('')}</div>`;

  return `<div class="btree" style="height:${h}px">
    ${colsL.map(ms => col(ms, 'l')).join('')}
    ${centreHtml()}
    ${colsR.slice().reverse().map(ms => col(ms, 'r')).join('')}
  </div>
  <div class="br-champ">${champCard()}</div>`;
}

function pairHtml(m, side) {
  return `<div class="bpair ${side}" data-mid="${m.id}">
    ${slotHtml(m, 'home')}${slotHtml(m, 'away')}
  </div>`;
}

function centreHtml() {
  return `<div class="bcol centre" data-mid="${BR.f.id}">
    ${slotHtml(BR.f, 'home')}
    <svg class="trophy" viewBox="0 0 24 24"><path d="M6 3h12v2h3v3c0 2.8-2.2 5-5 5h-.4A6 6 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1A6 6 0 0 1 8.4 13H8c-2.8 0-5-2.2-5-5V5h3V3zm-1 4v1c0 1.7 1.3 3 3 3V7H5zm14 0h-3v4c1.7 0 3-1.3 3-3V7z" fill="#C7A24A"/></svg>
    ${slotHtml(BR.f, 'away')}
  </div>`;
}

/* one slot; content + state are (re)applied by syncSlot so edits are in-place */
function slotHtml(m, side) {
  return `<button class="bslot" id="slot-${m.id}-${side}" data-mid="${m.id}" data-side="${side}" type="button">
    ${slotInner(m, side)}</button>`;
}

function slotInner(m, side) {
  const info = slotInfo(m, side, brEditing || brView === 'picks');
  return info.code ? flagImg(info.code, 'bflag') : `<span class="bhole"></span>`;
}

function champCard() {
  const usePicks = brEditing || brView === 'picks';
  const champ = usePicks ? (activePicks()[BR.f.id] || brWinner(BR.f)) : brWinner(BR.f);
  return `<div class="champ-card" id="champ-card">
    <div class="champ ${champ ? '' : 'empty'}">${champ ? flagImg(champ, 'bflag') : ''}</div>
    <div class="champ-name">${champ ? teamName(champ) : 'Champion'}</div>
  </div>`;
}

/* ---------- surgical state sync (no re-renders, no blinking) ---------- */
function syncTree() {
  const usePicks = brEditing || brView === 'picks';
  [...BR.r16, ...BR.qf, ...BR.sf, BR.f].forEach(m => {
    ['home', 'away'].forEach(side => {
      const el = document.getElementById(`slot-${m.id}-${side}`);
      if (!el) return;
      const info = slotInfo(m, side, usePicks);
      const code = info.code || '';
      if (el.dataset.code !== code) {
        el.dataset.code = code;
        el.innerHTML = code ? flagImg(code, 'bflag') : `<span class="bhole"></span>`;
      }
      const pick = activePicks()[m.id];
      const win = brWinner(m);
      el.classList.toggle('sel', brEditing && !!code && pick === code);
      el.classList.toggle('lost', !usePicks && !!win && !!code && win !== code);
      el.classList.toggle('won', !usePicks && !!win && !!code && win === code);
      el.classList.toggle('correct', !brEditing && usePicks && !!info.picked && !!info.real && info.real === info.code);
      el.classList.toggle('wrong', !brEditing && usePicks && !!info.picked && !!info.real && info.real !== info.code);
      el.classList.toggle('tappable', brEditing && m.state === 'pre' && !!code);
    });
  });
  const cc = document.getElementById('champ-card');
  if (cc) cc.outerHTML = champCard();
  refreshEditFooter();
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

/* ---------- interactions ---------- */
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

  document.querySelectorAll('[data-view]').forEach(b =>
    b.addEventListener('click', () => { brView = b.getAttribute('data-view'); navigate('bracket'); }));

  // tap a flag in the tree → that team advances (in-place, no blink)
  const tree = document.querySelector('.btree');
  if (tree) tree.addEventListener('click', (ev) => {
    if (!brEditing) return;
    const el = ev.target.closest('.bslot');
    if (!el || !el.classList.contains('tappable')) return;
    const m = BR.byId[el.dataset.mid];
    if (!m || m.state !== 'pre' || !el.dataset.code) return;
    brDraft[m.id] = el.dataset.code;
    pruneDraft();
    try { localStorage.setItem('wc-bracket-draft', JSON.stringify(brDraft)); } catch (e) {}
    syncTree();
  });

  syncTree();
}
