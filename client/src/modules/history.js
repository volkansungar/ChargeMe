import { api } from '../services/api.js';

export async function renderHistory(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Charging History</h2>
    </div>

    <div class="grid-stats" id="history-stats" style="margin-bottom: 24px;"></div>
    
    <div class="card-flush">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Station</th>
              <th>Vehicle</th>
              <th>Energy</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody id="history-list">
            <tr><td colspan="5" style="text-align: center; padding: 32px;"><div class="spinner" style="margin: 0 auto;"></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const allSessions = await api.getSessions();
    const completed = allSessions.filter(s => s.status === 'completed');

    const totalSessions = completed.length;
    const totalKwh = completed.reduce((acc, s) => acc + s.consumed_kwh, 0);
    const totalSpent = completed.reduce((acc, s) => acc + s.cost, 0);

    document.getElementById('history-stats').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total Sessions</div>
        <div class="stat-value">${totalSessions}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Energy Used</div>
        <div class="stat-value text-green">${totalKwh.toFixed(1)}<span style="font-size:14px;font-weight:400;color:var(--text-2);"> kWh</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Spent</div>
        <div class="stat-value text-blue">₺${totalSpent.toFixed(2)}</div>
      </div>
    `;

    const tbody = document.getElementById('history-list');
    if (completed.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;" class="text-muted">No completed sessions yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = completed.map(s => {
      const date = new Date(s.ended_at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `
        <tr>
          <td style="white-space:nowrap;">${date}</td>
          <td>
            <div style="font-weight: 500;">${s.station_name}</div>
            <div class="text-muted" style="font-size: 12px;">${s.charger_label}</div>
          </td>
          <td>
            <div>${s.vehicle_brand}</div>
            <div class="text-muted" style="font-size: 12px;">${s.plate_number}</div>
          </td>
          <td style="font-weight: 600;">${s.consumed_kwh.toFixed(2)} <span class="text-muted" style="font-weight:400;">kWh</span></td>
          <td style="font-weight: 600;" class="text-blue">₺${s.cost.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    document.getElementById('history-list').innerHTML = `<tr><td colspan="5" class="text-red" style="text-align:center;padding:32px;">Failed to load history</td></tr>`;
  }
}
