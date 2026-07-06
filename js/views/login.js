/* ============================================================================
   LOGIN — dismissible auth sheet, flat and quiet like the rest of the app.
   Google first, then grouped email/password fields, mode toggle at the bottom.
   ========================================================================== */

let authMode = 'signin';   // 'signin' | 'signup'

function showLogin() {
  const screen = document.getElementById('auth-screen');
  if (!screen) return;

  const su = authMode === 'signup';
  screen.innerHTML = `
    <div class="auth-wrap">
      <button class="auth-close" id="auth-close" type="button" aria-label="Close">✕</button>

      <div class="auth-title">World Cup ’26</div>
      <p class="auth-sub">${su ? 'Create your account' : 'Welcome back'}</p>

      <button class="auth-google" id="google-btn" type="button">
        <span class="g-icon">G</span> Continue with Google
      </button>

      <div class="auth-or"><span>or</span></div>

      <form id="auth-form" class="auth-form">
        <div class="auth-fields">
          ${su ? `<input type="text" id="auth-fn" class="afield" placeholder="First name" autocomplete="given-name">
          <input type="text" id="auth-ln" class="afield" placeholder="Last name" autocomplete="family-name">` : ''}
          <input type="email" id="auth-email" class="afield" placeholder="Email"
                 autocomplete="email" required>
          <input type="password" id="auth-pass" class="afield" placeholder="Password"
                 minlength="6" required
                 autocomplete="${su ? 'new-password' : 'current-password'}">
        </div>
        <button type="submit" class="auth-submit" id="auth-submit">
          ${su ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <div class="auth-links">
        ${su ? '' : `<button class="auth-link" id="forgot-link" type="button">Forgot password?</button>`}
        <button class="auth-link strong" id="mode-toggle" type="button">
          ${su ? 'Have an account? Sign in' : 'New here? Create account'}
        </button>
      </div>

      <div class="auth-msg" id="auth-msg"></div>
    </div>`;

  document.getElementById('auth-close').addEventListener('click', closeAuth);
  document.getElementById('mode-toggle').addEventListener('click', () => {
    authMode = su ? 'signin' : 'signup';
    showLogin();
  });
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
      const fn = (document.getElementById('auth-fn')?.value || '').trim();
      const ln = (document.getElementById('auth-ln')?.value || '').trim();
      const { data, error } = await doSignUp(email, pass, `${fn} ${ln}`.trim());
      if (error) {
        authMsg(/database error/i.test(error.message)
          ? 'This email can’t be used. It may belong to a deleted account.'
          : error.message, 'err');
      } else if (data.session) { /* signed in — overlay closes via auth state */ }
      else { authMsg('Account created. Check your email to confirm, then sign in.', 'ok'); }
    } else {
      const { error } = await doSignIn(email, pass);
      if (error) authMsg(error.message, 'err');
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
}

async function onForgot() {
  const email = document.getElementById('auth-email').value.trim();
  if (!email) { authMsg('Type your email above first.', 'err'); return; }
  const { error } = await doSendReset(email);
  if (error) authMsg(error.message, 'err');
  else authMsg('Password reset email sent. Check your inbox.', 'ok');
}

/* ---- "set a new password" screen (arrived from the reset email) ---- */
function showRecovery() {
  const screen = document.getElementById('auth-screen');
  if (!screen) return;
  screen.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-title">New password</div>
      <p class="auth-sub">Choose a new password for your account</p>
      <form id="recover-form" class="auth-form">
        <div class="auth-fields">
          <input type="password" id="recover-pass" class="afield" placeholder="New password"
                 autocomplete="new-password" minlength="6" required>
        </div>
        <button type="submit" class="auth-submit">Save password</button>
      </form>
      <div class="auth-msg" id="auth-msg"></div>
    </div>`;

  document.getElementById('recover-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = document.getElementById('recover-pass').value;
    const { error } = await doUpdatePassword(pass);
    if (error) authMsg(error.message, 'err');
    else { authMsg('Password updated. You are signed in.', 'ok'); setTimeout(closeAuth, 900); }
  });
}
