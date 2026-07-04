/* ============================================================================
   HOME VIEW  —  live match + next matches + results (clean, low-clutter)
   ========================================================================== */

function renderHome() {
  if (!matchesLoaded) {
    if (matchesError) {
      return `<div class="page home-page">
        <p class="muted">Couldn't load matches. Check your connection.</p>
        <button class="pred-save" id="retry-load">Try again</button></div>`;
    }
    return `<div class="page home-page"><div class="loading">Loading…</div></div>`;
  }

  const live     = MATCHES.filter(m => m.status === 'live');
  const upcoming  = MATCHES.filter(m => m.status === 'upcoming' && hasRealTeams(m)).slice(0, 5);
  const finished = MATCHES.filter(m => m.status === 'finished' && hasRealTeams(m))
                          .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff)).slice(0, 6);

  let html = `<div class="page home-page">
    <div class="score-strip">
      <span class="score-strip-label">Your score</span>
      <span class="score-strip-value">${totalScore()} pts</span>
    </div>`;

  if (live.length) {
    html += `<h2 class="section-title"><span class="live-dot"></span>Live</h2>`;
    html += live.map(liveCard).join('');
  }

  html += `<h2 class="section-title">Next up</h2>`;
  html += upcoming.length ? upcoming.map(predictCard).join('')
                          : `<p class="muted">No upcoming matches right now.</p>`;

  if (finished.length) {
    html += `<h2 class="section-title">Results</h2>`;
    html += `<div class="results-list">${finished.map(resultRow).join('')}</div>`;
  }

  html += `</div>`;
  return html;
}

/* ---- live match card ---- */
function liveCard(m) {
  return `<div class="match-card live" id="live-${m.id}" data-match="${m.id}">
    <div class="match-row">
      ${teamBlock(m.home)}
      <div class="score-box">
        <div class="score-nums"><span id="hs-${m.id}">${m.homeScore ?? 0}</span><span class="score-dash">–</span><span id="as-${m.id}">${m.awayScore ?? 0}</span></div>
        <span class="minute" id="min-${m.id}">${m.minute || 'LIVE'}</span>
      </div>
      ${teamBlock(m.away)}
    </div>
    <div class="event-feed" id="feed-${m.id}"></div>
  </div>`;
}

/* ---- compact result row ---- */
function resultRow(m) {
  return `<div class="result-row">
    <div class="rr-team">${flagImg(m.home, 'flag-sm')}<span>${teamName(m.home)}</span></div>
    <div class="rr-score">${m.homeScore} – ${m.awayScore}</div>
    <div class="rr-team rr-away"><span>${teamName(m.away)}</span>${flagImg(m.away, 'flag-sm')}</div>
  </div>`;
}

/* ---- prediction card for an upcoming match ---- */
function predictCard(m) {
  const p = getPrediction(m.id);
  const hv = p ? p.home : 0;
  const av = p ? p.away : 0;
  return `<div class="match-card" data-match="${m.id}">
    <div class="match-meta">${fmtDate(m.kickoff)} · <span class="cd" data-kickoff="${m.kickoff}"></span></div>
    <div class="match-row">
      ${teamBlock(m.home)}
      <div class="vs">vs</div>
      ${teamBlock(m.away)}
    </div>
    <div class="predict-row">
      ${stepper('ph-' + m.id, hv)}
      <span class="pred-dash">–</span>
      ${stepper('pa-' + m.id, av)}
    </div>
    <button class="pred-save" data-save="${m.id}">${p ? 'Update' : 'Save prediction'}</button>
    <div class="pred-hint" id="hint-${m.id}">${p ? 'Saved ✓' : ''}</div>
  </div>`;
}

function stepper(id, val) {
  return `<div class="stepper">
    <button class="step-btn" type="button" data-step="${id}" data-dir="-1" aria-label="minus">−</button>
    <span class="step-val" id="${id}">${val}</span>
    <button class="step-btn" type="button" data-step="${id}" data-dir="1" aria-label="plus">+</button>
  </div>`;
}

function teamBlock(code) {
  return `<div class="team">
    ${flagImg(code, 'flag')}
    <span class="team-name">${teamName(code)}</span>
  </div>`;
}

/* ---- wire up after the view is in the DOM ---- */
function bindHome() {
  if (!matchesLoaded) {
    const retry = document.getElementById('retry-load');
    if (retry) retry.addEventListener('click', () => { matchesError = false; navigate('home'); });
    refreshMatches().then(() => navigate('home')).catch(() => { matchesError = true; navigate('home'); });
    return;
  }

  document.querySelectorAll('.step-btn').forEach(b => {
    b.addEventListener('click', () => {
      const span = document.getElementById(b.getAttribute('data-step'));
      let v = parseInt(span.textContent || '0', 10) + parseInt(b.getAttribute('data-dir'), 10);
      span.textContent = Math.max(0, Math.min(20, v));
    });
  });

  document.querySelectorAll('[data-save]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-save');
      const h = document.getElementById('ph-' + id).textContent;
      const a = document.getElementById('pa-' + id).textContent;
      const hint = document.getElementById('hint-' + id);
      btn.disabled = true;
      hint.textContent = 'Saving…';
      const ok = await setPrediction(id, h, a);
      hint.textContent = ok ? 'Saved ✓' : 'Could not save — try again';
      btn.textContent = 'Update';
      btn.disabled = false;
      updateScoreStrip();
    });
  });

  startLiveEngine();
  startCountdowns();
}
