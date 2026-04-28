import { api } from '../../services/api.js';

export async function renderAdminMarketing(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Marketing Analytics</h2>
      <button class="btn btn-ghost" onclick="location.reload()"><i class="ph ph-arrow-clockwise"></i> Refresh</button>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div class="card-flush">
        <div class="card-header">
          <h3 style="font-size: 14px; font-weight: 600;">Top Favorited Stations</h3>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Station</th>
                <th style="text-align: right;">Favorites</th>
              </tr>
            </thead>
            <tbody id="marketing-favorites">
              <tr><td colspan="2" style="text-align:center;padding:24px;"><div class="spinner" style="margin:0 auto;"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">Usage Habits</h3>
        <div style="width: 100%; height: 250px;">
          <canvas id="habitsChart"></canvas>
        </div>
      </div>
    </div>
  `;

  await loadMarketingData();
}

async function loadMarketingData() {
  try {
    const data = await api.getAdminMarketing();

    const favTbody = document.getElementById('marketing-favorites');
    if (data.topFavorites.length === 0) {
      favTbody.innerHTML = '<tr><td colspan="2" class="text-muted" style="text-align:center;padding:24px;">No data yet.</td></tr>';
    } else {
      favTbody.innerHTML = data.topFavorites.map(f => `
        <tr>
          <td style="font-weight: 500;">${f.name}</td>
          <td style="text-align: right; font-weight: 600; color: var(--amber);"><i class="ph-fill ph-heart"></i> ${f.fav_count}</td>
        </tr>
      `).join('');
    }

    if (window.Chart && data.timeHabits.length > 0) {
      const ctx = document.getElementById('habitsChart').getContext('2d');
      new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.timeHabits.map(h => h.time_of_day),
          datasets: [{
            label: 'Sessions',
            data: data.timeHabits.map(h => h.session_count),
            backgroundColor: '#34D399',
            borderRadius: 4
          }]
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: '#64748B', stepSize: 1 } },
            x: { grid: { display: false }, ticks: { color: '#64748B' } }
          }
        }
      });
    } else if (data.timeHabits.length === 0) {
      document.getElementById('habitsChart').parentElement.innerHTML = '<div class="text-muted" style="text-align:center;padding:32px;">No data yet.</div>';
    }
  } catch (err) {
    window.showToast('Failed to load marketing analytics', 'error');
  }
}
