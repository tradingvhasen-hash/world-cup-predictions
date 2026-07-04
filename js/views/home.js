/* ============================================================================
   HOME VIEW  —  live match + next matches with score predictions
   ========================================================================== */

function renderHome() {
  const live     = MATCHES.filter(m => m.status === 'live');
  const upcoming = MATCHES.filter(m => m.status === 'upcoming')
                          .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const finished = MATCHES.filter(m => m.status === 'finished');

  let html = `<div class="page">
    <div class="score-strip">
      <span class="score-strip-label">Your prediction score</span>
      <span class="score-strip-value">${totalScore()} pts</span>
    </div>`;

  if (live.length) {
    html += `<h2 class="section-title"><span class="live-dot"></span>Live now</h2>`;
    html += live.map(liveCard).join('');
  }

  html += `<h2 class="section-title">Next matches</h2>`;
  html += upcoming.map(predictCard).join('');

  if (finished.length) {
    html += `<h2 class="section-title">Results</h2>`;
    html += finished.map(resultCard).join('');
  }

  html += `</div>`;
  return html;
}

/* ---- one live match card (updated every second by the live engine) ---- */
function liveCard(m) {
  return `<div class="match-card live" id="live-${m.id}" data-match="${m.id}">
    ${matchHeader(m, `<span class="minute" id="min-${m.id}">LIVE</span>`)}
    <div class="event-feed" id="feed-${m.id}"></div>
  </div>`;
}

/* ---- prediction card for an upcoming match ---- */
function predictCard(m) {
  const p = getPrediction(m.id);
  const hv = p ? p.home : '';
  const av = p ? p.away : '';
  return `<div class="match-card" data-match="${m.id}">
    <div class="match-meta">${m.stage} · ${fmtDate(m.kickoff)}</div>
    <div class="match-row">
      ${teamBlock(m.home)}
      <div class="predict">
        <input class="pred-in" type="number" min="0" max="20" inputmode="numeric"
               id="ph-${m.id}" value="${hv}" aria-label="${teamName(m.home)} score">
        <span class="pred-dash">–</span>
        <input class="pred-in" type="number" min="0" max="20" inputmode="numeric"
               id="pa-${m.id}" value="${av}" aria-label="${teamName(m.away)} score">
      </div>
      ${teamBlock(m.away)}
    </div>
    <button class="pred-save" data-save="${m.id}">${p ? 'Update prediction' : 'Save prediction'}</button>
    <div class="pred-hint" id="hint-${m.id}">${p ? 'Saved ✓' : 'Predict the final score to earn points'}</div>
  </div>`;
}

/* ---- finished match result ---- */
function resultCard(m) {
  const pen = m.penalties ? ` <span class="pens">(${m.penalties.home}-${m.penalties.away} pens)</span>` : '';
  return `<div class="match-card result" data-match="${m.id}">
    <div class="match-meta">${m.stage} · ${fmtDate(m.kickoff)} · Full time</div>
    <div class="match-row">
      ${teamBlock(m.home)}
      <div class="score-final">${m.homeScore} – ${m.awayScore}${pen}</div>
      ${teamBlock(m.away)}
    </div>
  </div>`;
}

/* ---- shared bits ---- */
function teamBlock(code) {
  return `<div class="team">
    ${flagImg(code, 'flag')}
    <span class="team-name">${teamName(code)}</span>
  </div>`;
}
function matchHeader(m, middle) {
  return `<div class="match-meta">${m.stage} · ${fmtDate(m.kickoff)}</div>
    <div class="match-row">
      ${teamBlock(m.home)}
      <div class="score-live"><span id="hs-${m.id}">0</span> – <span id="as-${m.id}">0</span>${middle}</div>
      ${teamBlock(m.away)}
    </div>`;
}

/* ---- wire up the Save buttons after the view is in the DOM ---- */
function bindHome() {
  document.querySelectorAll('[data-save]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-save');
      const h = document.getElementById('ph-' + id).value;
      const a = document.getElementById('pa-' + id).value;
      const hint = document.getElementById('hint-' + id);
      if (h === '' || a === '') {
        hint.textContent = 'Enter both scores first';
        return;
      }
      btn.disabled = true;
      hint.textContent = 'Saving…';
      const ok = await setPrediction(id, h, a);
      hint.textContent = ok ? 'Saved ✓' : 'Could not save — please try again';
      btn.textContent = 'Update prediction';
      btn.disabled = false;
      updateScoreStrip();
    });
  });
  startLiveEngine();
}
