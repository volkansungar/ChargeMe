import { api } from '../services/api.js';

let googleMapsPromise = null;

export async function loadGoogleMaps() {
  if (window.google && window.google.maps) {
    return window.google.maps;
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise(async (resolve, reject) => {
    try {
      const config = await api.getConfig();
      if (!config.googleMapsApiKey) {
        throw new Error('Google Maps API key not found. Please check your .env file.');
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsApiKey}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => resolve(window.google.maps);
      script.onerror = () => reject(new Error('Failed to load Google Maps SDK'));
      
      document.head.appendChild(script);
    } catch (err) {
      reject(err);
    }
  });

  return googleMapsPromise;
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  // Haversine formula for distance calculation in km
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}
