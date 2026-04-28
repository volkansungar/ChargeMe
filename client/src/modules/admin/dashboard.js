import { api } from '../../services/api.js';

export async function renderAdminDashboard(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-6);">
      <h2 class="text-gradient">System Analytics</h2>
      <button class="btn btn-outline" onclick="location.reload()">Refresh Data</button>
    </div>
    
    <div id="admin-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-4); margin-bottom: var(--spacing-8);">
      <div class="spinner"></div>
    </div>

    <h3 style="margin-bottom: var(--spacing-4);">Station Utilization</h3>
    <div class="glass-card">
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--glass-border);">
              <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500;">Station Name</th>
              <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500;">Sessions</th>
              <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500;">Energy Dispensed</th>
              <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500;">Revenue Generated</th>
            </tr>
          </thead>
          <tbody id="admin-utilization-list">
            <tr><td colspan="4" style="text-align: center; padding: 2rem;"><div class="spinner" style="margin: 0 auto;"></div></td></tr>
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

    // Update Top Stats
    document.getElementById('admin-stats-grid').innerHTML = `
      <div class="glass-card" style="text-align: center; padding: var(--spacing-4);">
        <div class="text-muted" style="margin-bottom: 0.5rem; font-size: 0.9rem;">Total Revenue</div>
        <div style="font-size: 1.75rem; font-weight: 700; color: var(--accent-cyan);">₺${stats.totalRevenue.toFixed(2)}</div>
      </div>
      <div class="glass-card" style="text-align: center; padding: var(--spacing-4);">
        <div class="text-muted" style="margin-bottom: 0.5rem; font-size: 0.9rem;">Energy Dispensed</div>
        <div style="font-size: 1.75rem; font-weight: 700; color: var(--accent-emerald);">${stats.totalEnergy.toFixed(1)} kWh</div>
      </div>
      <div class="glass-card" style="text-align: center; padding: var(--spacing-4);">
        <div class="text-muted" style="margin-bottom: 0.5rem; font-size: 0.9rem;">Active / Completed</div>
        <div style="font-size: 1.75rem; font-weight: 700; color: var(--accent-amber);">${stats.activeSessions} / ${stats.completedSessions}</div>
      </div>
      <div class="glass-card" style="text-align: center; padding: var(--spacing-4);">
        <div class="text-muted" style="margin-bottom: 0.5rem; font-size: 0.9rem;">Registered Vehicles</div>
        <div style="font-size: 1.75rem; font-weight: 700;">${stats.totalVehicles}</div>
      </div>
    `;

    // Update Utilization Table
    const tbody = document.getElementById('admin-utilization-list');
    if (utilization.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">No utilization data available.</td></tr>`;
      return;
    }

    tbody.innerHTML = utilization.map(u => `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding: var(--spacing-3); font-weight: 500;">${u.name}</td>
        <td style="padding: var(--spacing-3);">${u.session_count}</td>
        <td style="padding: var(--spacing-3); font-weight: 600;">${u.total_kwh.toFixed(1)} <span class="text-muted" style="font-size:0.8em;font-weight:normal;">kWh</span></td>
        <td style="padding: var(--spacing-3); font-weight: 600; color: var(--accent-cyan);">₺${u.total_revenue.toFixed(2)}</td>
      </tr>
    `).join('');

  } catch (err) {
    document.getElementById('admin-stats-grid').innerHTML = `<div class="text-red">Failed to load analytics: ${err.message}</div>`;
    document.getElementById('admin-utilization-list').innerHTML = `<tr><td colspan="4" class="text-red" style="text-align: center; padding: 2rem;">Failed to load data</td></tr>`;
  }
}
