import { api } from '../services/api.js';

window.openReservationModal = async (stationId, chargerId) => {
  if (!window.appState.vehicles || window.appState.vehicles.length === 0) {
    window.closeModal();
    window.showToast('Please register a vehicle first', 'error');
    window.location.hash = '#/vehicles';
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const end = new Date(now.getTime() + 60 * 60 * 1000);
  const endStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;

  const html = `
    <h2 style="font-size: 18px; margin-bottom: 16px;">New Reservation</h2>
    
    <form id="reservation-form">
      <input type="hidden" id="r-charger" value="${chargerId}">
      
      <div class="form-group">
        <label class="form-label">Vehicle</label>
        <select id="r-vehicle" class="form-select" required>
          ${window.appState.vehicles.map(v => `<option value="${v.id}">${v.brand} ${v.model} (${v.connector_type})</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Date</label>
        <input type="date" id="r-date" class="form-input" min="${today}" value="${today}" required>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label">Start</label>
          <input type="time" id="r-start" class="form-input" value="${timeStr}" required>
        </div>
        <div class="form-group">
          <label class="form-label">End (max 2h)</label>
          <input type="time" id="r-end" class="form-input" value="${endStr}" required>
        </div>
      </div>
      
      <div style="margin-top: 16px;">
        <div class="text-amber" style="font-size: 12px; margin-bottom: 8px; text-align: center;">
          <i class="ph ph-info"></i> A refundable ₺20 holding fee will be charged.
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">Confirm (₺20)</button>
      </div>
    </form>
  `;

  window.openModal(html);

  document.getElementById('reservation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
      const data = {
        charger_id: document.getElementById('r-charger').value,
        vehicle_id: document.getElementById('r-vehicle').value,
        reservation_date: document.getElementById('r-date').value,
        start_time: document.getElementById('r-start').value,
        end_time: document.getElementById('r-end').value
      };

      await api.createReservation(data);
      window.showToast('Reservation confirmed!');
      window.closeModal();
      window.location.hash = '#/reservations';
    } catch (err) {
      window.showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Confirm (₺20)';
    }
  });
};

export async function renderReservations(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>My Reservations</h2>
      <a href="#/map" class="btn btn-primary"><i class="ph ph-plus"></i> Book New</a>
    </div>
    <div id="reservations-list" class="grid-cards">
      <div style="grid-column: 1/-1; text-align: center; padding: 24px;"><div class="spinner" style="margin: 0 auto;"></div></div>
    </div>
  `;

  await refreshReservationsList();
}

async function refreshReservationsList() {
  const container = document.getElementById('reservations-list');
  try {
    const reservations = await api.getReservations();
    
    if (reservations.length === 0) {
      container.innerHTML = '<div class="card" style="grid-column: 1/-1; text-align: center; color: var(--text-2); padding: 32px;">No active reservations.</div>';
      return;
    }

    container.innerHTML = reservations.map(r => {
      const isPast = new Date(`${r.reservation_date}T${r.end_time}`) < new Date();
      const isCancelled = r.status === 'cancelled';
      
      let actions = '';
      if (r.status === 'confirmed' && !isPast) {
        actions = `
          <div style="margin-top: 12px; display: flex; gap: 6px;">
            <button class="btn btn-success" style="flex: 1; padding: 6px;" onclick="startSessionFromReservation(${r.id}, ${r.vehicle_id}, ${r.charger_id})"><i class="ph ph-plug-charging"></i> Start</button>
            <button class="btn btn-ghost text-red" style="padding: 6px 10px;" onclick="cancelReservation(${r.id})">Cancel</button>
          </div>
        `;
      }

      return `
        <div class="card" style="opacity: ${isPast || isCancelled ? 0.5 : 1}">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span class="badge badge-${r.status === 'confirmed' ? 'available' : r.status === 'active' ? 'occupied' : 'offline'}">
              ${r.status}
            </span>
            <span class="text-muted" style="font-size: 11px;">#${r.id}</span>
          </div>
          
          <h3 style="font-size: 14px; margin-bottom: 2px;">${r.station_name}</h3>
          <p class="text-muted" style="font-size: 12px; margin-bottom: 12px;">${r.charger_label} · ${r.charger_type} ${r.power_kw}kW</p>
          
          <div style="background: var(--bg-0); padding: 8px 10px; border-radius: var(--radius); margin-bottom: 8px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span class="text-muted">Date</span>
              <span style="font-weight: 500;">${r.reservation_date}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span class="text-muted">Time</span>
              <span style="font-weight: 600; color: var(--green);">${r.start_time} – ${r.end_time}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
            <span class="text-muted">Vehicle</span>
            <span>${r.vehicle_brand} ${r.vehicle_model}</span>
          </div>
          
          ${actions}
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="text-red">Failed to load reservations</div>`;
  }
}

window.cancelReservation = async (id) => {
  if (!confirm('Cancel this reservation? Your ₺20 fee will be refunded.')) return;
  try {
    const res = await api.cancelReservation(id);
    window.showToast(res.message);
    refreshReservationsList();
    if (window.updateWalletDisplay) window.updateWalletDisplay();
  } catch (err) {
    window.showToast(err.message, 'error');
  }
};

window.startSessionFromReservation = async (resId, vId, cId) => {
  try {
    const session = await api.startSession({
      reservation_id: resId,
      vehicle_id: vId,
      charger_id: cId
    });
    window.showToast('Charging session started!');
    window.location.hash = '#/session';
  } catch (err) {
    window.showToast(err.message, 'error');
    if (err.message.includes('wallet')) {
      window.location.hash = '#/session';
    }
  }
};
