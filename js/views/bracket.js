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

  const shareBtn = brEditing ? `<button class="br-cancel" id="br-cancel">Cancel</button>`
    : `<button class="br-share ${userBracket ? '' : 'off'}" id="br-share" type="button" aria-label="Share">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>
        </svg></button>`;

  return `<div class="page br-page ${brEditing ? 'editing' : ''}">
    <div class="br-title-row">
      <h1 class="page-title">Bracket</h1>
      ${shareBtn}
    </div>
    <p class="br-note" id="br-share-note" style="display:none">Save your bracket first — then you can share it.</p>
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

/* The Final as a horizontal hero card, then the mirrored tree below it. */
function treeHtml() {
  const start = brStartRound();
  const sf1 = BR.sf[0], sf2 = BR.sf[1];
  const kids = m => (BR.feeders[m.id] || []).map(id => BR.byId[id]).filter(Boolean);

  // walk down from the SFs to the start round, collecting columns inner→outer
  const colsDown = [[sf1]], colsDownR = [[sf2]];
  while (true) {
    const nextL = colsDown[colsDown.length - 1].flatMap(kids);
    if (!nextL.length || brRoundOf(nextL[0]) === 'r32' ||
        (start === 'qf' && brRoundOf(nextL[0]) === 'r16') ||
        (start === 'sf' && brRoundOf(nextL[0]) !== 'sf')) break;
    colsDown.push(nextL);
    colsDownR.push(colsDownR[colsDownR.length - 1].flatMap(kids));
  }
  const colsL = colsDown.slice().reverse();       // outermost first
  const colsR = colsDownR.slice();                // innermost first (mirrored)

  const slots = colsL[0].length * 2;
  const h = Math.max(260, slots * 62);
  const col = (ms, side) =>
    `<div class="bcol">${ms.map(m => pairHtml(m, side)).join('')}</div>`;

  return `${finalCard()}
  <div class="btree" style="height:${h}px">
    ${colsL.map(ms => col(ms, 'l')).join('')}
    <div class="tsplit"></div>
    ${colsR.map(ms => col(ms, 'r')).join('')}
  </div>`;
}

/* elegant thin-line trophy */
const TROPHY_SVG = `<svg class="trophy" viewBox="0 0 24 24" fill="none"
  stroke="#C7A24A" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 21h8M12 17v4"/>
  <path d="M7 4h10v6a5 5 0 0 1-10 0V4Z"/>
  <path d="M7 6H4v1a4 4 0 0 0 3 3.87M17 6h3v1a4 4 0 0 1-3 3.87"/>
</svg>`;

function finalCard() {
  return `<section class="final-card">
    <div class="fc-side">
      ${slotHtml(BR.f, 'home')}
      <span class="fc-name" id="sname-${BR.f.id}-home"></span>
    </div>
    <div class="fc-centre">
      ${TROPHY_SVG}
      <div class="champ empty" id="champ-el"></div>
      <div class="champ-name" id="champ-name">Champion</div>
    </div>
    <div class="fc-side">
      ${slotHtml(BR.f, 'away')}
      <span class="fc-name" id="sname-${BR.f.id}-away"></span>
    </div>
  </section>`;
}

function pairHtml(m, side) {
  return `<div class="bpair ${side}" data-mid="${m.id}">
    ${slotHtml(m, 'home')}${slotHtml(m, 'away')}
  </div>`;
}

/* one slot; content + state are (re)applied by syncTree so edits are in-place */
function slotHtml(m, side) {
  return `<button class="bslot" id="slot-${m.id}-${side}" data-mid="${m.id}" data-side="${side}" type="button">
    ${slotInner(m, side)}</button>`;
}

function slotInner(m, side) {
  const info = slotInfo(m, side, brEditing || brView === 'picks');
  return info.code ? flagImg(info.code, 'bflag') : `<span class="bhole"></span>`;
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
  // finalist name labels on the final card
  ['home', 'away'].forEach(side => {
    const nameEl = document.getElementById(`sname-${BR.f.id}-${side}`);
    if (nameEl) {
      const info = slotInfo(BR.f, side, usePicks);
      nameEl.textContent = info.code ? teamName(info.code) : 'TBD';
      nameEl.classList.toggle('tbd', !info.code);
    }
  });
  // champion circle + name (in place; image only swaps when it changes)
  const champ = usePicks ? (activePicks()[BR.f.id] || brWinner(BR.f)) : brWinner(BR.f);
  const ce = document.getElementById('champ-el');
  const cn = document.getElementById('champ-name');
  if (ce && ce.dataset.code !== (champ || '')) {
    ce.dataset.code = champ || '';
    ce.innerHTML = champ ? flagImg(champ, 'bflag') : '';
    ce.classList.toggle('empty', !champ);
  }
  if (cn) cn.textContent = champ ? teamName(champ) : 'Champion';
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

  const share = document.getElementById('br-share');
  if (share) share.addEventListener('click', () => {
    if (!userBracket) {
      const n = document.getElementById('br-share-note');
      if (n) { n.style.display = 'block'; clearTimeout(n._t); n._t = setTimeout(() => n.style.display = 'none', 2200); }
      return;
    }
    shareBracket();
  });

  // tap a flag (tree or final card) → that team advances (in-place, no blink)
  const tree = document.querySelector('.br-page');
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

/* ============================================================================
   SHARE — draw the user's bracket as a 1080×1920 story image and share it.
   ========================================================================== */
/* Generate the image, show it in an in-app preview first (long-press saves it
   straight to Photos on iOS with a proper thumbnail), with a native Share
   button beneath it. */
let shareBlob = null;

async function shareBracket() {
  const btn = document.getElementById('br-share');
  try {
    if (btn) btn.classList.add('busy');
    shareBlob = await buildShareImage();
    showShareOverlay(URL.createObjectURL(shareBlob));
  } catch (e) {
    alert('Could not create the share image.');
  } finally {
    if (btn) btn.classList.remove('busy');
  }
}

function showShareOverlay(url) {
  const ov = document.createElement('div');
  ov.className = 'share-ov';
  ov.innerHTML = `
    <button class="share-x" type="button" aria-label="Close">✕</button>
    <img class="share-img" src="${url}" alt="My bracket">
    <p class="share-hint">Press and hold the image to save it to Photos</p>
    <button class="br-btn solid share-go" type="button">Share</button>`;
  document.body.appendChild(ov);
  const close = () => { ov.remove(); URL.revokeObjectURL(url); };
  ov.querySelector('.share-x').addEventListener('click', close);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.querySelector('.share-go').addEventListener('click', async () => {
    try {
      const file = new File([shareBlob], 'my-bracket.jpg', { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const a = document.createElement('a');
        a.href = url; a.download = 'my-bracket.jpg'; a.click();
      }
    } catch (e) { /* user cancelled the sheet — fine */ }
  });
}

function loadFlagImg(code) {
  return new Promise(res => {
    const t = TEAMS[code];
    if (!t || !t.logo) return res(null);
    const im = new Image();
    im.crossOrigin = 'anonymous';
    let done = false;
    const finish = v => { if (!done) { done = true; clearTimeout(tm); res(v); } };
    const tm = setTimeout(() => finish(null), 4000);   // never hang on a slow flag
    im.onload = () => finish(im);
    im.onerror = () => finish(null);
    im.src = t.logo;
  });
}

/* slot occupant in "my picks" view (share always shows the user's bracket) */
function shareSlot(m, side) { return slotInfo(m, side, true); }

async function buildShareImage() {
  // tree columns exactly like on screen
  const start = brStartRound();
  const kids = m => (BR.feeders[m.id] || []).map(id => BR.byId[id]).filter(Boolean);
  const colsDown = [[BR.sf[0]]], colsDownR = [[BR.sf[1]]];
  while (true) {
    const nextL = colsDown[colsDown.length - 1].flatMap(kids);
    if (!nextL.length || brRoundOf(nextL[0]) === 'r32' ||
        (start === 'qf' && brRoundOf(nextL[0]) === 'r16') ||
        (start === 'sf' && brRoundOf(nextL[0]) !== 'sf')) break;
    colsDown.push(nextL);
    colsDownR.push(colsDownR[colsDownR.length - 1].flatMap(kids));
  }
  const colsL = colsDown.slice().reverse();
  const colsR = colsDownR.slice().reverse();

  // preload every flag used
  const codes = new Set();
  [...BR.r16, ...BR.qf, ...BR.sf, BR.f].forEach(m => ['home', 'away'].forEach(s => {
    const c = shareSlot(m, s).code; if (c) codes.add(c);
  }));
  const champ = userBracket.picks[BR.f.id] || brWinner(BR.f);
  if (champ) codes.add(champ);
  const imgs = {};
  await Promise.all([...codes].map(async c => { imgs[c] = await loadFlagImg(c); }));

  const W = 1080, H = 1920;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const FONT = '-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';

  // background
  x.fillStyle = '#F4F4F6'; x.fillRect(0, 0, W, H);

  // header
  x.fillStyle = '#111114'; x.textAlign = 'center';
  x.font = `800 54px ${FONT}`; x.fillText('World Cup ’26', W / 2, 130);
  const s = bracketScore();
  x.fillStyle = '#8A8A90'; x.font = `600 32px ${FONT}`;
  x.fillText(s && s.decided ? `My bracket · ${s.got} pts` : 'My bracket', W / 2, 182);

  // flag helper: white pad ring + clipped, over-scaled image (crops bands)
  function flag(cx, cy, r, code, ring, ringW) {
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = '#fff'; x.fill(); x.clip();
    const im = imgs[code];
    if (im) { const rr = r - 4, d = rr * 3.7; 
      x.save(); x.beginPath(); x.arc(cx, cy, rr, 0, 7); x.clip();
      x.drawImage(im, cx - d / 2, cy - d / 2, d, d); x.restore(); }
    x.restore();
    x.beginPath(); x.arc(cx, cy, r, 0, 7);
    x.strokeStyle = ring || 'rgba(17,17,20,.18)'; x.lineWidth = ringW || 3; x.stroke();
  }
  function hole(cx, cy, r) {
    x.beginPath(); x.arc(cx, cy, r, 0, 7);
    x.setLineDash([7, 8]); x.strokeStyle = '#D4D4D9'; x.lineWidth = 3; x.stroke(); x.setLineDash([]);
  }
  function ringFor(m, side, base) {
    const info = shareSlot(m, side);
    if (info.picked && info.real) return info.real === info.code ? '#1F8A5B' : '#D64545';
    return base;
  }

  // final card
  const cardY = 226, cardH = 380;
  x.save();
  x.shadowColor = 'rgba(17,17,20,.07)'; x.shadowBlur = 30; x.shadowOffsetY = 8;
  x.fillStyle = '#fff';
  x.beginPath(); x.roundRect(64, cardY, W - 128, cardH, 44); x.fill();
  x.restore();
  // trophy (thin line, gold)
  x.save(); x.translate(W / 2 - 12 * 3.4, cardY + 34); x.scale(3.4, 3.4);
  x.strokeStyle = '#C7A24A'; x.lineWidth = 1.6; x.lineCap = 'round'; x.lineJoin = 'round';
  x.stroke(new Path2D('M8 21h8M12 17v4'));
  x.stroke(new Path2D('M7 4h10v6a5 5 0 0 1-10 0V4Z'));
  x.stroke(new Path2D('M7 6H4v1a4 4 0 0 0 3 3.87M17 6h3v1a4 4 0 0 1-3 3.87'));
  x.restore();
  const fh = shareSlot(BR.f, 'home'), fa = shareSlot(BR.f, 'away');
  const fy = cardY + 210;
  if (fh.code) flag(258, fy, 66, fh.code, ringFor(BR.f, 'home')); else hole(258, fy, 62);
  if (fa.code) flag(W - 258, fy, 66, fa.code, ringFor(BR.f, 'away')); else hole(W - 258, fy, 62);
  x.fillStyle = '#111114'; x.font = `600 30px ${FONT}`;
  x.fillText(fh.code ? teamName(fh.code) : 'TBD', 258, fy + 112);
  x.fillText(fa.code ? teamName(fa.code) : 'TBD', W - 258, fy + 112);
  if (champ) {
    const cw = brWinner(BR.f);
    flag(W / 2, fy - 8, 88, champ, cw ? (cw === champ ? '#1F8A5B' : '#D64545') : '#C7A24A', 8);
    x.fillStyle = '#111114'; x.font = `800 38px ${FONT}`;
    x.fillText(teamName(champ), W / 2, fy + 126);
  } else { hole(W / 2, fy - 8, 84); }

  // tree
  const top = cardY + cardH + 70, bot = H - 120, Ht = bot - top;
  const M = 56, gapC = 96, nCols = colsL.length * 2;
  const colW = (W - 2 * M - gapC) / nCols;
  const xs = i => M + colW * (i + .5);                       // left col centre
  const xsR = i => W - M - colW * (i + .5);                  // right col centre (outermost i=0)
  const R = 40, gapS = 58;
  const pairCy = (col, j, n) => top + Ht * (j + .5) / n;

  function drawHalf(cols, mirror) {
    const X = mirror ? xsR : xs;
    cols.forEach((ms, i) => {
      const n = ms.length;
      ms.forEach((m, j) => {
        const cy = pairCy(i, j, n);
        const y1 = cy - gapS, y2 = cy + gapS;
        // connector to next column
        const dir = mirror ? -1 : 1;
        const bx = X(i) + dir * (R + 22);
        x.strokeStyle = '#C4C4CC'; x.lineWidth = 3.5; x.lineJoin = 'round'; x.lineCap = 'round';
        x.beginPath();
        x.moveTo(X(i) + dir * (R + 6), y1); x.lineTo(bx, y1); x.lineTo(bx, y2);
        x.lineTo(X(i) + dir * (R + 6), y2); x.stroke();
        if (i < cols.length - 1) {
          // stub to the slot this match feeds
          const nm = cols[i + 1].find(q => (BR.feeders[q.id] || []).includes(m.id));
          if (nm) {
            const jj = cols[i + 1].indexOf(nm);
            const side = (BR.feeders[nm.id] || []).indexOf(m.id);
            const ty = pairCy(i + 1, jj, cols[i + 1].length) + (side === 0 ? -gapS : gapS);
            const midX = (bx + X(i + 1) - dir * (R + 6)) / 2;
            x.beginPath(); x.moveTo(bx, cy); x.lineTo(midX, cy);
            x.lineTo(midX, ty); x.lineTo(X(i + 1) - dir * (R + 6), ty); x.stroke();
          }
        }
        // slots
        ['home', 'away'].forEach((sd, k) => {
          const info = shareSlot(m, sd);
          const sy = k === 0 ? y1 : y2;
          if (info.code) flag(X(i), sy, R, info.code, ringFor(m, sd));
          else hole(X(i), sy, R - 4);
        });
      });
    });
  }
  drawHalf(colsL, false);
  drawHalf(colsR, true);

  // footer wordmark
  x.fillStyle = '#B4B4BA'; x.font = `600 26px ${FONT}`;
  x.fillText('World Cup ’26 · Predictions', W / 2, H - 52);

  return await new Promise((res, rej) =>
    cv.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/jpeg', 0.92));
}
