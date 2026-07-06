/* ============================================================================
   BRACKET — the core of the site.
   Real knockout tree (R32 → Final) built from ESPN data, mirrored halves with
   the trophy in the centre, Apple-quiet styling.
   · Live view: real state — winners advance, losers fade, empty = future.
   · "Make my bracket": pick winners of every undecided match, then save ONCE.
     A saved bracket is permanent (no update path exists, even in the DB).
   · Score: weighted points per correct pick (R16 1 · QF 2 · SF 4 · Final 8).
   ========================================================================== */

let BR = null;             // { r32,r16,qf,sf,f, byId, feeders }
let brView = 'live';       // 'live' | 'picks'
let brEditing = false;
let brDraft = {};          // eventId -> picked team code (before saving)
let brError = false;

/* ---------- data ---------- */
async function loadBracketData() {
  const evs = await espnFetchKnockout();
  if (evs.length < 32) throw new Error('incomplete');
  const r32 = evs.slice(0, 16), r16 = evs.slice(16, 24),
        qf = evs.slice(24, 28), sf = evs.slice(28, 30),
        f = evs[evs.length - 1];                       // last = Final (31 = 3rd place excluded)
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
const BR_W = { r16: 1, qf: 2, sf: 4, f: 8 };

/* matches the user must pick = every knockout match not yet decided */
function pickableMatches() {
  return [...BR.r16, ...BR.qf, ...BR.sf, BR.f].filter(m => m.state === 'pre');
}
function activePicks() { return brEditing ? brDraft : (userBracket ? userBracket.picks : {}); }

/* who occupies one side of a match, for the current view */
function slotInfo(m, side, usePicks) {
  const real = side === 'home' ? m.homeReal : m.awayReal;
  if (real) return { code: side === 'home' ? m.home : m.away, from: null };
  const fid = (BR.feeders[m.id] || [])[side === 'home' ? 0 : 1];
  if (!fid) return { code: null, from: null };
  const w = brWinner(BR.byId[fid]);
  if (usePicks) {
    const p = activePicks()[fid];
    if (p) return { code: p, from: fid, picked: true, real: w };
    if (w) return { code: w, from: fid };
    return { code: null, from: fid };
  }
  return w ? { code: w, from: fid } : { code: null, from: fid };
}

/* ---------- scoring ---------- */
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
    const need = pickableMatches();
    const done = need.filter(m => brDraft[m.id]).length;
    head = `<div class="br-bar">
      <div class="br-progress">${done} of ${need.length} picks</div>
      <div class="br-actions">
        <button class="br-btn ghost" id="br-cancel">Cancel</button>
        <button class="br-btn solid" id="br-save" ${done === need.length ? '' : 'disabled'}>Save — final</button>
      </div>
      <p class="br-note">Tap the team you think wins each match. Saving is permanent.</p>
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
      <p class="br-note">Pick every winner through to the trophy. One shot — once saved it can't be changed.</p>
    </div>`;
  }

  return `<div class="page br-page">
    <h1 class="page-title">Bracket</h1>
    ${head}
    ${bracketTree(usePicks)}
  </div>`;
}

function bracketTree(usePicks) {
  // halves from the semi-finals down
  const sf1 = BR.sf[0], sf2 = BR.sf[1];
  const qfL = (BR.feeders[sf1.id] || []).map(id => BR.byId[id]).filter(Boolean);
  const qfR = (BR.feeders[sf2.id] || []).map(id => BR.byId[id]).filter(Boolean);
  const r16Of = qfs => qfs.flatMap(q => (BR.feeders[q.id] || [])).map(id => BR.byId[id]).filter(Boolean);
  const r16L = r16Of(qfL), r16R = r16Of(qfR);
  const r32Of = r16s => r16s.flatMap(r => (BR.feeders[r.id] || [])).map(id => BR.byId[id]).filter(Boolean);
  const r32L = r32Of(r16L), r32R = r32Of(r16R);

  const col = (ms, side) => `<div class="bcol">${ms.map(m => pairHtml(m, side, usePicks)).join('')}</div>`;

  // centre: finalists + trophy + champion
  const fh = slotInfo(BR.f, 'home', usePicks);
  const fa = slotInfo(BR.f, 'away', usePicks);
  const champWin = usePicks ? (activePicks()[BR.f.id] || brWinner(BR.f)) : brWinner(BR.f);
  const centre = `<div class="bcol centre">
    ${slotBtn(BR.f, 'home', fh, usePicks)}
    <div class="champ-wrap">
      <svg class="trophy" viewBox="0 0 24 24"><path d="M6 3h12v2h3v3c0 2.8-2.2 5-5 5h-.4A6 6 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1A6 6 0 0 1 8.4 13H8c-2.8 0-5-2.2-5-5V5h3V3zm-1 4v1c0 1.7 1.3 3 3 3V7H5zm14 0h-3v4c1.7 0 3-1.3 3-3V7z" fill="#C7A24A"/></svg>
      <div class="champ ${champWin ? '' : 'empty'}">${champWin ? flagImg(champWin, 'bflag') : ''}</div>
    </div>
    ${slotBtn(BR.f, 'away', fa, usePicks)}
  </div>`;

  return `<div class="br-wrap"><div class="bracket">
    ${col(r32L, 'l')}${col(r16L, 'l')}${col(qfL, 'l')}${col([sf1], 'l')}
    ${centre}
    ${col([sf2], 'r')}${col(qfR, 'r')}${col(r16R, 'r')}${col(r32R, 'r')}
  </div></div>`;
}

function pairHtml(m, side, usePicks) {
  return `<div class="bpair ${side}">
    ${slotBtn(m, 'home', slotInfo(m, 'home', usePicks), usePicks)}
    ${slotBtn(m, 'away', slotInfo(m, 'away', usePicks), usePicks)}
  </div>`;
}

function slotBtn(m, side, info, usePicks) {
  const cls = ['bslot'];
  let attrs = 'disabled';
  if (!info.code) cls.push('empty');
  else {
    const win = brWinner(m);
    if (win && !usePicks && win !== info.code) cls.push('lost');   // real loser fades
    if (brEditing && m.state === 'pre') {
      attrs = `data-pick="${m.id}" data-code="${info.code}"`;
      if (brDraft[m.id] === info.code) cls.push('sel');
    } else if (info.picked && info.real) {
      cls.push(info.real === info.code ? 'correct' : 'wrong');     // scored pick
    } else if (info.picked) {
      cls.push('pickmark');                                        // pending pick
    }
  }
  return `<button class="${cls.join(' ')}" ${attrs} type="button">
    ${info.code ? flagImg(info.code, 'bflag') : ''}</button>`;
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

  document.querySelectorAll('.seg-btn').forEach(b =>
    b.addEventListener('click', () => { brView = b.getAttribute('data-view'); navigate('bracket'); }));

  document.querySelectorAll('[data-pick]').forEach(b =>
    b.addEventListener('click', () => {
      brDraft[b.getAttribute('data-pick')] = b.getAttribute('data-code');
      pruneDraft();
      try { localStorage.setItem('wc-bracket-draft', JSON.stringify(brDraft)); } catch (e) {}
      navigate('bracket');
    }));
}

/* drop downstream picks that no longer follow from earlier choices */
function pruneDraft() {
  [...BR.r16, ...BR.qf, ...BR.sf, BR.f].forEach(m => {
    const p = brDraft[m.id];
    if (!p) return;
    const c = [slotInfo(m, 'home', true).code, slotInfo(m, 'away', true).code];
    if (!c.includes(p)) delete brDraft[m.id];
  });
}
