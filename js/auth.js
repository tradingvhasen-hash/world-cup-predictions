/* ============================================================================
   AUTH — Supabase sign up / sign in / sign out / password reset.
   The site is fully browsable without an account. Signing in is only needed
   to make and save a bracket. The auth screen is an overlay opened from the
   top-bar "Sign in" button (or when a bracket save requires it).
   ========================================================================== */

const sb = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let currentUser = null;
let appStarted  = false;

/* ---------- helpers ---------- */
async function doSignUp(email, password, fullName) {
  // Send the confirmation link back to THIS page (the project lives under a
  // /world-cup-predictions/ path, not the domain root) so clicking it doesn't 404.
  const emailRedirectTo = window.location.origin + window.location.pathname;
  const options = { emailRedirectTo };
  if (fullName) options.data = { full_name: fullName };
  return sb.auth.signUp({ email, password, options });
}
async function doSignIn(email, password) { return sb.auth.signInWithPassword({ email, password }); }
async function doSignOut() { await sb.auth.signOut(); }
async function doSendReset(email) {
  return sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
}
async function doUpdatePassword(newPassword) { return sb.auth.updateUser({ password: newPassword }); }
async function doSignInGoogle() {
  return sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

/* ---------- overlay ---------- */
function openAuth() {
  if (!sb) { alert('Sign-in is unavailable right now.'); return; }
  showLogin();
  document.body.classList.add('auth-open');
}
function closeAuth() { document.body.classList.remove('auth-open'); }

/* ---------- boot + react to auth changes ---------- */
async function authBoot() {
  if (!sb) { applyAuthState(); return; }
  const { data } = await sb.auth.getSession();
  currentUser = data.session ? data.session.user : null;
  applyAuthState();

  // Surface OAuth callback errors (e.g. a deleted account trying Google again)
  if (/error=/.test(window.location.hash)) {
    const m = /error_description=([^&]+)/.exec(window.location.hash);
    openAuth();
    setTimeout(() => authMsg(m ? decodeURIComponent(m[1].replace(/\+/g, ' '))
      : 'Sign-in failed. This account may have been deleted.', 'err'), 60);
    history.replaceState(null, '', window.location.pathname);
  }

  sb.auth.onAuthStateChange((event, session) => {
    currentUser = session ? session.user : null;
    if (event === 'PASSWORD_RECOVERY') {
      document.body.classList.add('auth-open');
      showRecovery();
      return;
    }
    applyAuthState();
  });
}

function applyAuthState() {
  const signedIn = !!currentUser;
  document.body.classList.toggle('signed-in', signedIn);
  if (signedIn) closeAuth();
  fillMenuUser();
  if (!signedIn) clearBracket();

  if (!appStarted) {
    appStarted = true;
    loadBracketFromDb().then(() => { updateScoreStrip(); navigate('home'); });
  } else {
    loadBracketFromDb().then(() => {
      updateScoreStrip();
      if (currentView === 'profile' && !signedIn) navigate('home');
      else if (currentView === 'bracket' || currentView === 'profile') navigate(currentView);
    });
  }
}

/* menu footer: email + sign out (signed in) or a sign-in button */
function fillMenuUser() {
  const box = document.getElementById('menu-user');
  if (!box) return;
  if (currentUser) {
    box.innerHTML = `
      <div class="menu-email" title="${currentUser.email}">${currentUser.email}</div>
      <button class="menu-signout" id="signout-btn">Sign out</button>`;
    document.getElementById('signout-btn').addEventListener('click', async () => {
      await doSignOut();
      closeMenu();
    });
  } else {
    box.innerHTML = `<button class="menu-signin" id="menu-signin">Sign in</button>`;
    document.getElementById('menu-signin').addEventListener('click', () => {
      closeMenu();
      openAuth();
    });
  }
}
