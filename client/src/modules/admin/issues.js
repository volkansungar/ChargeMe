import { api } from '../../services/api.js';

export async function renderAdminIssues(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-6);">
      <h2 class="text-gradient">Issue Reports</h2>
      <button class="btn btn-outline" onclick="location.reload()">Refresh Data</button>
    </div>
    
    <div class="glass-card">
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="border-bottom: 1px solid var(--glass-border);">
            <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500;">Date</th>
            <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500;">Station & Charger</th>
            <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500;">Issue Description</th>
            <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500;">Status</th>
            <th style="padding: var(--spacing-3); color: var(--text-muted); font-weight: 500; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody id="issues-list">
          <tr><td colspan="5" style="text-align: center; padding: 2rem;"><div class="spinner" style="margin: 0 auto;"></div></td></tr>
        </tbody>
      </table>
    </div>
  `;

  await loadIssues();
}

async function loadIssues() {
  const tbody = document.getElementById('issues-list');
  try {
    const issues = await api.getAdminIssues();

    if (issues.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align: center; padding: 2rem;">No issues reported.</td></tr>';
      return;
    }

    tbody.innerHTML = issues.map(i => {
      const date = new Date(i.created_at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const isResolved = i.status === 'resolved';
      
      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); opacity: ${isResolved ? '0.6' : '1'}">
          <td style="padding: var(--spacing-3); white-space: nowrap;">${date}</td>
          <td style="padding: var(--spacing-3);">
            <div style="font-weight: 500;">${i.station_name}</div>
            <div class="text-secondary" style="font-size: 0.85rem;">${i.charger_label || 'Station wide'}</div>
          </td>
          <td style="padding: var(--spacing-3);">${i.description}</td>
          <td style="padding: var(--spacing-3);">
            <span class="badge badge-${isResolved ? 'available' : 'offline'}">${i.status}</span>
          </td>
          <td style="padding: var(--spacing-3); text-align: right;">
            ${!isResolved 
              ? `<button class="btn btn-success" style="padding: 4px 8px; font-size: 0.8rem;" onclick="resolveIssue(${i.id})">Mark Resolved</button>` 
              : `<span class="text-muted">Done</span>`}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-red" style="text-align: center; padding: 2rem;">Failed to load issues</td></tr>`;
  }
}

window.resolveIssue = async (id) => {
  if (!confirm('Mark this issue as resolved?')) return;
  try {
    await api.resolveIssue(id);
    window.showToast('Issue resolved');
    loadIssues();
  } catch (err) {
    window.showToast(err.message, 'error');
  }
};
