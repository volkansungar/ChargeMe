import { api } from '../services/api.js';

export async function renderVehicles(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Vehicles</h2>
    </div>

    <div style="display: flex; gap: 40px; align-items: start;">
      <!-- Left: Registration Form (Wider & Shorter) -->
      <div class="card" style="width: 440px; position: sticky; top: 80px; padding: 20px;">
        <h3 style="font-size: 16px; margin-bottom: 20px;">Add New Vehicle</h3>
        <form id="vehicle-form" style="display: flex; flex-direction: column; gap: 16px;">
          
          <!-- Row 1: Brand & Model -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Brand</label>
              <input type="text" id="v-brand" class="form-input" required placeholder="Tesla">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Model</label>
              <input type="text" id="v-model" class="form-input" required placeholder="Model 3">
            </div>
          </div>

          <!-- Row 2: Battery & Connector -->
          <div style="display: grid; grid-template-columns: 100px 1fr; gap: 12px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">kWh</label>
              <input type="number" id="v-battery" class="form-input" required placeholder="75">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Connector Type</label>
              <select id="v-connector" class="form-select" required>
                <option value="Type 2">Type 2 (AC)</option>
                <option value="CCS">CCS (DC Fast)</option>
                <option value="CHAdeMO">CHAdeMO (DC Fast)</option>
              </select>
            </div>
          </div>

          <!-- Row 3: Plate & Button -->
          <div style="display: grid; grid-template-columns: 1fr 140px; gap: 12px; align-items: flex-end;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">License Plate</label>
              <input type="text" id="v-plate" class="form-input" required placeholder="35 EV 2024">
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%;">Add</button>
          </div>
          
        </form>
      </div>
      
      <!-- Right: Vehicle List (Stay Narrow) -->
      <div style="flex: 1; max-width: 440px;" id="vehicles-list">
        <div class="spinner"></div>
      </div>
    </div>
  `;

  document.getElementById('vehicle-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Registering...';

    try {
      const data = {
        brand: document.getElementById('v-brand').value,
        model: document.getElementById('v-model').value,
        battery_capacity: parseFloat(document.getElementById('v-battery').value),
        connector_type: document.getElementById('v-connector').value,
        plate_number: document.getElementById('v-plate').value,
      };

      await api.createVehicle(data);
      window.showToast('Vehicle added successfully!');
      e.target.reset();
      await refreshVehiclesList();
    } catch (err) {
      window.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  await refreshVehiclesList();
}

async function refreshVehiclesList() {
  const container = document.getElementById('vehicles-list');
  try {
    const vehicles = await api.getVehicles();
    window.appState.vehicles = vehicles;
    
    if (vehicles.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; color: var(--text-2); padding: 48px 24px;">
          <i class="ph ph-car" style="font-size: 32px; margin-bottom: 12px; opacity: 0.3;"></i>
          <p>Your fleet is empty.</p>
        </div>`;
      return;
    }

    container.innerHTML = vehicles.map(v => `
      <div class="card vehicle-accordion-item" id="vehicle-card-${v.id}" style="padding: 0; overflow: hidden; transition: all 0.4s var(--spring-easing);">
        <!-- Summary Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; cursor: pointer;" onclick="toggleVehicleExpand(${v.id})">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="width: 40px; height: 40px; background: var(--bg-2); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--blue);">
              <i class="ph-fill ph-car"></i>
            </div>
            <h3 style="font-size: 15px;">${v.brand} ${v.model}</h3>
          </div>
          <i class="ph ph-caret-down accordion-caret" style="transition: transform 0.3s;"></i>
        </div>

        <!-- Expandable Details -->
        <div class="accordion-content" style="max-height: 0; overflow: hidden; transition: max-height 0.4s var(--spring-easing);">
          <div style="padding: 0 20px 20px 20px; border-top: 0.5px solid var(--border); padding-top: 16px;">
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between;">
                <span class="text-1">License Plate</span>
                <span style="font-family: monospace; font-weight: 600;">${v.plate_number}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span class="text-1">Battery</span>
                <span>${v.battery_capacity} kWh</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span class="text-1">Connector</span>
                <span class="text-green" style="font-weight: 600;">${v.connector_type}</span>
              </div>
            </div>
            <button class="btn btn-danger" style="width: 100%; padding: 8px; font-size: 13px;" onclick="deleteVehicle(${v.id})">
              <i class="ph ph-trash"></i> Remove Vehicle
            </button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="text-red">Failed to load vehicles</div>`;
  }
}

window.toggleVehicleExpand = (id) => {
  const card = document.getElementById(`vehicle-card-${id}`);
  const content = card.querySelector('.accordion-content');
  const caret = card.querySelector('.accordion-caret');
  
  const isOpen = content.style.maxHeight !== '0px' && content.style.maxHeight !== '';
  
  // Close all others first (optional, but cleaner)
  document.querySelectorAll('.accordion-content').forEach(el => el.style.maxHeight = '0px');
  document.querySelectorAll('.accordion-caret').forEach(el => el.style.transform = 'rotate(0deg)');

  if (!isOpen) {
    content.style.maxHeight = content.scrollHeight + 'px';
    caret.style.transform = 'rotate(180deg)';
  }
};

window.deleteVehicle = async (id) => {
  if(!confirm('Delete this vehicle?')) return;
  try {
    await api.deleteVehicle(id);
    window.showToast('Vehicle removed');
    refreshVehiclesList();
  } catch (err) {
    window.showToast(err.message, 'error');
  }
};

window.deleteVehicle = async (id) => {
  if(!confirm('Are you sure you want to delete this vehicle?')) return;
  try {
    await api.deleteVehicle(id);
    window.showToast('Vehicle deleted');
    window.closeModal();
    refreshVehiclesList();
  } catch (err) {
    window.showToast(err.message, 'error');
  }
};
