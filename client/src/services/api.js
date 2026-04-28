const API_BASE = '/api';

export const api = {
  // Global config
  async getConfig() {
    return this.request('/config');
  },

  // Vehicles
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

  // Stations
  async getStations() {
    return this.request('/stations');
  },
  async getStation(id) {
    return this.request(`/stations/${id}`);
  },

  // Reservations
  async getReservations() {
    return this.request('/reservations');
  },
  async createReservation(data) {
    return this.request('/reservations', 'POST', data);
  },
  async cancelReservation(id) {
    return this.request(`/reservations/${id}`, 'DELETE');
  },

  // Sessions
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

  // Wallet
  async getWallet() {
    return this.request('/wallet');
  },
  async topupWallet(amount) {
    return this.request('/wallet/topup', 'POST', { amount });
  },

  // Helper
  async request(endpoint, method = 'GET', body = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }
      
      return data;
    } catch (error) {
      console.error(`API Error (${method} ${endpoint}):`, error);
      throw error;
    }
  }
};
