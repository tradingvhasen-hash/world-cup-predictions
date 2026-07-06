/* ============================================================================
   PROFILE — avatar (Google picture or first letter), email, delete account.
   Deleting removes everything, signs the user out, and that email can never
   be used again (enforced in the database).
   ========================================================================== */

function renderProfile() {
  if (!currentUser) {
    return `<div class="page">
      <h1 class="page-title">Profile</h1>
      <p class="muted">Sign in to view your profile.</p>
      <button class="pred-save" id="prof-signin">Sign in</button>
    </div>`;
  }
  const em = currentUser.email || '';
  const meta = currentUser.user_metadata || {};
  const av = meta.avatar_url || meta.picture || '';
  return `<div class="page profile-page">
    <h1 class="page-title">Profile</h1>
    <div class="prof-card">
      ${av ? `<img class="prof-av" src="${av}" alt="" referrerpolicy="no-referrer"
                onerror="this.outerHTML='<div class=&quot;prof-av letter&quot;>${(em[0] || '?').toUpperCase()}</div>'">`
           : `<div class="prof-av letter">${(em[0] || '?').toUpperCase()}</div>`}
      <div class="prof-email">${em}</div>
    </div>
    <button class="prof-del" id="prof-del" type="button">Delete account</button>
    <p class="prof-note">Deleting your account removes your bracket and signs you out.
      It cannot be undone, and this email can’t be used again.</p>
  </div>`;
}

function bindProfile() {
  const si = document.getElementById('prof-signin');
  if (si) { si.addEventListener('click', () => openAuth()); return; }

  const del = document.getElementById('prof-del');
  if (!del) return;
  del.addEventListener('click', async () => {
    const ok = await appConfirm({
      title: 'Delete your account?',
      text: 'Everything will be removed permanently, and this email can never be used again.',
      ok: 'Delete', danger: true,
    });
    if (!ok) return;
    del.disabled = true;
    del.textContent = 'Deleting…';
    const { error } = await sb.rpc('delete_my_account');
    if (error) {
      del.disabled = false;
      del.textContent = 'Delete account';
      alert('Could not delete the account: ' + error.message);
      return;
    }
    await sb.auth.signOut();
    clearBracket();
    navigate('home');
  });
}
