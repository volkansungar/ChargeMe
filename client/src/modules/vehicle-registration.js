import { api } from '../services/api.js';

export async function renderVehicles(container) {
  container.innerHTML = `
    <div class="glass-card" style="margin-bottom: var(--spacing-8);">
      <h2 class="text-gradient" style="margin-bottom: var(--spacing-4);">Register New Vehicle</h2>
      <form id="vehicle-form" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4);">
        <div class="form-group">
          <label class="form-label">Brand</label>
          <input type="text" id="v-brand" class="form-input" required placeholder="e.g. Tesla">
        </div>
        <div class="form-group">
          <label class="form-label">Model</label>
          <input type="text" id="v-model" class="form-input" required placeholder="e.g. Model 3">
        </div>
        <div class="form-group">
          <label class="form-label">Battery Capacity (kWh)</label>
          <input type="number" id="v-battery" class="form-input" required min="1" max="300" placeholder="e.g. 75">
        </div>
        <div class="form-group">
          <label class="form-label">Connector Type</label>
          <select id="v-connector" class="form-select" required>
            <option value="Type 2">Type 2 (AC)</option>
            <option value="CCS">CCS (DC Fast)</option>
            <option value="CHAdeMO">CHAdeMO (DC Fast)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">License Plate</label>
          <input type="text" id="v-plate" class="form-input" required placeholder="e.g. 35 EV 2024">
        </div>
        <div class="form-group" style="display: flex; align-items: flex-end;">
          <button type="submit" class="btn btn-primary" style="width: 100%;">Add Vehicle</button>
        </div>
      </form>
    </div>
    
    <h3 style="margin-bottom: var(--spacing-4);">My Registered Vehicles</h3>
    <div id="vehicles-list" class="grid-cards">
      <!-- Vehicles injected here -->
    </div>
  `;

  document.getElementById('vehicle-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const data = {
        brand: document.getElementById('v-brand').value,
        model: document.getElementById('v-model').value,
        battery_capacity: parseFloat(document.getElementById('v-battery').value),
        connector_type: document.getElementById('v-connector').value,
        plate_number: document.getElementById('v-plate').value,
      };

      await api.createVehicle(data);
      window.showToast('Vehicle registered successfully!');
      e.target.reset();
      await refreshVehiclesList();
    } catch (err) {
      window.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add Vehicle';
    }
  });

  await refreshVehiclesList();
}

async function refreshVehiclesList() {
  const container = document.getElementById('vehicles-list');
  try {
    const vehicles = await api.getVehicles();
    window.appState.vehicles = vehicles; // Update global state
    
    if (vehicles.length === 0) {
      container.innerHTML = '<div class="glass-card" style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No vehicles registered yet.</div>';
      return;
    }

    container.innerHTML = vehicles.map(v => `
      <div class="glass-card" style="position: relative;">
        <button class="btn btn-danger" style="position: absolute; top: 1rem; right: 1rem; padding: 0.25rem 0.5rem;" onclick="deleteVehicle(${v.id})"><i class="ph ph-trash"></i></button>
        <h3 style="margin-bottom: 0.5rem;">${v.brand} ${v.model}</h3>
        <p class="text-secondary" style="font-family: monospace; font-size: 1.1em; margin-bottom: 1rem;">[${v.plate_number}]</p>
        
        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9em;">
          <div style="display: flex; justify-content: space-between;">
            <span class="text-muted">Battery:</span>
            <span>${v.battery_capacity} kWh</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span class="text-muted">Connector:</span>
            <span class="text-emerald">${v.connector_type}</span>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="text-red">Failed to load vehicles: ${err.message}</div>`;
  }
}

// Global scope for onclick handler
window.deleteVehicle = async (id) => {
  if(!confirm('Are you sure you want to delete this vehicle?')) return;
  try {
    await api.deleteVehicle(id);
    window.showToast('Vehicle deleted');
    refreshVehiclesList();
  } catch (err) {
    window.showToast(err.message, 'error');
  }
};
