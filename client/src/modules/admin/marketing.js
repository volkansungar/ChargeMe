import { api } from '../../services/api.js';

export async function renderAdminMarketing(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-6);">
      <h2 class="text-gradient">Marketing Analytics</h2>
      <button class="btn btn-outline" onclick="location.reload()">Refresh Data</button>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-6);">
      <!-- Top Favorited -->
      <div class="glass-card">
        <h3 style="margin-bottom: var(--spacing-4);">Top Favorited Stations</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--glass-border);">
              <th style="padding: var(--spacing-2); color: var(--text-muted); font-weight: 500;">Station Name</th>
              <th style="padding: var(--spacing-2); color: var(--text-muted); font-weight: 500; text-align: right;">Favorites</th>
            </tr>
          </thead>
          <tbody id="marketing-favorites">
            <tr><td colspan="2" style="text-align: center; padding: 1rem;"><div class="spinner" style="margin: 0 auto;"></div></td></tr>
          </tbody>
        </table>
      </div>

      <!-- Usage Habits -->
      <div class="glass-card">
        <h3 style="margin-bottom: var(--spacing-4);">Usage Habits (Time of Day)</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--glass-border);">
              <th style="padding: var(--spacing-2); color: var(--text-muted); font-weight: 500;">Time Window</th>
              <th style="padding: var(--spacing-2); color: var(--text-muted); font-weight: 500; text-align: right;">Sessions Booked</th>
            </tr>
          </thead>
          <tbody id="marketing-habits">
            <tr><td colspan="2" style="text-align: center; padding: 1rem;"><div class="spinner" style="margin: 0 auto;"></div></td></tr>
          </tbody>
        </table>
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
      favTbody.innerHTML = '<tr><td colspan="2" class="text-muted" style="text-align: center; padding: 1rem;">No favorites data available yet.</td></tr>';
    } else {
      favTbody.innerHTML = data.topFavorites.map(f => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: var(--spacing-2); font-weight: 500;">${f.name}</td>
          <td style="padding: var(--spacing-2); text-align: right; color: var(--accent-amber); font-weight: 600;">❤️ ${f.fav_count}</td>
        </tr>
      `).join('');
    }

    const habTbody = document.getElementById('marketing-habits');
    if (data.timeHabits.length === 0) {
      habTbody.innerHTML = '<tr><td colspan="2" class="text-muted" style="text-align: center; padding: 1rem;">No booking data available yet.</td></tr>';
    } else {
      habTbody.innerHTML = data.timeHabits.map(h => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: var(--spacing-2); font-weight: 500;">${h.time_of_day}</td>
          <td style="padding: var(--spacing-2); text-align: right; color: var(--accent-cyan); font-weight: 600;">${h.session_count}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    window.showToast('Failed to load marketing analytics', 'error');
  }
}
