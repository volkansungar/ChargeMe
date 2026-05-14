import { api } from './services/api.js';
import { renderMap } from './modules/station-map.js';
import { renderVehicles } from './modules/vehicle-registration.js';
import { renderReservations } from './modules/reservation.js';
import { renderSessions } from './modules/charging-session.js';
import { renderHistory } from './modules/history.js';
import { renderWalletModal } from './modules/wallet.js';
import { renderWelcome } from './modules/welcome.js';
import { renderLogin } from './modules/login.js';
import { renderAdminDashboard } from './modules/admin/dashboard.js';
import { renderManageStations } from './modules/admin/manage-stations.js';
import { renderAdminMarketing } from './modules/admin/marketing.js';
import { renderAdminIssues } from './modules/admin/issues.js';

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('#nav-theme i');
  if (icon) {
    icon.className = theme === 'light' ? 'ph ph-sun' : 'ph ph-moon';
  }
}

// Global state
window.appState = {
  wallet: { balance: 0 },
  vehicles: [],
  user: null,
  isAdmin: false
};

// Auth helpers
function isLoggedIn() {
  return !!window.appState.user;
}

function isAdmin() {
  return window.appState.user?.role === 'admin';
}

function updateUserDisplay() {
  const userBtn = document.getElementById('nav-user');
  const walletBtn = document.getElementById('nav-wallet');
  const adminBtn = document.getElementById('nav-admin');

  if (isLoggedIn()) {
    // Show user button with username
    userBtn.classList.remove('hidden');
    const usernameEl = userBtn.querySelector('.user-name');
    if (usernameEl) {
      usernameEl.textContent = window.appState.user.username;
    }
    const avatarEl = userBtn.querySelector('.user-avatar');
    if (avatarEl) {
      avatarEl.setAttribute('data-initial', window.appState.user.username.charAt(0).toUpperCase());
    }

    // Show admin button only for admin users
    if (isAdmin()) {
      adminBtn.classList.remove('hidden');
    } else {
      adminBtn.classList.add('hidden');
    }
  } else {
    userBtn.classList.add('hidden');
    adminBtn.classList.add('hidden');
    walletBtn.classList.add('hidden');
  }
}

// Router
async function handleRoute() {
  const hash = window.location.hash || '#/welcome';
  const route = hash.replace('#/', '');
  
  const content = document.getElementById('main-content');
  const isLoginRoute = route === 'login';
  const isWelcome = route === 'welcome';
  const isRouteAdmin = route.startsWith('admin');

  // ── Auth guard: redirect to login if not authenticated ──
  const publicRoutes = ['welcome', 'login'];
  if (!publicRoutes.includes(route) && !isLoggedIn()) {
    window.location.hash = '#/login';
    return;
  }

  // ── Admin guard: redirect non-admin users away from admin routes ──
  if (isRouteAdmin && !isAdmin()) {
    window.showToast('Access denied. Admin privileges required.', 'error');
    window.location.hash = '#/map';
    return;
  }

  // ── If logged in and trying to access login/welcome, redirect ──
  if (isLoggedIn() && (isLoginRoute || isWelcome)) {
    if (isAdmin()) {
      window.location.hash = '#/admin/dashboard';
    } else {
      window.location.hash = '#/map';
    }
    return;
  }

  // Update nav UI
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.route === route);
  });

  content.innerHTML = '<div style="display:flex;justify-content:center;padding:50px;"><div class="spinner"></div></div>';

  // Nav visibility
  const mainNav = document.getElementById('main-nav');
  mainNav.classList.toggle('hidden', isLoginRoute);
  mainNav.classList.toggle('nav-transparent', isWelcome);
  
  document.getElementById('app-brand').classList.toggle('hidden', isWelcome || isLoginRoute);
  document.getElementById('driver-nav-links').classList.toggle('hidden', isRouteAdmin || isWelcome || isLoginRoute);
  document.getElementById('admin-nav-links').classList.toggle('hidden', !isRouteAdmin || isWelcome || isLoginRoute);
  document.getElementById('nav-wallet').classList.toggle('hidden', isRouteAdmin || isWelcome || isLoginRoute || !isLoggedIn());
  
  // Admin button
  const adminBtn = document.getElementById('nav-admin');
  if (isAdmin()) {
    adminBtn.classList.toggle('hidden', isWelcome || isLoginRoute);
    adminBtn.classList.toggle('active', isRouteAdmin);
    adminBtn.querySelector('span').textContent = isRouteAdmin ? 'Driver Mode' : 'Admin';
  } else {
    adminBtn.classList.add('hidden');
  }

  // User button
  document.getElementById('nav-user').classList.toggle('hidden', isLoginRoute || isWelcome || !isLoggedIn());
  
  // Theme toggle
  document.getElementById('nav-theme').classList.toggle('hidden', isLoginRoute);

  window.appState.isAdmin = isRouteAdmin;

  try {
    switch (route) {
      case 'login':
        await renderLogin(content);
        break;
      case 'welcome':
        await renderWelcome(content);
        break;
      case 'map':
        await renderMap(content);
        break;
      case 'vehicles':
        await renderVehicles(content);
        break;
      case 'reservations':
        await renderReservations(content);
        break;
      case 'session':
        await renderSessions(content);
        break;
      case 'history':
        await renderHistory(content);
        break;
      case 'admin/dashboard':
        await renderAdminDashboard(content);
        break;
      case 'admin/marketing':
        await renderAdminMarketing(content);
        break;
      case 'admin/issues':
        await renderAdminIssues(content);
        break;
      case 'admin/stations':
        await renderManageStations(content);
        break;
      default:
        window.location.hash = isLoggedIn() ? (isAdmin() ? '#/admin/dashboard' : '#/map') : '#/login';
    }
  } catch (err) {
    content.innerHTML = `<div class="glass-card"><h2 class="text-red">Error</h2><p>${err.message}</p></div>`;
  }
}

// Global UI Helpers
window.showToast = (message, type = 'success') => {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '<i class="ph ph-check-circle"></i>' : '<i class="ph ph-x-circle"></i>'}</span>
    <span style="flex: 1;">${message}</span>
  `;
  
  let dismissTimer;
  const startDismissTimer = (delay = 3000) => {
    dismissTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, delay);
  };

  toast.addEventListener('mouseenter', () => clearTimeout(dismissTimer));
  toast.addEventListener('mouseleave', () => startDismissTimer(1500));

  container.appendChild(toast);
  startDismissTimer();
};

window.openModal = (contentHtml) => {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div style="width: 36px; height: 5px; background: var(--bg-3); border-radius: 99px; margin: -16px auto 20px auto; opacity: 0.5;"></div>
    <button class="modal-close" onclick="window.closeModal()">×</button>
    ${contentHtml}
  `;
  overlay.classList.remove('hidden');
  document.body.classList.add('modal-open');
};

window.closeModal = () => {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.body.classList.remove('modal-open');
};

export async function updateWalletDisplay() {
  if (!isLoggedIn()) return;
  try {
    const wallet = await api.getWallet();
    window.appState.wallet = wallet;
    const el = document.getElementById('wallet-balance');
    el.textContent = `₺${wallet.balance.toFixed(2)}`;
    
    if (wallet.balance < 50) {
      el.classList.add('text-red');
      window.showToast('Low wallet balance! Please top up soon.', 'error');
    } else {
      el.classList.remove('text-red');
    }
  } catch (err) {
    console.error('Failed to update wallet:', err);
  }
}

// Logout handler
function handleLogout() {
  api.logout();
  window.appState.user = null;
  window.appState.vehicles = [];
  window.appState.wallet = { balance: 0 };
  window.showToast('Signed out successfully.');
  window.location.hash = '#/login';
}

// Show user menu dropdown
function showUserMenu() {
  const existing = document.querySelector('.user-dropdown');
  if (existing) {
    existing.remove();
    return;
  }

  const user = window.appState.user;
  const dropdown = document.createElement('div');
  dropdown.className = 'user-dropdown';
  dropdown.innerHTML = `
    <div class="user-dropdown-header">
      <div class="user-avatar-lg">${user.username.charAt(0).toUpperCase()}</div>
      <div>
        <div style="font-weight: 600; font-size: 14px;">${user.username}</div>
        <div style="font-size: 12px; color: var(--text-2);">${user.email}</div>
        <div style="font-size: 11px; margin-top: 2px;">
          <span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">${user.role.toUpperCase()}</span>
        </div>
      </div>
    </div>
    <div class="user-dropdown-divider"></div>
    <button class="user-dropdown-item" id="dropdown-logout">
      <i class="ph ph-sign-out"></i>
      <span>Sign Out</span>
    </button>
  `;

  document.getElementById('nav-user').appendChild(dropdown);

  dropdown.querySelector('#dropdown-logout').addEventListener('click', handleLogout);

  // Close on outside click
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!dropdown.contains(e.target) && !document.getElementById('nav-user').contains(e.target)) {
        dropdown.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 10);
}

// Init
async function init() {
  initTheme();

  // Try to restore session from stored token
  const token = localStorage.getItem('auth_token');
  if (token) {
    try {
      const user = await api.getMe();
      window.appState.user = user;
      window.appState.wallet = { balance: user.balance };
    } catch (err) {
      // Token invalid/expired, clear it
      localStorage.removeItem('auth_token');
      window.appState.user = null;
    }
  }

  updateUserDisplay();

  // Event listeners
  document.getElementById('nav-wallet').addEventListener('click', renderWalletModal);
  
  // Logo goes to map (or admin dashboard)
  document.getElementById('app-brand').addEventListener('click', () => {
    if (isAdmin() && window.appState.isAdmin) {
      window.location.hash = '#/admin/dashboard';
    } else {
      window.location.hash = '#/map';
    }
  });

  // Admin Toggle Button — only visible to admins
  document.getElementById('nav-admin').addEventListener('click', () => {
    if (!isAdmin()) return;
    if (window.location.hash.includes('admin')) {
      window.location.hash = '#/map';
    } else {
      window.location.hash = '#/admin/dashboard';
    }
  });

  // Theme Toggle
  document.getElementById('nav-theme').addEventListener('click', toggleTheme);

  // User menu
  document.getElementById('nav-user').addEventListener('click', (e) => {
    // Don't trigger if clicking inside dropdown
    if (e.target.closest('.user-dropdown')) return;
    showUserMenu();
  });

  // Initial data fetch (if logged in)
  if (isLoggedIn()) {
    await updateWalletDisplay();
    try {
      window.appState.vehicles = await api.getVehicles();
    } catch(e) {}
  }
  
  // Global Event Listeners
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
      window.closeModal();
    }
  });
  
  // Set up routing
  window.addEventListener('hashchange', () => {
    updateUserDisplay();
    handleRoute();
  });
  handleRoute();
}

init();
