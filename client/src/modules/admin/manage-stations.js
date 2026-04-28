import { api } from '../../services/api.js';

export async function renderManageStations(container) {
  container.innerHTML = `
    <h2 class="text-gradient" style="margin-bottom: var(--spacing-6);">Fleet Management</h2>
    <div id="admin-stations-list" style="display: flex; flex-direction: column; gap: var(--spacing-6);">
      <div class="spinner"></div>
    </div>
  `;

  await loadStations();
}

async function loadStations() {
  const container = document.getElementById('admin-stations-list');
  try {
    const stations = await api.getStations();
    
    container.innerHTML = stations.map(station => `
      <div class="glass-card" style="padding: 0;">
        <div style="padding: var(--spacing-4); border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); border-radius: var(--radius-xl) var(--radius-xl) 0 0;">
          <div>
            <h3 style="margin: 0;">${station.name}</h3>
            <div class="text-muted" style="font-size: 0.85rem; display: flex; align-items: center; gap: 4px;"><i class="ph ph-map-pin"></i> ${station.address}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.85rem; margin-bottom: 4px;">Operating Hours: <span style="font-weight:bold;">${station.operating_hours}</span></div>
            <button class="btn btn-outline" style="padding: 2px 8px; font-size: 0.75rem;" onclick="editStationHours(${station.id}, '${station.operating_hours}')">Edit Hours</button>
          </div>
        </div>
        
        <div style="padding: var(--spacing-4);">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--glass-border);">
                <th style="padding: var(--spacing-2); color: var(--text-muted); font-weight: 500;">Label</th>
                <th style="padding: var(--spacing-2); color: var(--text-muted); font-weight: 500;">Type / Power</th>
                <th style="padding: var(--spacing-2); color: var(--text-muted); font-weight: 500;">Connector</th>
                <th style="padding: var(--spacing-2); color: var(--text-muted); font-weight: 500;">Price (₺/kWh)</th>
                <th style="padding: var(--spacing-2); color: var(--text-muted); font-weight: 500;">Status</th>
                <th style="padding: var(--spacing-2); color: var(--text-muted); font-weight: 500; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${station.chargers.map(c => {
                const isOutOfService = c.status === 'out_of_service';
                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); opacity: ${isOutOfService ? '0.6' : '1'}">
                    <td style="padding: var(--spacing-2); font-weight: 600;">${c.charger_label}</td>
                    <td style="padding: var(--spacing-2);">
                      <div style="display:flex; align-items: center; gap: 0.5rem;">
                        <span>${c.type} ${c.power_kw}kW</span>
                        <button class="btn btn-outline" style="padding: 2px 6px; font-size: 0.7rem;" onclick="editChargerHardware(${station.id}, ${c.id}, ${c.power_kw}, '${c.connector_type}', ${c.price_per_kwh})"><i class="ph ph-pencil-simple"></i></button>
                      </div>
                    </td>
                    <td style="padding: var(--spacing-2);">${c.connector_type}</td>
                    <td style="padding: var(--spacing-2);">₺${c.price_per_kwh.toFixed(2)}</td>
                    <td style="padding: var(--spacing-2);">
                      <span class="badge badge-${c.status === 'available' ? 'available' : c.status === 'occupied' ? 'occupied' : 'offline'}">${c.status}</span>
                    </td>
                    <td style="padding: var(--spacing-2); text-align: right;">
                      ${isOutOfService 
                        ? `<button class="btn btn-success" style="padding: 4px 8px; font-size: 0.75rem;" onclick="toggleChargerStatus(${station.id}, ${c.id}, 'available')">Bring Online</button>`
                        : `<button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="toggleChargerStatus(${station.id}, ${c.id}, 'out_of_service')">Set Maintenance</button>`
                      }
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="text-red">Failed to load stations: ${err.message}</div>`;
  }
}

// Global Handlers
window.editStationHours = async (id, current) => {
  const newHours = prompt('Enter new operating hours (e.g. 06:00-23:00 or 00:00-23:59):', current);
  if (!newHours || newHours === current) return;
  
  try {
    await api.updateStationHours(id, newHours);
    window.showToast('Station hours updated');
    loadStations();
  } catch (err) {
    window.showToast(err.message, 'error');
  }
};

window.editChargerHardware = async (stationId, chargerId, currentPower, currentConnector, currentPrice) => {
  const newPriceStr = prompt(`Enter new price per kWh (current: ₺${currentPrice}):`, currentPrice);
  if (!newPriceStr) return;
  
  const newPrice = parseFloat(newPriceStr);
  if (isNaN(newPrice) || newPrice <= 0) {
    return window.showToast('Invalid price', 'error');
  }

  const newPowerStr = prompt(`Enter new power output in kW (current: ${currentPower}):`, currentPower);
  const newPower = parseInt(newPowerStr) || currentPower;

  const newConnector = prompt(`Enter connector type (current: ${currentConnector}):`, currentConnector) || currentConnector;

  try {
    await api.updateChargerHardware(stationId, chargerId, { price_per_kwh: newPrice, power_kw: newPower, connector_type: newConnector });
    window.showToast('Charger hardware updated');
    loadStations();
  } catch (err) {
    window.showToast(err.message, 'error');
  }
};

window.toggleChargerStatus = async (stationId, chargerId, newStatus) => {
  let msg = newStatus === 'out_of_service' 
    ? 'Are you sure you want to take this charger out of service? ALL active reservations for this charger will be automatically cancelled!' 
    : 'Bring this charger back online?';
    
  if (!confirm(msg)) return;

  try {
    const res = await api.updateChargerStatus(stationId, chargerId, newStatus);
    window.showToast(res.message);
    loadStations();
  } catch (err) {
    window.showToast(err.message, 'error');
  }
};
