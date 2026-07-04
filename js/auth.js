/* ============================================================================
   AUTH  —  Supabase sign up / sign in / sign out / password reset
   ----------------------------------------------------------------------------
   Wraps the Supabase client so the rest of the app only calls simple helpers.
   The app is gated behind a login screen: when there is no logged-in user we
   show #auth-screen; once signed in we show the app and the user's email in
   the menu.
   ========================================================================== */

/* The Supabase browser client (global `supabase` comes from js/vendor/supabase.js).
   If that script failed to load we keep sb = null and show a clear message
   instead of leaving a blank screen. */
const sb = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let currentUser = null;   // the signed-in user object, or null
let appStarted  = false;  // so we only boot the app view once per sign-in

/* ---------- helpers the UI calls ---------- */
async function doSignUp(email, password) {
  return sb.auth.signUp({ email, password });
}
async function doSignIn(email, password) {
  return sb.auth.signInWithPassword({ email, password });
}
async function doSignOut() {
  await sb.auth.signOut();
}
async function doSignInGoogle() {
  // Redirects to Google, then back to this same page; Supabase completes the
  // session automatically on return. The redirect target must be listed in
  // Supabase → Authentication → URL Configuration → Redirect URLs.
  return sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}
async function doSendReset(email) {
  // The link in the email brings the user back here; Supabase must allow this
  // origin in Auth → URL Configuration → Redirect URLs.
  return sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
}
async function doUpdatePassword(newPassword) {
  return sb.auth.updateUser({ password: newPassword });
}

/* ---------- boot + react to auth changes ---------- */
async function authBoot() {
  if (!sb) {
    document.body.classList.add('logged-out');
    const screen = document.getElementById('auth-screen');
    if (screen) screen.innerHTML =
      `<div class="auth-card"><div class="auth-brand">⚠️ Couldn't start</div>
       <p class="auth-sub">The sign-in library didn't load. Please refresh the page.</p></div>`;
    return;
  }
  const { data } = await sb.auth.getSession();
  currentUser = data.session ? data.session.user : null;
  applyAuthState();

  sb.auth.onAuthStateChange((event, session) => {
    currentUser = session ? session.user : null;
    if (event === 'PASSWORD_RECOVERY') { showRecovery(); return; }
    applyAuthState();
  });
}

/* Show either the app or the login screen based on currentUser. */
function applyAuthState() {
  const body = document.body;
  if (currentUser) {
    body.classList.remove('logged-out');
    fillMenuUser();
    // First sign-in of this page load: fetch the user's saved predictions from
    // the database, then show the app.
    if (!appStarted) {
      appStarted = true;
      loadPredictionsFromDb().then(() => navigate('home'));
    }
  } else {
    body.classList.add('logged-out');
    appStarted = false;
    clearPredictions();
    showLogin();
  }
}

/* Put the signed-in email + a Sign out button in the menu footer. */
function fillMenuUser() {
  const box = document.getElementById('menu-user');
  if (!box || !currentUser) return;
  box.innerHTML = `
    <div class="menu-email" title="${currentUser.email}">${currentUser.email}</div>
    <button class="menu-signout" id="signout-btn">Sign out</button>`;
  document.getElementById('signout-btn').addEventListener('click', async () => {
    await doSignOut();
    closeMenu();
  });
}
