import { api } from '../services/api.js';
import { updateWalletDisplay } from '../main.js';

let activeIntervals = {};

export async function renderSessions(container) {
  container.innerHTML = `
    <h2 class="text-gradient" style="margin-bottom: var(--spacing-6);">Active Charging Sessions</h2>
    <div id="active-sessions-list" style="display: flex; flex-direction: column; gap: var(--spacing-6);">
      <div class="spinner"></div>
    </div>
  `;

  await refreshSessions();
}

async function refreshSessions() {
  const container = document.getElementById('active-sessions-list');
  try {
    const allSessions = await api.getSessions();
    const activeSessions = allSessions.filter(s => s.status === 'charging');

    if (activeSessions.length === 0) {
      container.innerHTML = `
        <div class="glass-card" style="text-align: center; padding: var(--spacing-8);">
          <div style="font-size: 3rem; margin-bottom: 1rem;"><i class="ph ph-battery-empty"></i></div>
          <h3 class="text-secondary">No active charging sessions</h3>
          <p class="text-muted" style="margin-bottom: 1.5rem;">Start a session from your confirmed reservations or directly at a station.</p>
          <a href="#/reservations" class="btn btn-primary">View Reservations</a>
        </div>
      `;
      return;
    }

    container.innerHTML = activeSessions.map(s => {
      // Calculate max kWh based on battery capacity
      const maxKwh = s.battery_capacity;
      const pct = Math.min(100, Math.round((s.current_kwh / maxKwh) * 100));
      
      // Calculate estimated time remaining
      // Power is in kW (kWh per hour). Remaining kWh / Power = hours remaining
      const remainingKwh = maxKwh - s.current_kwh;
      const hoursRemaining = remainingKwh / s.power_kw;
      const minsRemaining = Math.round(hoursRemaining * 60);
      
      let timeText = '';
      if (minsRemaining > 60) {
        timeText = `${Math.floor(minsRemaining/60)}h ${minsRemaining%60}m remaining`;
      } else if (minsRemaining > 0) {
        timeText = `${minsRemaining}m remaining`;
      } else {
        timeText = 'Almost full';
      }

      return `
        <div class="glass-card" id="session-card-${s.id}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
            <div>
              <div class="badge badge-available" style="margin-bottom: 0.5rem; animation: pulse 2s infinite;"><i class="ph ph-lightning"></i> CHARGING</div>
              <h3 style="margin:0;">${s.station_name}</h3>
              <p class="text-secondary">${s.charger_label} (${s.power_kw}kW)</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-cyan);" id="session-cost-${s.id}">₺${s.cost.toFixed(2)}</div>
              <div class="text-muted" style="font-size: 0.85rem;">₺${s.price_per_kwh}/kWh</div>
            </div>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-weight: 600;">
              <span id="session-kwh-${s.id}">${s.current_kwh.toFixed(1)} kWh</span>
              <span id="session-pct-${s.id}">${pct}%</span>
            </div>
            <div class="progress-bg">
              <div class="progress-fill" id="session-bar-${s.id}" style="width: ${pct}%"></div>
            </div>
            <div style="text-align: center; margin-top: 0.5rem; font-size: 0.85rem; color: var(--accent-amber);" id="session-time-${s.id}">
              <i class="ph ph-timer"></i> ${timeText}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="text-muted" style="font-size: 0.9rem;">
              <i class="ph ph-car-profile"></i> ${s.vehicle_brand} ${s.vehicle_model}
            </div>
            <button class="btn btn-danger" onclick="stopSession(${s.id})"><i class="ph ph-stop-circle"></i> Stop Charging</button>
          </div>
        </div>
      `;
    }).join('');

    // Start simulation loops for active sessions
    activeSessions.forEach(s => {
      if (!activeIntervals[s.id]) {
        simulateCharging(s);
      }
    });

  } catch (err) {
    container.innerHTML = `<div class="text-red">Failed to load active sessions</div>`;
  }
}

function simulateCharging(session) {
  let currentKwh = session.current_kwh;
  const maxKwh = session.battery_capacity;
  // Simulate speed: add kW based on charger power, but speed up time for demo purposes
  // Real: power_kw per hour -> power_kw / 3600 per second
  // Demo: speed up by 100x -> (power_kw / 3600) * 100 per second
  const incrementPerSec = (session.power_kw / 3600) * 100;

  activeIntervals[session.id] = setInterval(async () => {
    currentKwh += incrementPerSec;
    if (currentKwh >= maxKwh) {
      currentKwh = maxKwh;
      clearInterval(activeIntervals[session.id]);
      delete activeIntervals[session.id];
      await window.stopSession(session.id, currentKwh); // Auto stop
      return;
    }

    try {
      // Update backend silently
      const updated = await api.updateSession(session.id, { current_kwh: currentKwh });
      
      // Update UI directly without full re-render
      const pct = Math.min(100, Math.round((currentKwh / maxKwh) * 100));
      const remainingKwh = maxKwh - currentKwh;
      const hoursRemaining = remainingKwh / session.power_kw;
      const minsRemaining = Math.round((hoursRemaining * 60) / 100); // scaled for demo
      
      const elBar = document.getElementById(`session-bar-${session.id}`);
      const elPct = document.getElementById(`session-pct-${session.id}`);
      const elKwh = document.getElementById(`session-kwh-${session.id}`);
      const elCost = document.getElementById(`session-cost-${session.id}`);
      const elTime = document.getElementById(`session-time-${session.id}`);

      if(elBar) elBar.style.width = `${pct}%`;
      if(elPct) elPct.textContent = `${pct}%`;
      if(elKwh) elKwh.textContent = `${currentKwh.toFixed(1)} kWh`;
      if(elCost) elCost.textContent = `₺${updated.cost.toFixed(2)}`;
      if(elTime) elTime.innerHTML = `<i class="ph ph-timer"></i> ~${minsRemaining}s remaining (demo time)`;

    } catch (e) {
      console.error('Simulation update failed', e);
    }
  }, 1000); // every 1s
}

window.stopSession = async (id, finalKwh = null) => {
  if (activeIntervals[id]) {
    clearInterval(activeIntervals[id]);
    delete activeIntervals[id];
  }

  const btn = document.querySelector(`#session-card-${id} button`);
  if(btn) {
    btn.disabled = true;
    btn.textContent = 'Stopping...';
  }

  try {
    const data = finalKwh ? { end_kwh: finalKwh } : {};
    const res = await api.endSession(id, data);
    
    window.showToast(`Session ended. Total cost: ₺${res.session.cost.toFixed(2)}`);
    await updateWalletDisplay();
    
    // Show digital receipt
    showReceipt(res.session);
    
  } catch (err) {
    window.showToast(err.message, 'error');
    if(btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ph ph-stop-circle"></i> Stop Charging';
    }
  }
};

function showReceipt(session) {
  const html = `
    <div style="text-align: center; margin-bottom: var(--spacing-6);">
      <div style="font-size: 3rem; margin-bottom: 1rem;"><i class="ph ph-receipt"></i></div>
      <h2 class="text-gradient">Digital Receipt</h2>
      <p class="text-secondary">${new Date().toLocaleString()}</p>
    </div>

    <div style="background: rgba(0,0,0,0.2); padding: var(--spacing-4); border-radius: var(--radius-md); font-family: monospace; font-size: 1.1rem;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span class="text-muted">Station:</span>
        <span style="text-align:right;">${session.station_name}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span class="text-muted">Charger:</span>
        <span>${session.charger_label}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span class="text-muted">Vehicle:</span>
        <span>${session.vehicle_brand} ${session.vehicle_model}</span>
      </div>
      <hr style="border-color: var(--glass-border); margin: 1rem 0;" />
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span class="text-muted">Energy Consumed:</span>
        <span>${session.consumed_kwh.toFixed(2)} kWh</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span class="text-muted">Unit Price:</span>
        <span>₺${session.price_per_kwh.toFixed(2)}/kWh</span>
      </div>
      <hr style="border-color: var(--glass-border); margin: 1rem 0;" />
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.25rem; color: var(--accent-cyan);">
        <span>TOTAL DEDUCTED:</span>
        <span>₺${session.cost.toFixed(2)}</span>
      </div>
    </div>
    
    <button class="btn btn-primary" style="width: 100%; margin-top: var(--spacing-6);" onclick="window.closeModal(); window.location.hash = '#/history';">Close</button>
  `;
  window.openModal(html);
}

// Cleanup intervals on route change
window.addEventListener('hashchange', () => {
  if (window.location.hash !== '#/session') {
    Object.values(activeIntervals).forEach(clearInterval);
    activeIntervals = {};
  }
});
