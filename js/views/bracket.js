/* ============================================================================
   BRACKET VIEW  —  the knockout tree ("who plays who; winners advance")
   Losers are shown greyed out; winners move to the next round.
   ========================================================================== */

function renderBracket() {
  const rounds = ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];
  let html = `<div class="page">
    <h2 class="section-title">Knockout bracket</h2>
    <p class="muted">Winners advance to the next round. Eliminated teams turn grey.</p>
    <div class="bracket-scroll"><div class="bracket">`;

  rounds.forEach(round => {
    html += `<div class="round">
      <div class="round-title">${round}</div>`;
    BRACKET[round].forEach(tie => {
      html += bracketTie(tie);
    });
    html += `</div>`;
  });

  html += `</div></div></div>`;
  return html;
}

function bracketTie(tie) {
  return `<div class="tie">
    ${bracketSlot(tie.home, tie.winner)}
    ${bracketSlot(tie.away, tie.winner)}
  </div>`;
}

function bracketSlot(code, winner) {
  const isEmpty = !code;
  const isLoser = winner && code && code !== winner;
  const isWinner = winner && code === winner;
  const cls = ['slot',
    isEmpty ? 'empty' : '',
    isLoser ? 'loser' : '',
    isWinner ? 'winner' : ''].join(' ').trim();

  if (isEmpty) {
    return `<div class="${cls}"><span class="slot-name">TBD</span></div>`;
  }
  return `<div class="${cls}">
    ${flagImg(code, 'flag-sm', 40)}
    <span class="slot-name">${teamName(code)}</span>
  </div>`;
}
