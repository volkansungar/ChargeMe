import { api } from '../../services/api.js';

export async function renderAdminDashboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>System Analytics</h2>
      <button class="btn btn-ghost" onclick="location.reload()"><i class="ph ph-arrow-clockwise"></i> Refresh</button>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 260px; gap: 16px; margin-bottom: 24px;">
      <div class="grid-stats" id="admin-stats-grid">
        <div class="stat-card"><div class="spinner"></div></div>
      </div>
      <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div class="stat-label" style="margin-bottom: 8px;">Session Breakdown</div>
        <div style="width: 100%; max-width: 160px;">
          <canvas id="sessionChart"></canvas>
        </div>
      </div>
    </div>

    <div class="card-flush">
      <div class="card-header">
        <h3 style="font-size: 14px; font-weight: 600;">Station Utilization</h3>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Station</th>
              <th>Sessions</th>
              <th>Energy</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody id="admin-utilization-list">
            <tr><td colspan="4" style="text-align: center; padding: 32px;"><div class="spinner" style="margin: 0 auto;"></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  await loadDashboardData();
}

async function loadDashboardData() {
  try {
    const [stats, utilization] = await Promise.all([
      api.getAdminStats(),
      api.getAdminUtilization()
    ]);

    document.getElementById('admin-stats-grid').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Revenue</div>
        <div class="stat-value text-blue">₺${stats.totalRevenue.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Energy</div>
        <div class="stat-value text-green">${stats.totalEnergy.toFixed(1)}<span style="font-size:14px;font-weight:400;color:var(--text-2);"> kWh</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Sessions</div>
        <div class="stat-value">${stats.activeSessions} <span style="font-size:14px;font-weight:400;color:var(--text-2);">/ ${stats.completedSessions}</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Vehicles</div>
        <div class="stat-value">${stats.totalVehicles}</div>
      </div>
    `;

    const tbody = document.getElementById('admin-utilization-list');
    if (utilization.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;" class="text-muted">No data yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = utilization.map(u => `
      <tr>
        <td style="font-weight: 500;">${u.name}</td>
        <td>${u.session_count}</td>
        <td>${u.total_kwh.toFixed(1)} <span class="text-muted">kWh</span></td>
        <td class="text-blue" style="font-weight:600;">₺${u.total_revenue.toFixed(2)}</td>
      </tr>
    `).join('');

    if (window.Chart) {
      const ctx = document.getElementById('sessionChart').getContext('2d');
      new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Active', 'Completed'],
          datasets: [{
            data: [stats.activeSessions, stats.completedSessions],
            backgroundColor: ['#FFD60A', '#32D74B'],
            borderWidth: 0
          }]
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: true, 
          cutout: '70%',
          plugins: { 
            legend: { position: 'bottom', labels: { color: '#64748B', font: { family: 'Inter', size: 11 } } } 
          } 
        }
      });
    }

  } catch (err) {
    document.getElementById('admin-stats-grid').innerHTML = `<div class="text-red">Failed to load analytics: ${err.message}</div>`;
    document.getElementById('admin-utilization-list').innerHTML = `<tr><td colspan="4" class="text-red" style="text-align:center;padding:32px;">Failed to load data</td></tr>`;
  }
}
