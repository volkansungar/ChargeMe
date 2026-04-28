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
  
  // Default end time (1 hour later)
  const end = new Date(now.getTime() + 60 * 60 * 1000);
  const endStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;

  const html = `
    <div class="modal-header">
      <h2 class="text-gradient">Create Reservation</h2>
    </div>
    
    <form id="reservation-form">
      <input type="hidden" id="r-charger" value="${chargerId}">
      
      <div class="form-group">
        <label class="form-label">Select Vehicle</label>
        <select id="r-vehicle" class="form-select" required>
          ${window.appState.vehicles.map(v => `<option value="${v.id}">${v.brand} ${v.model} (${v.connector_type})</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Date</label>
        <input type="date" id="r-date" class="form-input" min="${today}" value="${today}" required>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4);">
        <div class="form-group">
          <label class="form-label">Start Time</label>
          <input type="time" id="r-start" class="form-input" value="${timeStr}" required>
        </div>
        <div class="form-group">
          <label class="form-label">End Time (Max 2h)</label>
          <input type="time" id="r-end" class="form-input" value="${endStr}" required>
        </div>
      </div>
      
      <div style="margin-top: var(--spacing-6);">
        <div class="text-amber" style="font-size: 0.85rem; margin-bottom: 0.5rem; text-align: center;">
          ⚠️ A fully-refundable holding fee of ₺20.00 will be deducted from your wallet to secure this booking.
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">Confirm Reservation (Pay ₺20)</button>
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
      btn.textContent = 'Confirm Reservation';
    }
  });
};

export async function renderReservations(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-6);">
      <h2 class="text-gradient">My Reservations</h2>
      <a href="#/map" class="btn btn-primary">Book New Slot</a>
    </div>
    <div id="reservations-list" class="grid-cards">
      <div style="grid-column: 1/-1; text-align: center;"><div class="spinner"></div></div>
    </div>
  `;

  await refreshReservationsList();
}

async function refreshReservationsList() {
  const container = document.getElementById('reservations-list');
  try {
    const reservations = await api.getReservations();
    
    if (reservations.length === 0) {
      container.innerHTML = '<div class="glass-card" style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No active reservations.</div>';
      return;
    }

    container.innerHTML = reservations.map(r => {
      const isPast = new Date(`${r.reservation_date}T${r.end_time}`) < new Date();
      const isActive = r.status === 'active';
      const isCancelled = r.status === 'cancelled';
      
      let actions = '';
      if (r.status === 'confirmed' && !isPast) {
        actions = `
          <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
            <button class="btn btn-success" style="flex: 1; padding: 0.5rem;" onclick="startSessionFromReservation(${r.id}, ${r.vehicle_id}, ${r.charger_id})">🔌 Start Charging</button>
            <button class="btn btn-outline text-red" style="padding: 0.5rem;" onclick="cancelReservation(${r.id})">Cancel</button>
          </div>
        `;
      }

      return `
        <div class="glass-card" style="opacity: ${isPast || isCancelled ? 0.6 : 1}">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <div class="badge badge-${r.status === 'confirmed' ? 'available' : r.status === 'active' ? 'occupied' : 'offline'}">
              ${r.status.toUpperCase()}
            </div>
            <div class="text-muted" style="font-size: 0.8rem;">#RES-${r.id}</div>
          </div>
          
          <h3 style="margin-bottom: 0.2rem;">${r.station_name}</h3>
          <p class="text-secondary" style="font-size: 0.9rem; margin-bottom: 1rem;">${r.charger_label} (${r.charger_type} ${r.power_kw}kW)</p>
          
          <div style="background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
              <span class="text-muted" style="font-size: 0.85rem;">Date</span>
              <span style="font-weight: 500;">${r.reservation_date}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span class="text-muted" style="font-size: 0.85rem;">Time</span>
              <span class="text-emerald" style="font-weight: 600;">${r.start_time} - ${r.end_time}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
            <span class="text-muted">Vehicle:</span>
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
  if (!confirm('Are you sure you want to cancel this reservation? Your ₺20 holding fee will be refunded.')) return;
  try {
    const res = await api.cancelReservation(id);
    window.showToast(res.message);
    refreshReservationsList();
    // Update global wallet display
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
      window.location.hash = '#/session'; // go to session to see wallet
    }
  }
};
