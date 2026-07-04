/* ============================================================================
   LOGIN VIEW  —  the sign-in / sign-up screen shown in front of the app
   ----------------------------------------------------------------------------
   Rendered into #auth-screen (a full-screen overlay). It has two modes,
   "Sign in" and "Sign up", a "forgot password" link, and a small message area
   for errors / confirmations. A separate "set a new password" screen is shown
   when the user arrives from a password-reset email.
   ========================================================================== */

let authMode = 'signin';   // 'signin' | 'signup'

function showLogin() {
  const screen = document.getElementById('auth-screen');
  if (!screen) return;

  const isSignup = authMode === 'signup';
  screen.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand"><span class="brand-emoji">🏆</span> World Cup 2026</div>
      <p class="auth-sub">Predict scores. Earn points. Beat your friends.</p>

      <div class="auth-tabs">
        <button class="auth-tab ${!isSignup ? 'active' : ''}" data-mode="signin">Sign in</button>
        <button class="auth-tab ${isSignup ? 'active' : ''}" data-mode="signup">Create account</button>
      </div>

      <button class="auth-google" id="google-btn" type="button">
        <span class="g-icon">G</span> Continue with Google
      </button>
      <div class="auth-or"><span>or ${isSignup ? 'sign up' : 'sign in'} with email</span></div>

      <form id="auth-form" class="auth-form">
        <div class="input-group">
          <input type="email" id="auth-email" class="input" autocomplete="email" required>
          <label class="user-label">Email</label>
        </div>
        <div class="input-group">
          <input type="password" id="auth-pass" class="input"
                 autocomplete="${isSignup ? 'new-password' : 'current-password'}"
                 minlength="6" required>
          <label class="user-label">Password</label>
        </div>

        <button type="submit" class="auth-submit" id="auth-submit">
          ${isSignup ? 'Create account' : 'Sign in'}
        </button>
        <p class="auth-tip">Tip: signing in with Google is quicker and more
          reliable — email sign-in can occasionally be delayed.</p>
      </form>

      ${isSignup ? '' : `<button class="auth-link" id="forgot-link">Forgot your password?</button>`}
      <div class="auth-msg" id="auth-msg"></div>
    </div>`;

  // switch between sign in / sign up
  screen.querySelectorAll('.auth-tab').forEach(t =>
    t.addEventListener('click', () => { authMode = t.getAttribute('data-mode'); showLogin(); }));

  document.getElementById('auth-form').addEventListener('submit', onAuthSubmit);
  document.getElementById('google-btn').addEventListener('click', onGoogle);
  const forgot = document.getElementById('forgot-link');
  if (forgot) forgot.addEventListener('click', onForgot);
}

function authMsg(text, kind) {
  const el = document.getElementById('auth-msg');
  if (!el) return;
  el.textContent = text;
  el.className = 'auth-msg' + (kind ? ' ' + kind : '');
}

async function onAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  const btn   = document.getElementById('auth-submit');
  if (!email || !pass) return;

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Please wait…';
  authMsg('', '');

  try {
    if (authMode === 'signup') {
      const { data, error } = await doSignUp(email, pass);
      if (error) { authMsg(error.message, 'err'); }
      else if (data.session) { /* signed in immediately — auth state will switch */ }
      else { authMsg('Account created! Check your email to confirm, then sign in.', 'ok'); }
    } else {
      const { error } = await doSignIn(email, pass);
      if (error) { authMsg(error.message, 'err'); }
      /* success → onAuthStateChange swaps to the app automatically */
    }
  } catch (err) {
    authMsg('Something went wrong. Please try again.', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function onGoogle() {
  authMsg('', '');
  const { error } = await doSignInGoogle();
  if (error) authMsg(error.message, 'err');
  // On success the browser redirects to Google; nothing else to do here.
}

async function onForgot() {
  const email = document.getElementById('auth-email').value.trim();
  if (!email) { authMsg('Type your email above first, then tap “Forgot your password?”.', 'err'); return; }
  const { error } = await doSendReset(email);
  if (error) authMsg(error.message, 'err');
  else authMsg('Password reset email sent. Check your inbox.', 'ok');
}

/* ---- "set a new password" screen (arrived from the reset email) ---- */
function showRecovery() {
  const screen = document.getElementById('auth-screen');
  if (!screen) return;
  document.body.classList.add('logged-out');
  screen.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand"><span class="brand-emoji">🔑</span> Set a new password</div>
      <form id="recover-form" class="auth-form">
        <label class="auth-label">New password
          <input type="password" id="recover-pass" class="auth-input"
                 autocomplete="new-password" minlength="6" required>
        </label>
        <button type="submit" class="auth-submit" id="recover-submit">Save new password</button>
      </form>
      <div class="auth-msg" id="auth-msg"></div>
    </div>`;

  document.getElementById('recover-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = document.getElementById('recover-pass').value;
    const { error } = await doUpdatePassword(pass);
    if (error) authMsg(error.message, 'err');
    else authMsg('Password updated! You are now signed in.', 'ok');
  });
}
