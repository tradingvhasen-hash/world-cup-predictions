/* ============================================================================
   HOME VIEW  —  live match + next matches with score predictions (real data)
   ========================================================================== */

function renderHome() {
  // Data loads asynchronously from ESPN; show states while it arrives.
  if (!matchesLoaded) {
    if (matchesError) {
      return `<div class="page home-page"><div class="score-strip">
          <span class="score-strip-label">Your prediction score</span>
          <span class="score-strip-value">${totalScore()} pts</span></div>
        <p class="muted">Couldn't load live matches. Check your connection.</p>
        <button class="pred-save" id="retry-load">Try again</button></div>`;
    }
    return `<div class="page home-page">
      <div class="loading">Loading live World Cup…</div></div>`;
  }

  const live     = MATCHES.filter(m => m.status === 'live');
  const upcoming = MATCHES.filter(m => m.status === 'upcoming' && hasRealTeams(m)).slice(0, 10);
  const finished = MATCHES.filter(m => m.status === 'finished' && hasRealTeams(m))
                          .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff)).slice(0, 10);

  let html = `<div class="page home-page">
    <div class="score-strip">
      <span class="score-strip-label">Your prediction score</span>
      <span class="score-strip-value">${totalScore()} pts</span>
    </div>`;

  if (live.length) {
    html += `<h2 class="section-title"><span class="live-dot"></span>Live now</h2>`;
    html += live.map(liveCard).join('');
  }

  html += `<h2 class="section-title">Next matches</h2>`;
  html += upcoming.length ? upcoming.map(predictCard).join('')
                          : `<p class="muted">No upcoming matches right now.</p>`;

  if (finished.length) {
    html += `<h2 class="section-title">Recent results</h2>`;
    html += finished.map(resultCard).join('');
  }

  html += `</div>`;
  return html;
}

/* ---- one live match card (updated by the live engine) ---- */
function liveCard(m) {
  return `<div class="match-card live" id="live-${m.id}" data-match="${m.id}">
    ${matchHeader(m, `<span class="minute" id="min-${m.id}">${m.minute || 'LIVE'}</span>`)}
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
  return `<div class="match-card result" data-match="${m.id}">
    <div class="match-meta">${m.stage} · ${fmtDate(m.kickoff)} · Full time</div>
    <div class="match-row">
      ${teamBlock(m.home)}
      <div class="score-final">${m.homeScore} – ${m.awayScore}</div>
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
      <div class="score-live"><span id="hs-${m.id}">${m.homeScore ?? 0}</span> – <span id="as-${m.id}">${m.awayScore ?? 0}</span>${middle}</div>
      ${teamBlock(m.away)}
    </div>`;
}

/* ---- wire up after the view is in the DOM ---- */
function bindHome() {
  // Not loaded yet: trigger the fetch, then re-render.
  if (!matchesLoaded) {
    const retry = document.getElementById('retry-load');
    if (retry) retry.addEventListener('click', () => { matchesError = false; navigate('home'); });
    refreshMatches()
      .then(() => navigate('home'))
      .catch(() => { matchesError = true; navigate('home'); });
    return;
  }

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
