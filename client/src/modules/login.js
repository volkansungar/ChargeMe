import { api } from '../services/api.js';

export async function renderLogin(container) {
  container.innerHTML = `
    <div class="login-container">
      <div class="login-card glass-card">
        
        <!-- Header -->
        <div class="login-header">
          <div class="login-logo">
            <i class="ph-fill ph-lightning"></i>
          </div>
          <h1>ChargeMe</h1>
          <p class="text-secondary">EV Charging Network — İzmir</p>
        </div>

        <!-- Tab Switcher -->
        <div class="login-tabs">
          <button class="login-tab active" id="tab-login" data-tab="login">Sign In</button>
          <button class="login-tab" id="tab-register" data-tab="register">Create Account</button>
        </div>

        <!-- Login Form -->
        <form id="login-form" class="login-form" autocomplete="on">
          <div class="form-group">
            <label class="form-label" for="login-username">Username or Email</label>
            <div class="input-wrapper">
              <i class="ph ph-user input-icon"></i>
              <input type="text" id="login-username" class="form-input form-input-icon" placeholder="Enter your username" autocomplete="username" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="login-password">Password</label>
            <div class="input-wrapper">
              <i class="ph ph-lock input-icon"></i>
              <input type="password" id="login-password" class="form-input form-input-icon" placeholder="Enter your password" autocomplete="current-password" required>
            </div>
          </div>
          <div id="login-error" class="form-error hidden"></div>
          <button type="submit" class="btn btn-primary login-btn" id="login-submit">
            <span>Sign In</span>
            <i class="ph ph-sign-in"></i>
          </button>
        </form>

        <!-- Register Form -->
        <form id="register-form" class="login-form hidden" autocomplete="on">
          <div class="form-group">
            <label class="form-label" for="reg-username">Username</label>
            <div class="input-wrapper">
              <i class="ph ph-user input-icon"></i>
              <input type="text" id="reg-username" class="form-input form-input-icon" placeholder="Choose a username" autocomplete="username" required minlength="3" maxlength="30">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-email">Email</label>
            <div class="input-wrapper">
              <i class="ph ph-envelope input-icon"></i>
              <input type="email" id="reg-email" class="form-input form-input-icon" placeholder="your@email.com" autocomplete="email" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-password">Password</label>
            <div class="input-wrapper">
              <i class="ph ph-lock input-icon"></i>
              <input type="password" id="reg-password" class="form-input form-input-icon" placeholder="Min. 6 characters" autocomplete="new-password" required minlength="6">
            </div>
            <div class="password-strength" id="password-strength">
              <div class="strength-bar"><div class="strength-fill" id="strength-fill"></div></div>
              <span class="strength-label" id="strength-label"></span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-confirm">Confirm Password</label>
            <div class="input-wrapper">
              <i class="ph ph-lock-key input-icon"></i>
              <input type="password" id="reg-confirm" class="form-input form-input-icon" placeholder="Re-enter password" autocomplete="new-password" required>
            </div>
          </div>
          <div id="register-error" class="form-error hidden"></div>
          <button type="submit" class="btn btn-primary login-btn" id="register-submit">
            <span>Create Account</span>
            <i class="ph ph-user-plus"></i>
          </button>
        </form>

        <!-- Demo Credentials -->
        <div class="demo-credentials">
          <p class="text-muted" style="font-size: 12px; margin-bottom: 8px;">Demo Accounts:</p>
          <div style="display: flex; gap: 8px;">
            <button class="btn-chip demo-fill" data-user="admin" data-pass="admin123">
              <i class="ph ph-shield-checkered"></i> Admin
            </button>
            <button class="btn-chip demo-fill" data-user="driver" data-pass="driver123">
              <i class="ph ph-car-profile"></i> Driver
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <p class="login-footer text-muted">© 2026 EV Charge Network • Ege University FSE • Group 29</p>
    </div>
  `;

  // Tab switching
  const tabs = container.querySelectorAll('.login-tab');
  const loginForm = container.querySelector('#login-form');
  const registerForm = container.querySelector('#register-form');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      if (tab.dataset.tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
      } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
      }

      // Clear errors
      container.querySelector('#login-error').classList.add('hidden');
      container.querySelector('#register-error').classList.add('hidden');
    });
  });

  // Demo credential buttons
  container.querySelectorAll('.demo-fill').forEach(btn => {
    btn.addEventListener('click', () => {
      // Switch to login tab
      tabs[0].click();
      container.querySelector('#login-username').value = btn.dataset.user;
      container.querySelector('#login-password').value = btn.dataset.pass;
      // Add a subtle animation
      container.querySelector('#login-username').classList.add('input-filled');
      container.querySelector('#login-password').classList.add('input-filled');
      setTimeout(() => {
        container.querySelector('#login-username').classList.remove('input-filled');
        container.querySelector('#login-password').classList.remove('input-filled');
      }, 600);
    });
  });

  // Password strength indicator
  const regPassword = container.querySelector('#reg-password');
  const strengthFill = container.querySelector('#strength-fill');
  const strengthLabel = container.querySelector('#strength-label');

  regPassword.addEventListener('input', () => {
    const val = regPassword.value;
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
      { width: '0%', color: 'var(--gray-3)', label: '' },
      { width: '20%', color: 'var(--red)', label: 'Weak' },
      { width: '40%', color: 'var(--orange)', label: 'Fair' },
      { width: '60%', color: 'var(--yellow)', label: 'Good' },
      { width: '80%', color: 'var(--green)', label: 'Strong' },
      { width: '100%', color: 'var(--green)', label: 'Excellent' },
    ];

    const level = levels[score] || levels[0];
    strengthFill.style.width = level.width;
    strengthFill.style.background = level.color;
    strengthLabel.textContent = level.label;
    strengthLabel.style.color = level.color;
  });

  // Login submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = container.querySelector('#login-error');
    const submitBtn = container.querySelector('#login-submit');
    const username = container.querySelector('#login-username').value.trim();
    const password = container.querySelector('#login-password').value;

    if (!username || !password) {
      errorEl.textContent = 'Please fill in all fields.';
      errorEl.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;"></div><span>Signing in...</span>';
    errorEl.classList.add('hidden');

    try {
      const result = await api.login(username, password);
      window.appState.user = result.user;
      window.appState.wallet = { balance: result.user.balance };
      window.showToast(`Welcome back, ${result.user.username}!`);
      
      // Redirect based on role
      if (result.user.role === 'admin') {
        window.location.hash = '#/admin/dashboard';
      } else {
        window.location.hash = '#/map';
      }
    } catch (err) {
      errorEl.textContent = err.message || 'Login failed. Please try again.';
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Sign In</span><i class="ph ph-sign-in"></i>';
    }
  });

  // Register submit
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = container.querySelector('#register-error');
    const submitBtn = container.querySelector('#register-submit');
    const username = container.querySelector('#reg-username').value.trim();
    const email = container.querySelector('#reg-email').value.trim();
    const password = container.querySelector('#reg-password').value;
    const confirmPassword = container.querySelector('#reg-confirm').value;

    if (!username || !email || !password || !confirmPassword) {
      errorEl.textContent = 'Please fill in all fields.';
      errorEl.classList.remove('hidden');
      return;
    }

    if (password !== confirmPassword) {
      errorEl.textContent = 'Passwords do not match.';
      errorEl.classList.remove('hidden');
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters.';
      errorEl.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;"></div><span>Creating account...</span>';
    errorEl.classList.add('hidden');

    try {
      const result = await api.register({ username, email, password, confirmPassword });
      window.appState.user = result.user;
      window.appState.wallet = { balance: result.user.balance };
      window.showToast(`Welcome, ${result.user.username}! Your account is ready.`);
      window.location.hash = '#/map';
    } catch (err) {
      errorEl.textContent = err.message || 'Registration failed. Please try again.';
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Create Account</span><i class="ph ph-user-plus"></i>';
    }
  });
}
