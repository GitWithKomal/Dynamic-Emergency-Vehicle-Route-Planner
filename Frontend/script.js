const API_BASE = "http://127.0.0.1:5000";

// ✅ Nagpur coordinates
const NAGPUR_LAT = 21.1458;
const NAGPUR_LNG = 79.0882;

let map = null;
let routeLayer = null;
let carMarker = null;
let destinationMarker = null;
let routeCoords = [];
let watchId = null;
let isFollowing = true; // ✅ Controls if map follows user or not

// ✅ Mappls map initializes via SDK callback - LOCKED to Nagpur
function initMap() {
  map = new mappls.Map("map", {
    center: { lat: NAGPUR_LAT, lng: NAGPUR_LNG },
    zoom: 13,
    search: false
  });

  let lockCount = 0;
  const lockInterval = setInterval(() => {
    if (lockCount < 10) {
      map.setCenter({ lat: NAGPUR_LAT, lng: NAGPUR_LNG });
      map.setZoom(13);
      lockCount++;
    } else {
      clearInterval(lockInterval);
    }
  }, 300);

  map.on("load", function () {
    clearInterval(lockInterval);
    map.setCenter({ lat: NAGPUR_LAT, lng: NAGPUR_LNG });
    map.setZoom(13);
    addRecenterButton(); // ✅ Add recenter button after map loads
  });

  // ✅ When user manually scrolls/drags map, stop following
  map.on("dragstart", function () {
    isFollowing = false;
  });
}

// ✅ Recenter button - adds on map
function addRecenterButton() {
  const btn = document.createElement("button");
  btn.id = "recenterBtn";
  btn.innerHTML = "📍";
  btn.title = "Recenter to my location";
  btn.style.cssText = `
    position: absolute;
    bottom: 120px;
    right: 12px;
    z-index: 999;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #ffffff;
    border: none;
    font-size: 20px;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  btn.onclick = function () {
    isFollowing = true; // ✅ Resume following
    if (carMarker) {
      const pos = carMarker.getPosition();
      if (pos) {
        map.setCenter({ lat: pos.lat, lng: pos.lng });
        map.setZoom(15);
      }
    }
  };
  document.getElementById("map").appendChild(btn);
}

// ✅ GPS location button
function getLocation() {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      document.getElementById("start").value = `${lat}, ${lng}`;
      map.setCenter({ lat: lat, lng: lng });
      map.setZoom(15);
      if (carMarker) {
        carMarker.remove();
        carMarker = null;
      }
      // ✅ Arrow icon for user
      carMarker = new mappls.Marker({
        map: map,
        position: { lat: lat, lng: lng },
        html: '<div style="width:28px;height:28px;background:#1a73e8;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(26,115,232,0.6);display:flex;align-items:center;justify-content:center;"><i class="fas fa-location-arrow" style="color:white;font-size:14px;"></i></div>',
        width: 28,
        height: 28
      });
    },
    () => alert("GPS blocked or denied.")
  );
}

// ✅ Popup handling
function showPopup(txt) {
  const popup = document.getElementById("popup");
  const popupContent = document.querySelector(".popup-content");
  document.getElementById("popup-text").innerText = txt;
  popup.style.display = "flex";
  popup.style.zIndex = "10000";
  popupContent.style.zIndex = "10001";
  popupContent.style.background = "#fff";
  popupContent.style.boxShadow = "0 0 20px rgba(0,0,0,0.3)";
}
function closePopup() {
  document.getElementById("popup").style.display = "none";
}

// ✅ Safe route removal
function removeRoute() {
  if (routeLayer) {
    try { routeLayer.setMap(null); } catch(e) {
      try { routeLayer.remove(); } catch(e2) {}
    }
    routeLayer = null;
  }
}

// ✅ Find fastest route - Nagpur biased search
async function findRoute() {
  const startRaw = document.getElementById("start").value.trim();
  const destinationRaw = document.getElementById("destination").value.trim();
  if (!startRaw || !destinationRaw) return alert("Enter both start and destination.");

  const start = startRaw.toLowerCase().includes("nagpur") ? startRaw : `${startRaw}, Nagpur`;
  const destination = destinationRaw.toLowerCase().includes("nagpur") ? destinationRaw : `${destinationRaw}, Nagpur`;

  const res = await fetch(`${API_BASE}/api/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, destination }),
  });
  const data = await res.json();
  if (data.error) return alert(data.error);

  routeCoords = data.polyline.coordinates;

  removeRoute();

  // ✅ Professional Google Maps style route - blue with white border
  // Outer white border line
  new mappls.Polyline({
    map: map,
    path: routeCoords.map(([lng, lat]) => ({ lat, lng })),
    strokeColor: "#ffffff",
    strokeOpacity: 1,
    strokeWeight: 10
  });

  // ✅ Inner blue route line on top
  routeLayer = new mappls.Polyline({
    map: map,
    path: routeCoords.map(([lng, lat]) => ({ lat, lng })),
    strokeColor: "#1a73e8",
    strokeOpacity: 0.95,
    strokeWeight: 6
  });

  // ✅ Arrow icon for start/user position
  const [startLng, startLat] = routeCoords[0];
  if (carMarker) {
    carMarker.remove();
    carMarker = null;
  }
  carMarker = new mappls.Marker({
    map: map,
    position: { lat: startLat, lng: startLng },
    html: '<div style="width:28px;height:28px;background:#1a73e8;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(26,115,232,0.6);display:flex;align-items:center;justify-content:center;"><i class="fas fa-location-arrow" style="color:white;font-size:14px;"></i></div>',
    width: 28,
    height: 28
  });

  // ✅ Location pin for destination
  const [destLng, destLat] = routeCoords[routeCoords.length - 1];
  if (destinationMarker) {
    destinationMarker.remove();
    destinationMarker = null;
  }
  destinationMarker = new mappls.Marker({
    map: map,
    position: { lat: destLat, lng: destLng },
    html: '<div style="text-align:center;"><i class="fas fa-map-marker-alt" style="color:#d32f2f;font-size:32px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));"></i></div>',
    width: 32,
    height: 40
  });

  // Fit map to route bounds
  const lats = routeCoords.map(([lng, lat]) => lat);
  const lngs = routeCoords.map(([lng, lat]) => lng);
  map.fitBounds([
    { lat: Math.min(...lats), lng: Math.min(...lngs) },
    { lat: Math.max(...lats), lng: Math.max(...lngs) }
  ]);

  isFollowing = true;
  showPopup(`🚗 Route Ready!\nDistance: ${data.distance_km} km\nDuration: ${data.duration_min} min`);
}

// ✅ Live GPS tracking - NO more auto wobbling
function startTracking() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported.");
    return;
  }

  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;

      // ✅ Update marker position
      if (!carMarker) {
        carMarker = new mappls.Marker({
          map: map,
          position: { lat, lng },
          html: '<div style="width:28px;height:28px;background:#1a73e8;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(26,115,232,0.6);display:flex;align-items:center;justify-content:center;"><i class="fas fa-location-arrow" style="color:white;font-size:14px;"></i></div>',
          width: 28,
          height: 28
        });
      } else {
        carMarker.setPosition({ lat, lng });
      }

      // ✅ Only pan map if user hasn't manually scrolled away
      if (isFollowing) {
        map.setCenter({ lat, lng });
      }

      // Update route line
      if (routeCoords.length > 0) {
        const newRoute = routeCoords.filter(([x, y]) => {
          const dist = Math.sqrt((x - lng) ** 2 + (y - lat) ** 2);
          return dist > 0.0005;
        });
        removeRoute();
        if (newRoute.length > 1) {
          // White border
          new mappls.Polyline({
            map: map,
            path: newRoute.map(([lng, lat]) => ({ lat, lng })),
            strokeColor: "#ffffff",
            strokeOpacity: 1,
            strokeWeight: 10
          });
          // Blue inner line
          routeLayer = new mappls.Polyline({
            map: map,
            path: newRoute.map(([lng, lat]) => ({ lat, lng })),
            strokeColor: "#1a73e8",
            strokeOpacity: 0.95,
            strokeWeight: 6
          });
        }
      }
    },
    (err) => console.warn("Tracking error:", err),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}

// ✅ SOS
async function sendSOS() {
  const loc = document.getElementById("start").value.trim();
  if (!loc) return alert("Set your location first.");
  const res = await fetch(`${API_BASE}/api/sos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: loc }),
  });
  const data = await res.json();
  if (data.success) showPopup("🚨 SOS Sent Successfully!");
}

// ✅ Emergency contacts
const emergencyContacts = [
  { name: "Police", number: "100", icon: "🚓", color: "#2979ff" },
  { name: "Ambulance", number: "108", icon: "🚑", color: "#43a047" },
  { name: "Fire Station", number: "101", icon: "🔥", color: "#d32f2f" },
  { name: "Women Helpline", number: "1091", icon: "👩‍🦰", color: "#ff4081" },
];
function loadEmergencyContacts() {
  const c = document.getElementById("emergency-contacts");
  c.innerHTML = "";
  emergencyContacts.forEach((x) => {
    c.innerHTML += `<div class="contact-card" style="border-left:4px solid ${x.color}">
        <h3>${x.icon} ${x.name}</h3><p>${x.number}</p></div>`;
  });
}
document.addEventListener("DOMContentLoaded", loadEmergencyContacts);