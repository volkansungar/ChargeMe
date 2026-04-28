import { api } from './services/api.js';
import { renderMap } from './modules/station-map.js';
import { renderVehicles } from './modules/vehicle-registration.js';
import { renderReservations } from './modules/reservation.js';
import { renderSessions } from './modules/charging-session.js';
import { renderHistory } from './modules/history.js';
import { renderWalletModal } from './modules/wallet.js';

// Global state
window.appState = {
  wallet: { balance: 0 },
  vehicles: []
};

// Router
async function handleRoute() {
  const hash = window.location.hash || '#/map';
  const route = hash.replace('#/', '');
  
  // Update nav UI
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.route === route);
  });

  const content = document.getElementById('main-content');
  content.innerHTML = '<div style="display:flex;justify-content:center;padding:50px;"><div class="spinner"></div></div>';

  try {
    switch (route) {
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
      default:
        window.location.hash = '#/map';
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
    <span>${type === 'success' ? '✅' : '❌'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

window.openModal = (contentHtml) => {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <button class="modal-close" onclick="window.closeModal()">×</button>
    ${contentHtml}
  `;
  overlay.classList.remove('hidden');
};

window.closeModal = () => {
  document.getElementById('modal-overlay').classList.add('hidden');
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
  
  // Initial fetch
  await updateWalletDisplay();
  try {
    window.appState.vehicles = await api.getVehicles();
  } catch(e) {}
  
  // Set up routing
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

init();
