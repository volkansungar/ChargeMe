import { api } from './services/api.js';
import { renderMap } from './modules/station-map.js';
import { renderVehicles } from './modules/vehicle-registration.js';
import { renderReservations } from './modules/reservation.js';
import { renderSessions } from './modules/charging-session.js';
import { renderHistory } from './modules/history.js';
import { renderWalletModal } from './modules/wallet.js';
import { renderWelcome } from './modules/welcome.js';
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
  vehicles: []
};

// Router
async function handleRoute() {
  const hash = window.location.hash || '#/welcome';
  const route = hash.replace('#/', '');
  
  // Update nav UI
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.route === route);
  });

  const content = document.getElementById('main-content');
  content.innerHTML = '<div style="display:flex;justify-content:center;padding:50px;"><div class="spinner"></div></div>';

  // Auth / UI Mode Switch
  const isRouteAdmin = route.startsWith('admin');
  const isWelcome = route === 'welcome';
  
  document.getElementById('main-nav').classList.remove('hidden'); // Show nav everywhere
  document.getElementById('main-nav').classList.toggle('nav-transparent', isWelcome);
  document.getElementById('app-brand').classList.toggle('hidden', isWelcome); // Hide brand on welcome for cinematic feel
  document.getElementById('driver-nav-links').classList.toggle('hidden', isRouteAdmin || isWelcome);
  document.getElementById('admin-nav-links').classList.toggle('hidden', !isRouteAdmin || isWelcome);
  document.getElementById('nav-wallet').classList.toggle('hidden', isRouteAdmin || isWelcome);
  document.getElementById('nav-admin').classList.toggle('hidden', isWelcome);
  document.getElementById('nav-admin').classList.toggle('active', isRouteAdmin);
  document.getElementById('nav-admin').querySelector('span').textContent = isRouteAdmin ? 'Driver Mode' : 'Admin';

  window.appState.isAdmin = isRouteAdmin;

  try {
    switch (route) {
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
        window.location.hash = window.appState.isAdmin ? '#/admin/dashboard' : '#/welcome';
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

// Init
async function init() {
  document.getElementById('nav-wallet').addEventListener('click', renderWalletModal);
  
  // Logo goes to Welcome
  document.getElementById('app-brand').addEventListener('click', () => {
    window.location.hash = '#/welcome';
  });

  // Admin Toggle Button
  document.getElementById('nav-admin').addEventListener('click', () => {
    if (window.location.hash.includes('admin')) {
      window.location.hash = '#/map';
    } else {
      window.location.hash = '#/admin/dashboard';
    }
  });

  // Theme Toggle
  document.getElementById('nav-theme').addEventListener('click', toggleTheme);

  // Initial fetch
  initTheme();
  await updateWalletDisplay();
  try {
    window.appState.vehicles = await api.getVehicles();
  } catch(e) {}
  
  // Global Event Listeners
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
      window.closeModal();
    }
  });
  
  // Set up routing
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

init();
