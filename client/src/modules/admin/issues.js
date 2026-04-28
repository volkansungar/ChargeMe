import { api } from '../../services/api.js';

export async function renderAdminIssues(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Issue Reports</h2>
      <button class="btn btn-ghost" onclick="location.reload()"><i class="ph ph-arrow-clockwise"></i> Refresh</button>
    </div>
    
    <div class="card-flush">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Station</th>
              <th>Description</th>
              <th>Status</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody id="issues-list">
            <tr><td colspan="5" style="text-align:center;padding:32px;"><div class="spinner" style="margin:0 auto;"></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  await loadIssues();
}

async function loadIssues() {
  const tbody = document.getElementById('issues-list');
  try {
    const issues = await api.getAdminIssues();

    if (issues.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:32px;">No issues reported.</td></tr>';
      return;
    }

    tbody.innerHTML = issues.map(i => {
      const date = new Date(i.created_at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const isResolved = i.status === 'resolved';
      
      return `
        <tr style="opacity: ${isResolved ? '0.5' : '1'}">
          <td style="white-space: nowrap;">${date}</td>
          <td>
            <div style="font-weight: 500;">${i.station_name}</div>
            <div class="text-muted" style="font-size: 12px;">${i.charger_label || 'General'}</div>
          </td>
          <td>${i.description}</td>
          <td>
            <span class="badge badge-${isResolved ? 'available' : 'offline'}">${i.status}</span>
          </td>
          <td style="text-align: right;">
            ${!isResolved 
              ? `<button class="btn btn-success" style="padding: 4px 8px; font-size: 12px;" onclick="resolveIssue(${i.id})">Resolve</button>` 
              : `<span class="text-muted" style="font-size: 12px;">Done</span>`}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-red" style="text-align:center;padding:32px;">Failed to load issues</td></tr>`;
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
