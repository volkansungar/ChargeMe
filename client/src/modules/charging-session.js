import { api } from '../services/api.js';
import { updateWalletDisplay } from '../main.js';

let activeIntervals = {};

export async function renderSessions(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Active Charging Sessions</h2>
    </div>
    <div id="active-sessions-list" style="display: flex; flex-direction: column; gap: 16px;">
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
        <div class="card" style="text-align: center; padding: 48px 20px;">
          <div style="font-size: 32px; margin-bottom: 12px; color: var(--text-2);"><i class="ph ph-battery-empty"></i></div>
          <h3 style="color: var(--text-1); margin-bottom: 4px;">No active sessions</h3>
          <p class="text-muted" style="margin-bottom: 16px; font-size: 13px;">Start a session from your confirmed reservations.</p>
          <a href="#/reservations" class="btn btn-primary">View Reservations</a>
        </div>
      `;
      return;
    }

    container.innerHTML = activeSessions.map(s => {
      const maxKwh = s.battery_capacity;
      const pct = Math.min(100, Math.round((s.current_kwh / maxKwh) * 100));
      
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
        <div class="card" id="session-card-${s.id}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
            <div>
              <div class="badge badge-available" style="margin-bottom: 8px; animation: pulse 2s infinite;"><i class="ph ph-lightning"></i> CHARGING</div>
              <h3 style="font-size: 16px; margin-bottom: 2px;">${s.station_name}</h3>
              <p class="text-muted" style="font-size: 13px;">${s.charger_label} · ${s.power_kw}kW</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 22px; font-weight: 700; color: var(--blue);" id="session-cost-${s.id}">₺${s.cost.toFixed(2)}</div>
              <div class="text-muted" style="font-size: 12px;">₺${s.price_per_kwh}/kWh</div>
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; font-weight: 600;">
              <span id="session-kwh-${s.id}">${s.current_kwh.toFixed(1)} kWh</span>
              <span id="session-pct-${s.id}">${pct}%</span>
            </div>
            <div class="progress-bg">
              <div class="progress-fill" id="session-bar-${s.id}" style="width: ${pct}%"></div>
            </div>
            <div style="text-align: center; margin-top: 6px; font-size: 12px; color: var(--text-2);" id="session-time-${s.id}">
              <i class="ph ph-timer"></i> ${timeText}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="text-muted" style="font-size: 13px;">
              <i class="ph ph-car-profile"></i> ${s.vehicle_brand} ${s.vehicle_model}
            </div>
            <button class="btn btn-danger" onclick="stopSession(${s.id})"><i class="ph ph-stop-circle"></i> Stop</button>
          </div>
        </div>
      `;
    }).join('');

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
  const incrementPerSec = (session.power_kw / 3600) * 100;

  activeIntervals[session.id] = setInterval(async () => {
    currentKwh += incrementPerSec;
    if (currentKwh >= maxKwh) {
      currentKwh = maxKwh;
      clearInterval(activeIntervals[session.id]);
      delete activeIntervals[session.id];
      await window.stopSession(session.id, currentKwh);
      return;
    }

    try {
      const updated = await api.updateSession(session.id, { current_kwh: currentKwh });
      
      const pct = Math.min(100, Math.round((currentKwh / maxKwh) * 100));
      const remainingKwh = maxKwh - currentKwh;
      const hoursRemaining = remainingKwh / session.power_kw;
      const minsRemaining = Math.round((hoursRemaining * 60) / 100);
      
      const elBar = document.getElementById(`session-bar-${session.id}`);
      const elPct = document.getElementById(`session-pct-${session.id}`);
      const elKwh = document.getElementById(`session-kwh-${session.id}`);
      const elCost = document.getElementById(`session-cost-${session.id}`);
      const elTime = document.getElementById(`session-time-${session.id}`);

      if(elBar) elBar.style.width = `${pct}%`;
      if(elPct) elPct.textContent = `${pct}%`;
      if(elKwh) elKwh.textContent = `${currentKwh.toFixed(1)} kWh`;
      if(elCost) elCost.textContent = `₺${updated.cost.toFixed(2)}`;
      if(elTime) elTime.innerHTML = `<i class="ph ph-timer"></i> ~${minsRemaining}s remaining (demo)`;

    } catch (e) {
      console.error('Simulation update failed', e);
    }
  }, 1000);
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
    
    showReceipt(res.session);
    
  } catch (err) {
    window.showToast(err.message, 'error');
    if(btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ph ph-stop-circle"></i> Stop';
    }
  }
};

function showReceipt(session) {
  const html = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="font-size: 28px; margin-bottom: 8px; color: var(--text-2);"><i class="ph ph-receipt"></i></div>
      <h2 style="font-size: 18px;">Digital Receipt</h2>
      <p class="text-muted" style="font-size: 12px;">${new Date().toLocaleString()}</p>
    </div>

    <div style="background: var(--bg-0); padding: 16px; border-radius: var(--radius); font-size: 13px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span class="text-muted">Station</span>
        <span style="text-align:right;">${session.station_name}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span class="text-muted">Charger</span>
        <span>${session.charger_label}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span class="text-muted">Vehicle</span>
        <span>${session.vehicle_brand} ${session.vehicle_model}</span>
      </div>
      <hr style="border: none; border-top: 1px solid var(--border); margin: 12px 0;" />
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span class="text-muted">Energy</span>
        <span>${session.consumed_kwh.toFixed(2)} kWh</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span class="text-muted">Unit Price</span>
        <span>₺${session.price_per_kwh.toFixed(2)}/kWh</span>
      </div>
      <hr style="border: none; border-top: 1px solid var(--border); margin: 12px 0;" />
      <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 15px; color: var(--blue);">
        <span>Total</span>
        <span>₺${session.cost.toFixed(2)}</span>
      </div>
    </div>
    
    <button class="btn btn-primary" style="width: 100%; margin-top: 16px;" onclick="window.closeModal(); window.location.hash = '#/history';">Done</button>
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
