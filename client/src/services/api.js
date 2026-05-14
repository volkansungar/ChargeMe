const API_BASE = '/api';

// Token management
function getToken() {
  return localStorage.getItem('auth_token');
}

function setToken(token) {
  localStorage.setItem('auth_token', token);
}

function removeToken() {
  localStorage.removeItem('auth_token');
}

export const api = {
  // ── Auth ──
  async login(username, password) {
    return this.request('/auth/login', 'POST', { username, password }, true);
  },
  async register(data) {
    return this.request('/auth/register', 'POST', data, true);
  },
  async getMe() {
    return this.request('/auth/me');
  },
  logout() {
    removeToken();
  },

  // ── Global config ──
  async getConfig() {
    return this.request('/config', 'GET', null, true);
  },

  // ── Vehicles ──
  async getVehicles() {
    return this.request('/vehicles');
  },
  async getVehicle(id) {
    return this.request(`/vehicles/${id}`);
  },
  async createVehicle(data) {
    return this.request('/vehicles', 'POST', data);
  },
  async deleteVehicle(id) {
    return this.request(`/vehicles/${id}`, 'DELETE');
  },

  // ── Stations ──
  async getStations() {
    return this.request('/stations', 'GET', null, true);
  },
  async getStation(id) {
    return this.request(`/stations/${id}`, 'GET', null, true);
  },

  // ── Reservations ──
  async getReservations() {
    return this.request('/reservations');
  },
  async createReservation(data) {
    return this.request('/reservations', 'POST', data);
  },
  async cancelReservation(id) {
    return this.request(`/reservations/${id}`, 'DELETE');
  },

  // ── Sessions ──
  async getSessions() {
    return this.request('/sessions');
  },
  async startSession(data) {
    return this.request('/sessions/start', 'POST', data);
  },
  async updateSession(id, data) {
    return this.request(`/sessions/${id}/update`, 'PUT', data);
  },
  async endSession(id, data) {
    return this.request(`/sessions/${id}/end`, 'PUT', data);
  },

  // ── Wallet ──
  async getWallet() {
    return this.request('/wallet');
  },
  async topupWallet(amount) {
    return this.request('/wallet/topup', 'POST', { amount });
  },

  // ── Favorites ──
  async checkFavorite(stationId) {
    return this.request(`/stations/${stationId}/favorite`);
  },
  async toggleFavorite(stationId) {
    return this.request(`/stations/${stationId}/favorite`, 'POST');
  },

  // ── Admin ──
  async getAdminStats() {
    return this.request('/admin/stats');
  },
  async getAdminUtilization() {
    return this.request('/admin/utilization');
  },
  async updateStationHours(id, operating_hours) {
    return this.request(`/stations/${id}`, 'PUT', { operating_hours });
  },
  async updateChargerHardware(stationId, chargerId, data) {
    return this.request(`/stations/${stationId}/chargers/${chargerId}`, 'PUT', data);
  },
  async updateChargerStatus(stationId, chargerId, status) {
    return this.request(`/stations/${stationId}/chargers/${chargerId}/status`, 'PUT', { status });
  },
  async reportIssue(stationId, chargerId, description) {
    return this.request(`/stations/${stationId}/issues`, 'POST', { charger_id: chargerId, description });
  },
  async getAdminIssues() {
    return this.request('/admin/issues');
  },
  async resolveIssue(issueId) {
    return this.request(`/admin/issues/${issueId}/resolve`, 'PUT');
  },
  async getAdminMarketing() {
    return this.request('/admin/marketing');
  },
  async getAdminUsers() {
    return this.request('/admin/users');
  },
  async updateUserRole(userId, role) {
    return this.request(`/admin/users/${userId}/role`, 'PUT', { role });
  },
  async deleteUser(userId) {
    return this.request(`/admin/users/${userId}`, 'DELETE');
  },

  // ── Helper ──
  async request(endpoint, method = 'GET', body = null, skipAuth = false) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Attach JWT token if available
    const token = getToken();
    if (token && !skipAuth) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    // Also attach for auth endpoints that need it (like /me)
    if (token && endpoint.startsWith('/auth/me')) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const data = await response.json();
      
      if (!response.ok) {
        // Auto-logout on 401 (expired/invalid token)
        if (response.status === 401 && !endpoint.startsWith('/auth/')) {
          removeToken();
          window.location.hash = '#/login';
        }
        throw new Error(data.error || 'API request failed');
      }

      // Save token from login/register responses
      if (data.token) {
        setToken(data.token);
      }
      
      return data;
    } catch (error) {
      console.error(`API Error (${method} ${endpoint}):`, error);
      throw error;
    }
  }
};
