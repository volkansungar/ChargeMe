import { api } from '../../services/api.js';

export async function renderManageStations(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Fleet Management</h2>
    </div>
    <div id="admin-stations-list" style="display: flex; flex-direction: column; gap: 16px;">
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
      <div class="card-flush">
        <div class="card-header" style="background: var(--bg-2);">
          <div>
            <h3 style="font-size: 14px; margin-bottom: 2px;">${station.name}</h3>
            <div class="text-muted" style="font-size: 12px; display: flex; align-items: center; gap: 4px;"><i class="ph ph-map-pin"></i> ${station.address}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="text-muted" style="font-size: 12px;">${station.operating_hours}</span>
            <button class="btn btn-ghost" style="padding: 3px 8px; font-size: 12px;" onclick="editStationHours(${station.id}, '${station.operating_hours}')">Edit</button>
          </div>
        </div>
        
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Type / Power</th>
                <th>Connector</th>
                <th>Price</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${station.chargers.map(c => {
                const isOutOfService = c.status === 'out_of_service';
                return `
                  <tr style="opacity: ${isOutOfService ? '0.5' : '1'}">
                    <td style="font-weight: 600;">${c.charger_label}</td>
                    <td>
                      <span>${c.type} ${c.power_kw}kW</span>
                      <button class="btn btn-ghost" style="padding: 1px 5px; font-size: 11px; margin-left: 4px;" onclick="editChargerHardware(${station.id}, ${c.id}, ${c.power_kw}, '${c.connector_type}', ${c.price_per_kwh})"><i class="ph ph-pencil-simple"></i></button>
                    </td>
                    <td>${c.connector_type}</td>
                    <td>₺${c.price_per_kwh.toFixed(2)}</td>
                    <td>
                      <span class="badge badge-${c.status === 'available' ? 'available' : c.status === 'occupied' ? 'occupied' : 'offline'}">${c.status}</span>
                    </td>
                    <td style="text-align: right;">
                      ${isOutOfService 
                        ? `<button class="btn btn-success" style="padding: 3px 8px; font-size: 12px;" onclick="toggleChargerStatus(${station.id}, ${c.id}, 'available')">Bring Online</button>`
                        : `<button class="btn btn-danger" style="padding: 3px 8px; font-size: 12px;" onclick="toggleChargerStatus(${station.id}, ${c.id}, 'out_of_service')">Maintenance</button>`
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
    window.showToast('Charger updated');
    loadStations();
  } catch (err) {
    window.showToast(err.message, 'error');
  }
};

window.toggleChargerStatus = async (stationId, chargerId, newStatus) => {
  let msg = newStatus === 'out_of_service' 
    ? 'Take this charger out of service? Active reservations will be cancelled.' 
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
