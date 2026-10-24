/**
 * Work Satthi — Supabase authentication.
 * Keeps the existing login/signup UI and delegates passwords and sessions to Supabase Auth.
 */
// Deployment refresh marker: 2026-10-24 — verify connected hosting picks up this main-branch revision.
(function () {
  'use strict';

  const form = document.getElementById('auth-form');
  const loginTab = document.getElementById('login-tab');
  const signupTab = document.getElementById('signup-tab');
  const titleEl = document.getElementById('auth-title');
  const subtitleEl = document.getElementById('auth-subtitle');
  const submitBtn = document.getElementById('submit-button');
  const feedback = document.getElementById('auth-feedback');
  const passwordInput = document.getElementById('password');
  const togglePwdBtn = document.getElementById('toggle-password');
  const signupOnlyFields = ['name-field', 'role-field', 'phone-field'];
  const workerOnlyFields = ['area-field', 'service-field', 'rate-field'];
  let currentMode = 'login';

  function showFeedback(message, type) {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.remove('is-error', 'is-success');
    if (type) feedback.classList.add(type);
  }
  function clearFeedback() {
    if (!feedback) return;
    feedback.textContent = '';
    feedback.classList.remove('is-error', 'is-success');
  }
  function syncWorkerFields() {
    const roleSelect = document.getElementById('role');
    const isWorker = currentMode === 'signup' && roleSelect && roleSelect.value === 'worker';
    workerOnlyFields.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.hidden = !isWorker;
    });
    const area = document.getElementById('area');
    const service = document.getElementById('service');
    if (area) area.required = !!isWorker;
    if (service) service.required = !!isWorker;
  }
  function setMode(mode) {
    currentMode = mode;
    const isSignup = mode === 'signup';
    if (loginTab) loginTab.setAttribute('aria-selected', String(!isSignup));
    if (signupTab) signupTab.setAttribute('aria-selected', String(isSignup));
    if (titleEl) titleEl.textContent = isSignup ? 'Create your account' : 'Welcome back';
    if (subtitleEl) subtitleEl.textContent = isSignup
      ? 'Join your local community with Work Satthi.'
      : 'Sign in to continue to your local services.';
    if (submitBtn) submitBtn.textContent = isSignup ? 'Create account' : 'Log in';
    signupOnlyFields.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.hidden = !isSignup;
    });
    const name = document.getElementById('full-name');
    if (name) name.required = isSignup;
    if (passwordInput) passwordInput.autocomplete = isSignup ? 'new-password' : 'current-password';
    clearFeedback();
    syncWorkerFields();
  }

  if (loginTab) loginTab.addEventListener('click', function () { setMode('login'); });
  if (signupTab) signupTab.addEventListener('click', function () { setMode('signup'); });
  const roleSelect = document.getElementById('role');
  if (roleSelect) roleSelect.addEventListener('change', syncWorkerFields);
  if (togglePwdBtn && passwordInput) {
    togglePwdBtn.addEventListener('click', function () {
      const hidden = passwordInput.type === 'password';
      passwordInput.type = hidden ? 'text' : 'password';
      togglePwdBtn.textContent = hidden ? 'Hide' : 'Show';
    });
  }

  const forgotPasswordBtn = document.getElementById('forgot-password-button');

  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', async function () {
      clearFeedback();
      const emailInput = document.getElementById('email');
      const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
      if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
        showFeedback('Enter your email address first, then click Forgot password again.', 'is-error');
        if (emailInput) {
          emailInput.focus();
          emailInput.setAttribute('aria-invalid', 'true');
        }
        return;
      }

      forgotPasswordBtn.disabled = true;
      forgotPasswordBtn.textContent = 'Sending reset link…';
      try {
        const client = await getSupabaseClient();
        const redirectTo = new URL('reset-password.html', window.location.href).href;
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
        if (error) throw error;
        showFeedback('If an account exists for that email, a password-reset link will be sent. Check your inbox and Spam folder.', 'is-success');
      } catch (error) {
        showFeedback(friendlyAuthError(error), 'is-error');
      } finally {
        forgotPasswordBtn.disabled = false;
        forgotPasswordBtn.textContent = 'Forgot password?';
      }
    });
  }

  function validateForm() {
    const emailInput = document.getElementById('email');
    if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
      showFeedback('Please enter a valid email address.', 'is-error');
      if (emailInput) emailInput.setAttribute('aria-invalid', 'true');
      return false;
    }
    emailInput.removeAttribute('aria-invalid');
    if (!passwordInput || passwordInput.value.length < 8) {
      showFeedback('Password must be at least 8 characters.', 'is-error');
      if (passwordInput) passwordInput.setAttribute('aria-invalid', 'true');
      return false;
    }
    passwordInput.removeAttribute('aria-invalid');
    if (currentMode === 'signup') {
      const name = document.getElementById('full-name');
      if (!name || !name.value.trim()) {
        showFeedback('Please enter your full name.', 'is-error');
        return false;
      }
      if (roleSelect && roleSelect.value === 'worker') {
        const area = document.getElementById('area');
        const service = document.getElementById('service');
        if (!area || !area.value.trim()) {
          showFeedback('Workers must provide their service area.', 'is-error');
          return false;
        }
        if (!service || !service.value) {
          showFeedback('Please choose the service you offer.', 'is-error');
          return false;
        }
      }
    }
    return true;
  }

  function friendlyAuthError(error) {
    const message = (error && error.message) ? error.message : '';
    if (/invalid login credentials/i.test(message)) return 'Email or password is incorrect.';
    if (/email not confirmed/i.test(message)) return 'Please confirm your email using the link we sent you, then log in.';
    if (/user already registered/i.test(message)) return 'An account with this email already exists. Try logging in instead.';
    if (/password should be at least/i.test(message)) return 'Password must be at least 8 characters.';
    if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a little and try again.';
    return message || 'Something went wrong. Please try again.';
  }

  async function getSupabaseClient() {
    if (window.workSatthiSupabase) return window.workSatthiSupabase;
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Supabase client did not load. Check your internet connection and reload the page.');
    }
    if (!window.WORK_SATTHI_SUPABASE_URL || !window.WORK_SATTHI_SUPABASE_KEY) {
      throw new Error('Supabase configuration is missing. Check supabase-config.js.');
    }
    window.workSatthiSupabase = window.supabase.createClient(
      window.WORK_SATTHI_SUPABASE_URL,
      window.WORK_SATTHI_SUPABASE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
    return window.workSatthiSupabase;
  }

  if (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearFeedback();
      if (!validateForm()) return;
      submitBtn.disabled = true;
      submitBtn.textContent = currentMode === 'signup' ? 'Creating account…' : 'Signing in…';

      const email = document.getElementById('email').value.trim().toLowerCase();
      const password = passwordInput.value;
      try {
        const client = await getSupabaseClient();
        if (currentMode === 'signup') {
          const role = roleSelect && roleSelect.value === 'worker' ? 'worker' : 'customer';
          const area = document.getElementById('area');
          const service = document.getElementById('service');
          const rate = document.getElementById('rate');
          const phone = document.getElementById('phone');
          const name = document.getElementById('full-name');
          const { data, error } = await client.auth.signUp({
            email: email,
            password: password,
            options: {
              emailRedirectTo: window.location.origin + '/login.html',
              data: {
                full_name: name.value.trim(),
                role: role,
                phone: phone ? phone.value.trim() : '',
                area: area ? area.value.trim() : '',
                service: service ? service.value : '',
                rate: rate ? rate.value.trim() : ''
              }
            }
          });
          if (error) throw error;
          if (data.session) {
            showFeedback('Account created successfully! Redirecting…', 'is-success');
            window.setTimeout(function () { window.location.href = 'dashboard.html'; }, 900);
          } else {
            // Email confirmation is required: switch to login mode first because setMode()
            // clears old feedback, then show the confirmation message and restore the button.
            setMode('login');
            showFeedback('Account created! Check your email and click the confirmation link. Then log in here to continue.', 'is-success');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Log in';
            }
          }
        } else {
          const { data, error } = await client.auth.signInWithPassword({ email: email, password: password });
          if (error) throw error;
          if (!data.session) throw new Error('Login succeeded but no session was created. Please try again.');
          // Keep the legacy dashboard guard in sync with the Supabase session.
          // The dashboard currently checks this key before it renders.
          localStorage.setItem('workSatthiToken', data.session.access_token);
          localStorage.setItem('workSatthiUser', JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            name: (data.user.user_metadata && data.user.user_metadata.full_name) || (data.user.email || '').split('@')[0],
            role: (data.user.user_metadata && data.user.user_metadata.role) === 'worker' ? 'worker' : 'customer'
          }));
          showFeedback('Signed in successfully! Redirecting…', 'is-success');
          window.setTimeout(function () { window.location.href = 'dashboard.html'; }, 700);
        }
      } catch (error) {
        showFeedback(friendlyAuthError(error), 'is-error');
        submitBtn.disabled = false;
        submitBtn.textContent = currentMode === 'signup' ? 'Create account' : 'Log in';
      }
    });
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'signup' || params.has('role')) setMode('signup');
  const roleParam = params.get('role');
  if (roleSelect && (roleParam === 'worker' || roleParam === 'customer')) {
    roleSelect.value = roleParam;
    syncWorkerFields();
  }
}());
