import { api } from '../services/api.js';
import { loadGoogleMaps, calculateDistance } from '../utils/maps.js';

let mapInstance = null;
let markers = [];
let userLocation = { lat: 38.4237, lng: 27.1428 };
let directionsService = null;
let directionsRenderer = null;

export async function renderMap(container) {
  container.innerHTML = `
    <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center;">
      <select id="filter-connector" class="form-select" style="max-width: 160px;">
        <option value="">All Connectors</option>
        <option value="Type 2">Type 2</option>
        <option value="CCS">CCS</option>
        <option value="CHAdeMO">CHAdeMO</option>
      </select>
      <select id="filter-power" class="form-select" style="max-width: 160px;">
        <option value="">All Speeds</option>
        <option value="22">Up to 22 kW</option>
        <option value="50">50 kW+</option>
        <option value="150">150 kW+</option>
      </select>
      <button class="btn btn-ghost" id="btn-locate"><i class="ph ph-crosshair"></i> Locate</button>
      <button class="btn btn-ghost" id="btn-clear-route" style="display: none;"><i class="ph ph-x"></i> Clear Route</button>
    </div>
    
    <div class="map-layout-wrapper">
      <div id="map-canvas" class="map-container"></div>
      
      <div class="card" style="height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 0;">
        <h3 style="font-size: 14px; padding: 16px 20px; border-bottom: 0.5px solid var(--border);">Nearby Stations</h3>
        <div id="station-list" style="flex: 1; overflow-y: auto; padding: 0;">
          <div class="text-muted" style="padding: 16px 20px; font-size: 13px;">Loading...</div>
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
              icon: { path: googleMaps.SymbolPath.CIRCLE, scale: 8, fillColor: '#60A5FA', fillOpacity: 1, strokeWeight: 2, strokeColor: '#0B1121' },
              title: 'Your Location'
            });
            loadStations();
          },
          () => window.showToast('Location access denied', 'error')
        );
      }
    });

    document.getElementById('btn-clear-route').addEventListener('click', (e) => {
      if (directionsRenderer) directionsRenderer.setDirections({routes: []});
      e.target.style.display = 'none';
      mapInstance.setCenter(userLocation);
      mapInstance.setZoom(12);
    });

  } catch (err) {
    document.getElementById('map-canvas').innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--red); padding: 2rem; text-align: center; font-size: 13px;">
        ${err.message}<br/>Check that the API key is set in .env and the server is running.
      </div>
    `;
  }
}

function initMap(googleMaps) {
  mapInstance = new googleMaps.Map(document.getElementById('map-canvas'), {
    center: userLocation,
    zoom: 12,
    styles: [
      { elementType: "geometry", stylers: [{ color: "#000000" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#1C1C1E" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#8E8E93" }] },
      { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#F5F5F7" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#1C1C1E" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#2C2C2E" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8E8E93" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0A84FF" }, { opacity: 0.1 }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3A3A3C" }] },
    ]
  });

  directionsService = new googleMaps.DirectionsService();
  directionsRenderer = new googleMaps.DirectionsRenderer({
    map: mapInstance,
    suppressMarkers: true,
    polylineOptions: { strokeColor: '#3B82F6', strokeWeight: 4 }
  });
}

async function loadStations() {
  if (!mapInstance) return;
  
  const filterConn = document.getElementById('filter-connector').value;
  const filterPower = parseInt(document.getElementById('filter-power').value) || 0;

  try {
    const stations = await api.getStations();
    
    markers.forEach(m => m.setMap(null));
    markers = [];
    
    const sidebar = document.getElementById('station-list');
    sidebar.innerHTML = '';

    stations.forEach(s => {
      s.distance = calculateDistance(userLocation.lat, userLocation.lng, s.lat, s.lng);
    });

    stations.sort((a, b) => a.distance - b.distance);

    let visibleCount = 0;

    stations.forEach(station => {
      const hasCompatibleCharger = station.chargers.some(c => 
        (filterConn === '' || c.connector_type === filterConn) &&
        (c.power_kw >= filterPower)
      );

      if (!hasCompatibleCharger && (filterConn || filterPower > 0)) return;
      visibleCount++;

      let statusColor = '#32D74B'; // Apple Green
      if (station.status === 'offline') statusColor = '#FF453A'; // Apple Red
      else if (station.chargers.every(c => c.status === 'occupied' || c.status === 'out_of_service')) statusColor = '#FFD60A'; // Apple Yellow

      const marker = new window.google.maps.Marker({
        position: { lat: station.lat, lng: station.lng },
        map: mapInstance,
        title: station.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: statusColor,
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#0B1121'
        }
      });

      marker.addListener('click', () => showStationDetail(station.id));
      markers.push(marker);

      sidebar.innerHTML += `
        <div style="padding: 14px; border-bottom: 0.5px solid var(--border); cursor: pointer; font-size: 13px;" onclick="showStationDetail(${station.id})">
          <div style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <div style="font-weight: 600; font-size: 14px; color: var(--text-0);">${station.name}</div>
            <span class="badge badge-${station.status === 'available' ? 'available' : 'offline'}">${station.status}</span>
          </div>
          <div class="text-1" style="font-size: 12px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
            <i class="ph ph-map-pin"></i> ${station.distance.toFixed(1)} km
          </div>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${Array.from(new Set(station.chargers.map(c => c.connector_type))).map(type => 
              `<span style="background: var(--bg-2); padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; color: var(--text-1); text-transform: uppercase;">${type}</span>`
            ).join('')}
          </div>
        </div>
      `;
    });

    if (visibleCount === 0) {
      sidebar.innerHTML = '<div class="text-muted" style="font-size: 13px;">No stations match your filters.</div>';
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
        <div style="background: var(--bg-0); border: 1px solid var(--border-subtle); border-radius: var(--radius); padding: 10px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
          <div>
            <div style="font-weight: 600;">${c.charger_label}</div>
            <div class="text-muted" style="font-size: 12px;">
              ${c.power_kw}kW · ${c.connector_type} · ₺${c.price_per_kwh}/kWh
            </div>
          </div>
          <div style="text-align: right;">
             <span class="badge badge-${isAvailable ? 'available' : 'occupied'}">${c.status}</span>
             ${isAvailable ? `<button class="btn btn-primary" style="padding: 3px 10px; font-size: 12px; margin-top: 4px; display: block;" onclick="openReservationModal(${station.id}, ${c.id})">Reserve</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
        <h2 style="font-size: 18px;">${station.name}</h2>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-ghost" style="padding: 4px 8px; font-size: 12px;" onclick="getDirections(${station.lat}, ${station.lng})"><i class="ph ph-navigation-arrow"></i> Directions</button>
          <button class="btn btn-ghost text-amber" style="padding: 4px 8px; font-size: 12px;" onclick="reportIssue(${station.id})"><i class="ph ph-warning-circle"></i> Report</button>
        </div>
      </div>
      <p class="text-muted" style="font-size: 13px; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;"><i class="ph ph-map-pin"></i> ${station.address}</p>
      <p class="text-muted" style="font-size: 13px; margin-bottom: 16px; display: flex; align-items: center; gap: 4px;"><i class="ph ph-clock"></i> ${station.operating_hours}</p>
      
      <h3 style="font-size: 14px; margin-bottom: 8px;">Chargers</h3>
      ${chargersHtml}
    `;
    
    window.openModal(html);
  } catch (err) {
    window.showToast('Failed to load station details', 'error');
  }
};

window.reportIssue = async (stationId) => {
  const desc = prompt('Describe the issue:');
  if (!desc || desc.trim() === '') return;

  try {
    const res = await api.reportIssue(stationId, null, desc);
    window.showToast(res.message);
  } catch (err) {
    window.showToast(err.message, 'error');
  }
};

window.getDirections = (lat, lng) => {
  window.closeModal();
  directionsService.route({
    origin: userLocation,
    destination: { lat, lng },
    travelMode: window.google.maps.TravelMode.DRIVING
  }, (response, status) => {
    if (status === 'OK') {
      directionsRenderer.setDirections(response);
      document.getElementById('btn-clear-route').style.display = 'inline-flex';
    } else {
      window.showToast('Could not find route: ' + status, 'error');
    }
  });
};
