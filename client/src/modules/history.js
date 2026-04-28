import { api } from '../services/api.js';

export async function renderHistory(container) {
  container.innerHTML = `
    <h2 class="text-gradient" style="margin-bottom: var(--spacing-6);">Charging History</h2>
    <div id="history-stats" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-4); margin-bottom: var(--spacing-6);">
      <!-- Stats injected here -->
    </div>
    
    <div class="glass-card">
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--glass-border);">
              <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500;">Date</th>
              <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500;">Station</th>
              <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500;">Vehicle</th>
              <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500;">Energy</th>
              <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500;">Cost</th>
            </tr>
          </thead>
          <tbody id="history-list">
            <tr><td colspan="5" style="text-align: center; padding: 2rem;"><div class="spinner" style="margin: 0 auto;"></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const allSessions = await api.getSessions();
    const completed = allSessions.filter(s => s.status === 'completed');

    // Calculate stats
    const totalSessions = completed.length;
    const totalKwh = completed.reduce((acc, s) => acc + s.consumed_kwh, 0);
    const totalSpent = completed.reduce((acc, s) => acc + s.cost, 0);

    document.getElementById('history-stats').innerHTML = `
      <div class="glass-card" style="text-align: center; padding: var(--spacing-4);">
        <div class="text-muted" style="margin-bottom: 0.5rem; font-size: 0.9rem;">Total Sessions</div>
        <div style="font-size: 1.5rem; font-weight: 700;">${totalSessions}</div>
      </div>
      <div class="glass-card" style="text-align: center; padding: var(--spacing-4);">
        <div class="text-muted" style="margin-bottom: 0.5rem; font-size: 0.9rem;">Total Energy</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-emerald);">${totalKwh.toFixed(1)} <span style="font-size: 1rem;">kWh</span></div>
      </div>
      <div class="glass-card" style="text-align: center; padding: var(--spacing-4);">
        <div class="text-muted" style="margin-bottom: 0.5rem; font-size: 0.9rem;">Total Spent</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-cyan);">₺${totalSpent.toFixed(2)}</div>
      </div>
    `;

    const tbody = document.getElementById('history-list');

    if (completed.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No completed sessions yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = completed.map(s => {
      const date = new Date(s.ended_at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: var(--spacing-3);">${date}</td>
          <td style="padding: var(--spacing-3);">
            <div style="font-weight: 500;">${s.station_name}</div>
            <div class="text-muted" style="font-size: 0.8rem;">${s.charger_label}</div>
          </td>
          <td style="padding: var(--spacing-3);">
            <div>${s.vehicle_brand}</div>
            <div class="text-muted" style="font-size: 0.8rem;">[${s.plate_number}]</div>
          </td>
          <td style="padding: var(--spacing-3); font-weight: 600;">${s.consumed_kwh.toFixed(2)} <span style="font-size:0.8em; font-weight:normal;" class="text-muted">kWh</span></td>
          <td style="padding: var(--spacing-3); font-weight: 600; color: var(--accent-cyan);">₺${s.cost.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    document.getElementById('history-list').innerHTML = `<tr><td colspan="5" class="text-red" style="text-align: center; padding: 2rem;">Failed to load history</td></tr>`;
  }
}
