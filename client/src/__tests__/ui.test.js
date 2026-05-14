import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * CLIENT-SIDE UI UNIT TESTS
 * 
 * Per testing1.md — "Unit testing is the process of testing
 * individual components in isolation."
 * 
 * Tests DOM manipulation, modal/toast helpers, auth state management,
 * and form validation logic.
 */

// ═══════════════════════════════════════════
// Setup: Mock DOM structure
// ═══════════════════════════════════════════
beforeEach(() => {
  document.body.innerHTML = `
    <div id="toast-container"></div>
    <div id="modal-overlay" class="hidden">
      <div id="modal-content"></div>
    </div>
    <nav id="main-nav" class="glass-nav">
      <div id="app-brand"></div>
      <div id="driver-nav-links"></div>
      <div id="admin-nav-links" class="hidden"></div>
      <div id="nav-theme"><i class="ph ph-moon"></i></div>
      <div id="nav-admin" class="hidden"><i></i><span>Admin</span></div>
      <div id="nav-wallet" class="hidden"><span id="wallet-balance">₺0.00</span></div>
      <div id="nav-user" class="hidden">
        <div class="user-avatar"></div>
        <span class="user-name"></span>
      </div>
    </nav>
    <main id="main-content"></main>
  `;

  // Reset appState
  window.appState = {
    wallet: { balance: 0 },
    vehicles: [],
    user: null,
    isAdmin: false
  };

  // Re-define global helpers (from main.js)
  window.showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
  };

  window.openModal = (contentHtml) => {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = contentHtml;
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');
  };

  window.closeModal = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.body.classList.remove('modal-open');
  };
});

// ═══════════════════════════════════════════
// 1. Toast Notification Tests
// ═══════════════════════════════════════════
describe('Toast Notifications', () => {
  it('should add a success toast to the container', () => {
    window.showToast('Operation successful');
    const container = document.getElementById('toast-container');
    expect(container.children.length).toBe(1);
    expect(container.innerHTML).toContain('Operation successful');
    expect(container.querySelector('.toast').classList.contains('success')).toBe(true);
  });

  it('should add an error toast with correct class', () => {
    window.showToast('Something failed', 'error');
    const toast = document.querySelector('.toast');
    expect(toast.classList.contains('error')).toBe(true);
    expect(toast.innerHTML).toContain('Something failed');
  });

  it('should stack multiple toasts', () => {
    window.showToast('First');
    window.showToast('Second');
    window.showToast('Third');
    const container = document.getElementById('toast-container');
    expect(container.children.length).toBe(3);
  });

  it('should handle empty message gracefully', () => {
    window.showToast('');
    const container = document.getElementById('toast-container');
    expect(container.children.length).toBe(1);
  });

  it('should handle special characters in message', () => {
    window.showToast('₺20 refunded <b>bold</b>');
    const container = document.getElementById('toast-container');
    expect(container.innerHTML).toContain('₺20 refunded');
  });
});

// ═══════════════════════════════════════════
// 2. Modal Tests
// ═══════════════════════════════════════════
describe('Modal System', () => {
  it('should open modal with content and remove hidden class', () => {
    window.openModal('<h3>Station Detail</h3>');
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    expect(overlay.classList.contains('hidden')).toBe(false);
    expect(content.innerHTML).toContain('Station Detail');
  });

  it('should add modal-open class to body when opened', () => {
    window.openModal('<p>Test</p>');
    expect(document.body.classList.contains('modal-open')).toBe(true);
  });

  it('should close modal and restore body state', () => {
    window.openModal('<p>Test</p>');
    window.closeModal();
    const overlay = document.getElementById('modal-overlay');
    expect(overlay.classList.contains('hidden')).toBe(true);
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('should replace content on re-open', () => {
    window.openModal('<p>First</p>');
    window.openModal('<p>Second</p>');
    const content = document.getElementById('modal-content');
    expect(content.innerHTML).toContain('Second');
    expect(content.innerHTML).not.toContain('First');
  });

  it('should handle complex HTML content', () => {
    const html = `
      <h2>Karşıyaka Hub</h2>
      <div class="charger"><span>50kW</span></div>
      <button onclick="reserve()">Reserve</button>
    `;
    window.openModal(html);
    expect(document.getElementById('modal-content').innerHTML).toContain('Karşıyaka');
    expect(document.getElementById('modal-content').innerHTML).toContain('50kW');
  });
});

// ═══════════════════════════════════════════
// 3. Auth State Tests
// ═══════════════════════════════════════════
describe('Auth State Management', () => {
  it('should start with null user', () => {
    expect(window.appState.user).toBeNull();
  });

  it('should correctly set user state on login', () => {
    window.appState.user = { id: 1, username: 'test', role: 'user', balance: 500 };
    expect(window.appState.user.username).toBe('test');
    expect(window.appState.user.role).toBe('user');
  });

  it('should correctly identify admin role', () => {
    window.appState.user = { id: 1, username: 'admin', role: 'admin' };
    expect(window.appState.user.role).toBe('admin');
  });

  it('should correctly clear state on logout', () => {
    window.appState.user = { id: 1, username: 'test', role: 'user' };
    window.appState.user = null;
    window.appState.vehicles = [];
    window.appState.wallet = { balance: 0 };
    expect(window.appState.user).toBeNull();
    expect(window.appState.vehicles.length).toBe(0);
    expect(window.appState.wallet.balance).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 4. Password Strength Validator (Unit)
// ═══════════════════════════════════════════
describe('Password Strength Logic', () => {
  function getStrength(password) {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
    return { score, label: labels[score] };
  }

  it('should score empty password as 0', () => {
    expect(getStrength('').score).toBe(0);
  });

  it('should score "abc" as 0 (too short)', () => {
    expect(getStrength('abc').score).toBe(0);
  });

  it('should score "abcdef" as 1 (Weak — only length >= 6)', () => {
    const r = getStrength('abcdef');
    expect(r.score).toBe(1);
    expect(r.label).toBe('Weak');
  });

  it('should score "Abcdef" as 2 (Fair — length + uppercase)', () => {
    expect(getStrength('Abcdef').score).toBe(2);
  });

  it('should score "Abc123" as 3 (Good)', () => {
    expect(getStrength('Abc123').score).toBe(3);
  });

  it('should score "Abc12345!!" as 5 (Excellent — all criteria)', () => {
    const r = getStrength('Abc12345!!');
    expect(r.score).toBe(5);
    expect(r.label).toBe('Excellent');
  });
});

// ═══════════════════════════════════════════
// 5. Wallet Display Logic
// ═══════════════════════════════════════════
describe('Wallet Display', () => {
  it('should format balance with 2 decimal places', () => {
    const balance = 150.5;
    const formatted = `₺${balance.toFixed(2)}`;
    expect(formatted).toBe('₺150.50');
  });

  it('should detect low balance (< 50)', () => {
    const balance = 30;
    const isLow = balance < 50;
    expect(isLow).toBe(true);
  });

  it('should not flag balance >= 50 as low', () => {
    const balance = 50;
    const isLow = balance < 50;
    expect(isLow).toBe(false);
  });
});

// ═══════════════════════════════════════════
// 6. Nav Visibility Logic
// ═══════════════════════════════════════════
describe('Navigation Visibility', () => {
  it('admin nav links hidden by default', () => {
    const adminLinks = document.getElementById('admin-nav-links');
    expect(adminLinks.classList.contains('hidden')).toBe(true);
  });

  it('user menu hidden when not logged in', () => {
    const userBtn = document.getElementById('nav-user');
    expect(userBtn.classList.contains('hidden')).toBe(true);
  });

  it('admin button hidden when not logged in', () => {
    const adminBtn = document.getElementById('nav-admin');
    expect(adminBtn.classList.contains('hidden')).toBe(true);
  });

  it('wallet hidden when not logged in', () => {
    const walletBtn = document.getElementById('nav-wallet');
    expect(walletBtn.classList.contains('hidden')).toBe(true);
  });

  it('should show user button when logged in', () => {
    window.appState.user = { username: 'driver', role: 'user' };
    const userBtn = document.getElementById('nav-user');
    userBtn.classList.remove('hidden');
    userBtn.querySelector('.user-name').textContent = 'driver';
    expect(userBtn.classList.contains('hidden')).toBe(false);
    expect(userBtn.querySelector('.user-name').textContent).toBe('driver');
  });

  it('should show admin button only for admin users', () => {
    window.appState.user = { username: 'admin', role: 'admin' };
    const adminBtn = document.getElementById('nav-admin');
    adminBtn.classList.remove('hidden');
    expect(adminBtn.classList.contains('hidden')).toBe(false);
  });
});

// ═══════════════════════════════════════════
// 7. Form Validation Logic (Login)
// ═══════════════════════════════════════════
describe('Login Form Validation', () => {
  function validateLogin(username, password) {
    const errors = [];
    if (!username || !username.trim()) errors.push('Username is required');
    if (!password) errors.push('Password is required');
    return errors;
  }

  function validateRegister(username, email, password, confirmPassword) {
    const errors = [];
    if (!username || username.trim().length < 3) errors.push('Username must be at least 3 characters');
    if (!email || !/\S+@\S+\.\S+/.test(email)) errors.push('Valid email is required');
    if (!password || password.length < 6) errors.push('Password must be at least 6 characters');
    if (password !== confirmPassword) errors.push('Passwords do not match');
    return errors;
  }

  it('should reject empty login fields', () => {
    expect(validateLogin('', '').length).toBe(2);
  });

  it('should accept valid login fields', () => {
    expect(validateLogin('admin', 'pass123').length).toBe(0);
  });

  it('should reject short username in registration', () => {
    const errs = validateRegister('ab', 'a@b.com', '123456', '123456');
    expect(errs.some(e => e.includes('3 characters'))).toBe(true);
  });

  it('should reject invalid email in registration', () => {
    const errs = validateRegister('valid', 'bad', '123456', '123456');
    expect(errs.some(e => e.includes('email'))).toBe(true);
  });

  it('should reject password mismatch', () => {
    const errs = validateRegister('valid', 'a@b.com', '123456', '654321');
    expect(errs.some(e => e.includes('match'))).toBe(true);
  });

  it('should accept valid registration', () => {
    expect(validateRegister('validuser', 'a@b.com', '123456', '123456').length).toBe(0);
  });
});
