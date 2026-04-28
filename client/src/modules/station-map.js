import { api } from '../services/api.js';
import { loadGoogleMaps, calculateDistance } from '../utils/maps.js';

let mapInstance = null;
let markers = [];
let userLocation = { lat: 38.4237, lng: 27.1428 }; // Default: İzmir Center

export async function renderMap(container) {
  container.innerHTML = `
    <div style="display: flex; gap: var(--spacing-4); margin-bottom: var(--spacing-4);">
      <select id="filter-connector" class="form-select" style="max-width: 200px;">
        <option value="">All Connectors</option>
        <option value="Type 2">Type 2</option>
        <option value="CCS">CCS</option>
        <option value="CHAdeMO">CHAdeMO</option>
      </select>
      <select id="filter-power" class="form-select" style="max-width: 200px;">
        <option value="">All Speeds</option>
        <option value="22">Up to 22 kW</option>
        <option value="50">50 kW+</option>
        <option value="150">150 kW+</option>
      </select>
      <button class="btn btn-outline" id="btn-locate">📍 Find Me</button>
    </div>
    
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: var(--spacing-6);">
      <div id="map-canvas" class="map-container"></div>
      
      <div id="station-sidebar" class="glass-card" style="height: 600px; overflow-y: auto;">
        <h3 style="margin-bottom: var(--spacing-4);">Nearby Stations</h3>
        <div id="station-list" style="display: flex; flex-direction: column; gap: var(--spacing-4);">
          <div class="text-muted">Loading stations...</div>
        </div>
      </div>
    </div>
  `;

  try {
    const googleMaps = await loadGoogleMaps();
    initMap(googleMaps);
    await loadStations();

    document.getElementById('filter-connector').addEventListener('change', loadStations);
    document.getElementById('filter-power').addEventListener('change', loadStations);
    document.getElementById('btn-locate').addEventListener('click', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
            mapInstance.setCenter(userLocation);
            mapInstance.setZoom(13);
            new googleMaps.Marker({
              position: userLocation,
              map: mapInstance,
              icon: { path: googleMaps.SymbolPath.CIRCLE, scale: 8, fillColor: '#3B82F6', fillOpacity: 1, strokeWeight: 2, strokeColor: 'white' },
              title: 'Your Location'
            });
            loadStations();
          },
          () => window.showToast('Location access denied', 'error')
        );
      }
    });

  } catch (err) {
    document.getElementById('map-canvas').innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--accent-red); padding: 2rem; text-align: center;">
        ${err.message}<br/>Make sure you added the API key to the .env file and restarted the server.
      </div>
    `;
  }
}

function initMap(googleMaps) {
  mapInstance = new googleMaps.Map(document.getElementById('map-canvas'), {
    center: userLocation,
    zoom: 12,
    styles: [
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
      },
      {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
      },
      {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }],
      },
    ]
  });
}

async function loadStations() {
  if (!mapInstance) return;
  
  const filterConn = document.getElementById('filter-connector').value;
  const filterPower = parseInt(document.getElementById('filter-power').value) || 0;

  try {
    const stations = await api.getStations();
    
    // Clear old markers
    markers.forEach(m => m.setMap(null));
    markers = [];
    
    const sidebar = document.getElementById('station-list');
    sidebar.innerHTML = '';

    // Calculate distances
    stations.forEach(s => {
      s.distance = calculateDistance(userLocation.lat, userLocation.lng, s.lat, s.lng);
    });

    // Sort by distance
    stations.sort((a, b) => a.distance - b.distance);

    let visibleCount = 0;

    stations.forEach(station => {
      // Apply filters
      const hasCompatibleCharger = station.chargers.some(c => 
        (filterConn === '' || c.connector_type === filterConn) &&
        (c.power_kw >= filterPower)
      );

      if (!hasCompatibleCharger && (filterConn || filterPower > 0)) return;
      visibleCount++;

      // Determine station status color
      let statusColor = '#10B981'; // Green
      if (station.status === 'offline') statusColor = '#EF4444'; // Red
      else if (station.chargers.every(c => c.status === 'occupied' || c.status === 'out_of_service')) statusColor = '#F59E0B'; // Yellow

      // Add map marker
      const marker = new window.google.maps.Marker({
        position: { lat: station.lat, lng: station.lng },
        map: mapInstance,
        title: station.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: statusColor,
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: 'white'
        }
      });

      marker.addListener('click', () => showStationDetail(station.id));
      markers.push(marker);

      // Add to sidebar
      sidebar.innerHTML += `
        <div class="glass-card" style="padding: var(--spacing-4); cursor: pointer;" onclick="showStationDetail(${station.id})">
          <div style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <h4 style="margin:0; font-size: 1.1rem;">${station.name}</h4>
            <span class="badge badge-${station.status === 'available' ? 'available' : 'offline'}">${station.status}</span>
          </div>
          <div class="text-secondary" style="font-size: 0.85rem; margin-bottom: 0.5rem;">
            📍 ${station.distance.toFixed(1)} km away
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${Array.from(new Set(station.chargers.map(c => c.connector_type))).map(type => 
              `<span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">${type}</span>`
            ).join('')}
          </div>
        </div>
      `;
    });

    if (visibleCount === 0) {
      sidebar.innerHTML = '<div class="text-muted">No stations match your filters.</div>';
    }

  } catch (err) {
    console.error('Failed to load stations', err);
  }
}

window.showStationDetail = async (id) => {
  try {
    const station = await api.getStation(id);
    
    let chargersHtml = station.chargers.map(c => {
      const isAvailable = c.status === 'available';
      return `
        <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: var(--spacing-3); margin-bottom: var(--spacing-2); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600;">${c.charger_label}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
              ${c.power_kw}kW • ${c.connector_type} • ₺${c.price_per_kwh}/kWh
            </div>
          </div>
          <div style="text-align: right;">
             <span class="badge badge-${isAvailable ? 'available' : 'occupied'}">${c.status}</span>
             ${isAvailable ? `<button class="btn btn-primary" style="padding: 4px 12px; font-size: 0.8rem; margin-top: 4px; display: block;" onclick="openReservationModal(${station.id}, ${c.id})">Reserve</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <div class="modal-header">
        <h2 class="text-gradient">${station.name}</h2>
      </div>
      <p class="text-secondary" style="margin-bottom: var(--spacing-4);">📍 ${station.address}</p>
      <p style="margin-bottom: var(--spacing-4);">🕒 Hours: ${station.operating_hours}</p>
      
      <h3 style="margin-bottom: var(--spacing-3);">Available Chargers</h3>
      ${chargersHtml}
    `;
    
    window.openModal(html);
  } catch (err) {
    window.showToast('Failed to load station details', 'error');
  }
};
