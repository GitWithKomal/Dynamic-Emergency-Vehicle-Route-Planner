const API_BASE = "http://127.0.0.1:5000";

let map = L.map("map").setView([19.0760, 72.8777], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

let routeLayer = null;
let carMarker = null;
let routeCoords = [];
let currentIndex = 0;
let watchId = null;

const carIcon = L.divIcon({
  html: '<i class="fa-solid fa-car-on" style="color:#007bff;font-size:26px;"></i>',
  iconSize: [26, 26],
  className: "custom-car-icon"
});

/* GPS location button */
function getLocation() {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      document.getElementById("start").value = `${lat}, ${lng}`;
      map.setView([lat, lng], 15);
      if (carMarker) carMarker.remove();
      carMarker = L.marker([lat, lng], { icon: carIcon }).addTo(map);
    },
    () => alert("GPS blocked or denied.")
  );
}

/* Popup handling */
function showPopup(txt) {
  const popup = document.getElementById("popup");
  const popupContent = document.querySelector(".popup-content");

  document.getElementById("popup-text").innerText = txt;
  popup.style.display = "flex";

  // 🔹 Ensure popup appears above everything (including map)
  popup.style.zIndex = "10000";
  popupContent.style.zIndex = "10001";
  popupContent.style.background = "#fff";
  popupContent.style.boxShadow = "0 0 20px rgba(0,0,0,0.3)";
}
function closePopup() {
  document.getElementById("popup").style.display = "none";
}

/* Find fastest route */
async function findRoute() {
  const start = document.getElementById("start").value.trim();
  const destination = document.getElementById("destination").value.trim();
  if (!start || !destination) return alert("Enter both start and destination.");

  const res = await fetch(`${API_BASE}/api/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, destination }),
  });
  const data = await res.json();
  if (data.error) return alert(data.error);

  routeCoords = data.polyline.coordinates;
  if (routeLayer) routeLayer.remove();

  // 🔹 Changed route color to dark blue (#003399)
  routeLayer = L.geoJSON(
    { type: "LineString", coordinates: routeCoords },
    { style: { color: "#003399", weight: 6, opacity: 0.9 } }
  ).addTo(map);

  const [lng, lat] = routeCoords[0];
  if (carMarker) carMarker.remove();
  carMarker = L.marker([lat, lng], { icon: carIcon }).addTo(map);
  map.fitBounds(L.geoJSON({ type: "LineString", coordinates: routeCoords }).getBounds());

  showPopup(`🚗 Route Ready!\nDistance: ${data.distance_km} km\nDuration: ${data.duration_min} min`);
}

/* Live GPS tracking */
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
      if (!carMarker) carMarker = L.marker([lat, lng], { icon: carIcon }).addTo(map);
      carMarker.setLatLng([lat, lng]);
      map.panTo([lat, lng]);

      // Update the route line to fade behind current location
      if (routeCoords.length > 0) {
        const newRoute = routeCoords.filter(([x, y]) => {
          const dist = Math.sqrt((x - lng) ** 2 + (y - lat) ** 2);
          return dist > 0.0005;
        });
        if (routeLayer) routeLayer.remove();
        routeLayer = L.geoJSON(
          { type: "LineString", coordinates: newRoute },
          { style: { color: "#003399", weight: 6, opacity: 0.9 } } // 🔹 Dark blue
        ).addTo(map);
      }
    },
    (err) => console.warn("Tracking error:", err),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}

/* SOS */
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

/* Contacts */
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
