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
let isFollowing = true;
let isTracking = false;
let sosActive = false;

// ==========================================
// TRAFFIC CONGESTION DATA & MONITORING
// ==========================================

const congestionLevels = {
  low: { color: '#4caf50', message: '✅ Road is clear', icon: '🟢' },
  medium: { color: '#ffc107', message: '⚠️ Moderate traffic', icon: '🟡' },
  high: { color: '#ff9800', message: '🚨 Heavy traffic', icon: '🔴' },
  severe: { color: '#f44336', message: '🛑 Severe congestion', icon: '⛔' }
};

// Mock traffic data on route
const trafficSpots = [
  { lat: 21.15, lng: 79.08, level: 'medium', description: 'Traffic light congestion' },
  { lat: 21.16, lng: 79.09, level: 'high', description: 'Heavy vehicle movement' },
  { lat: 21.14, lng: 79.10, level: 'low', description: 'Clear road ahead' }
];

// Check traffic on calculated route
function checkTrafficOnRoute() {
  if (routeCoords.length === 0) return;

  let trafficWarnings = [];

  routeCoords.forEach((coord, index) => {
    const [lng, lat] = coord;
    
    trafficSpots.forEach(spot => {
      const distance = Math.sqrt(Math.pow(lat - spot.lat, 2) + Math.pow(lng - spot.lng, 2));
      
      // If traffic spot is within 0.02 degrees (~2km)
      if (distance < 0.02) {
        trafficWarnings.push({
          level: spot.level,
          description: spot.description,
          percentage: Math.round(((index + 1) / routeCoords.length) * 100)
        });
      }
    });
  });

  if (trafficWarnings.length > 0) {
    const worstTraffic = trafficWarnings.reduce((prev, current) => {
      const levels = { low: 1, medium: 2, high: 3, severe: 4 };
      return levels[current.level] > levels[prev.level] ? current : prev;
    });

    displayTrafficWarning(worstTraffic, trafficWarnings);
  }
}

function displayTrafficWarning(worstTraffic, allWarnings) {
  const trafficData = congestionLevels[worstTraffic.level];
  
  showModernPopup({
    icon: trafficData.icon,
    title: '🚦 Traffic Alert',
    message: trafficData.message,
    details: {
      '📍 Location': worstTraffic.description,
      '📊 Route Progress': worstTraffic.percentage + '%',
      '⚠️ Total Warnings': allWarnings.length,
      '💡 Recommendation': worstTraffic.level === 'severe' ? 'Consider alternate route or delay journey' : 'Continue with caution'
    }
  });

  showToast('warning', '🚦 Traffic Detected', trafficData.message);

  // Highlight congested area on map if available
  highlightTrafficArea(worstTraffic);
}

function highlightTrafficArea(traffic) {
  const trafficData = congestionLevels[traffic.level];
  
  // Visual feedback on map (if needed)
  const trafficMarker = new mappls.Marker({
    map: map,
    position: { lat: trafficSpots[0].lat, lng: trafficSpots[0].lng },
    html: `<div style="
      width: 20px;
      height: 20px;
      background: ${trafficData.color};
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 10px ${trafficData.color};
      animation: trafficPulse 1s infinite;
    "></div>`,
    width: 20,
    height: 20
  });
}

// ✅ Mappls map initializes via SDK callback
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
    addRecenterButton();
  });

  map.on("dragstart", function () {
    isFollowing = false;
  });
}

// ✅ Recenter button
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
    transition: all 0.3s;
  `;
  btn.onmouseover = () => btn.style.transform = "scale(1.1)";
  btn.onmouseout = () => btn.style.transform = "scale(1)";
  btn.onclick = function () {
    isFollowing = true;
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

// ==========================================
// BEAUTIFUL POP-UP SYSTEM
// ==========================================

function showModernPopup(config) {
  const popup = document.getElementById("modernPopup");
  
  document.getElementById("popupIcon").textContent = config.icon || "✅";
  document.getElementById("popupTitle").textContent = config.title || "Success";
  document.getElementById("popupMessage").textContent = config.message || "";
  
  const detailsDiv = document.getElementById("popupDetails");
  if (config.details && Object.keys(config.details).length > 0) {
    detailsDiv.innerHTML = Object.entries(config.details)
      .map(([key, value]) => `
        <div>
          <span class="label">${key}</span>
          <span class="value">${value}</span>
        </div>
      `).join("");
    detailsDiv.style.display = "block";
  } else {
    detailsDiv.style.display = "none";
  }
  
  popup.style.display = "flex";
}

function closeModernPopup() {
  document.getElementById("modernPopup").style.display = "none";
}

// Toast Notification
function showToast(type, title, message = "") {
  const container = document.getElementById("notificationContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️"
  };
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ""}
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ✅ GPS location button
function getLocation() {
  const btn = event.target;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      document.getElementById("start").value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      map.setCenter({ lat: lat, lng: lng });
      map.setZoom(15);
      
      if (carMarker) {
        carMarker.remove();
        carMarker = null;
      }
      
      carMarker = new mappls.Marker({
        map: map,
        position: { lat: lat, lng: lng },
        html: '<div style="width:28px;height:28px;background:#1a73e8;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(26,115,232,0.6);display:flex;align-items:center;justify-content:center;"><i class="fas fa-location-arrow" style="color:white;font-size:14px;"></i></div>',
        width: 28,
        height: 28
      });
      
      btn.innerHTML = '📍';
      
      showToast("success", "📍 Location Found!", `Accuracy: ${accuracy.toFixed(0)}m`);
    },
    (err) => {
      btn.innerHTML = '📍';
      showToast("error", "❌ GPS Error", "Enable location permission");
    }
  );
}

// ✅ Remove route safely
function removeRoute() {
  if (routeLayer) {
    try { routeLayer.setMap(null); } catch(e) {
      try { routeLayer.remove(); } catch(e2) {}
    }
    routeLayer = null;
  }
}

// ✅ Find fastest route with traffic check
async function findRoute() {
  const startRaw = document.getElementById("start").value.trim();
  const destinationRaw = document.getElementById("destination").value.trim();
  const vehicle = document.getElementById("vehicle").value;
  
  if (!startRaw || !destinationRaw) {
    showToast("error", "❌ Missing Location", "Enter both start and destination");
    return;
  }

  const btn = document.getElementById("findRouteBtn");
  btn.classList.add("loading");
  btn.innerHTML = '<div class="spinner"></div> Finding Route...';

  const start = startRaw.toLowerCase().includes("nagpur") ? startRaw : `${startRaw}, Nagpur`;
  const destination = destinationRaw.toLowerCase().includes("nagpur") ? destinationRaw : `${destinationRaw}, Nagpur`;

  try {
    const res = await fetch(`${API_BASE}/api/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, destination }),
    });
    const data = await res.json();
    
    if (data.error) {
      showToast("error", "❌ Route Error", data.error);
      btn.classList.remove("loading");
      btn.innerHTML = '<i class="fas fa-route"></i> Find Fastest Route';
      return;
    }

    routeCoords = data.polyline.coordinates;

    removeRoute();

    // White border line
    new mappls.Polyline({
      map: map,
      path: routeCoords.map(([lng, lat]) => ({ lat, lng })),
      strokeColor: "#ffffff",
      strokeOpacity: 1,
      strokeWeight: 10
    });

    // Blue route line
    routeLayer = new mappls.Polyline({
      map: map,
      path: routeCoords.map(([lng, lat]) => ({ lat, lng })),
      strokeColor: "#1a73e8",
      strokeOpacity: 0.95,
      strokeWeight: 6
    });

    // Start marker
    const [startLng, startLat] = routeCoords[0];
    if (carMarker) carMarker.remove();
    carMarker = new mappls.Marker({
      map: map,
      position: { lat: startLat, lng: startLng },
      html: '<div style="width:28px;height:28px;background:#1a73e8;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(26,115,232,0.6);display:flex;align-items:center;justify-content:center;"><i class="fas fa-location-arrow" style="color:white;font-size:14px;"></i></div>',
      width: 28,
      height: 28
    });

    // Destination marker
    const [destLng, destLat] = routeCoords[routeCoords.length - 1];
    if (destinationMarker) destinationMarker.remove();
    destinationMarker = new mappls.Marker({
      map: map,
      position: { lat: destLat, lng: destLng },
      html: '<div style="text-align:center;"><i class="fas fa-map-marker-alt" style="color:#d32f2f;font-size:32px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));"></i></div>',
      width: 32,
      height: 40
    });

    // Fit bounds
    const lats = routeCoords.map(([lng, lat]) => lat);
    const lngs = routeCoords.map(([lng, lat]) => lng);
    map.fitBounds([
      { lat: Math.min(...lats), lng: Math.min(...lngs) },
      { lat: Math.max(...lats), lng: Math.max(...lngs) }
    ]);

    isFollowing = true;

    // Show route info
    document.getElementById("routeInfo").style.display = "grid";
    document.getElementById("routeDistance").textContent = data.distance_km.toFixed(1) + " km";
    document.getElementById("routeTime").textContent = data.duration_min + " min";
    document.getElementById("vehicleType").textContent = vehicle.toUpperCase();

    btn.classList.remove("loading");
    btn.innerHTML = '<i class="fas fa-route"></i> Find Fastest Route';

    // Show beautiful popup
    showModernPopup({
      icon: "🗺️",
      title: "Route Ready!",
      message: "Your fastest route has been calculated.",
      details: {
        "📏 Distance": data.distance_km.toFixed(1) + " km",
        "⏱️ Duration": data.duration_min + " minutes",
        "🚗 Vehicle": vehicle.toUpperCase()
      }
    });

    // ✅ CHECK TRAFFIC ON THIS ROUTE
    setTimeout(() => {
      checkTrafficOnRoute();
    }, 500);

  } catch (error) {
    showToast("error", "❌ Connection Error", "Failed to get route");
    btn.classList.remove("loading");
    btn.innerHTML = '<i class="fas fa-route"></i> Find Fastest Route';
  }
}

// ✅ Toggle tracking
function toggleTracking() {
  const btn = document.getElementById("startTrackingBtn");
  const badge = document.getElementById("trackingBadge");
  
  if (!isTracking) {
    startTracking();
    isTracking = true;
    btn.innerHTML = '<i class="fa-solid fa-pause"></i> Stop Tracking';
    btn.style.background = "linear-gradient(88deg, #ff4b4b 60%, #d32f2f 100%)";
    badge.style.display = "flex";
    showToast("success", "🔴 Tracking Started", "Live location is now active");
  } else {
    stopTracking();
    isTracking = false;
    btn.innerHTML = '<i class="fa-solid fa-play"></i> Start Tracking';
    btn.style.background = "var(--button-gradient)";
    badge.style.display = "none";
    showToast("info", "⏹️ Tracking Stopped", "Location tracking disabled");
  }
}

// ✅ Live GPS tracking
function startTracking() {
  if (!navigator.geolocation) {
    showToast("error", "❌ GPS Unavailable", "Geolocation not supported");
    return;
  }

  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;

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

      if (isFollowing) {
        map.setCenter({ lat, lng });
      }

      if (routeCoords.length > 0) {
        const newRoute = routeCoords.filter(([x, y]) => {
          const dist = Math.sqrt((x - lng) ** 2 + (y - lat) ** 2);
          return dist > 0.0005;
        });
        removeRoute();
        if (newRoute.length > 1) {
          new mappls.Polyline({
            map: map,
            path: newRoute.map(([lng, lat]) => ({ lat, lng })),
            strokeColor: "#ffffff",
            strokeOpacity: 1,
            strokeWeight: 10
          });
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
    (err) => showToast("error", "❌ Tracking Error", "Enable GPS permission"),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}

function stopTracking() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

// ==========================================
// SOS ALERT WITH ALARM & HIGHLIGHTING
// ==========================================

let sosAlarmSound = null;
let sosBlinkInterval = null;
let audioContext = null;

async function sendSOS() {
  const loc = document.getElementById("start").value.trim();
  if (!loc) {
    showToast("warning", "⚠️ Location Required", "Set your location first");
    return;
  }

  const btn = document.getElementById("sosBtn");

  // If SOS is already active, deactivate it
  if (sosActive) {
    deactivateSOS(btn);
    return;
  }

  sosActive = true;
  btn.classList.add("sos-alert");
  
  try {
    const res = await fetch(`${API_BASE}/api/sos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: loc }),
    });
    const data = await res.json();

    if (data.success) {
      // Trigger alarm sound
      triggerSOSAlarm();
      
      // Trigger visual highlighting
      triggerSOSHighlighting();

      showModernPopup({
        icon: "🚨",
        title: "🚨 SOS ALERT ACTIVATED!",
        message: "Emergency services have been notified of your location.\n\nClick SOS button again to deactivate.",
        details: {
          "📍 Location": loc,
          "🕒 Time": new Date().toLocaleTimeString(),
          "📞 Services": "Police, Ambulance, Fire",
          "⏱️ Status": "Response Dispatched"
        }
      });

      showToast("error", "🚨 SOS ACTIVATED", "Click SOS button to deactivate");
    }
  } catch (error) {
    console.error("SOS Error:", error);
    showToast("error", "❌ SOS Failed", "Could not send SOS alert");
    sosActive = false;
    btn.classList.remove("sos-alert");
  }

  // Auto-deactivate after 60 seconds if not manually deactivated
  setTimeout(() => {
    if (sosActive) {
      deactivateSOS(btn);
      showToast("info", "⏱️ SOS Auto-Deactivated", "60 second timeout reached");
    }
  }, 60000);
}

function triggerSOSAlarm() {
  try {
    // Initialize audio context if not exists
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // Create oscillator for siren sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    // Connect nodes
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure oscillator
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    
    // Configure gain
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    
    // Start oscillator
    oscillator.start(audioContext.currentTime);
    
    // Siren pattern: alternating frequency
    let isHigh = true;
    let pattern = 0;
    
    const sirenInterval = setInterval(() => {
      if (sosActive) {
        try {
          if (pattern % 2 === 0) {
            oscillator.frequency.setTargetAtTime(
              isHigh ? 1200 : 800, 
              audioContext.currentTime, 
              0.05
            );
            isHigh = !isHigh;
          }
          pattern++;
        } catch (e) {
          clearInterval(sirenInterval);
        }
      }
    }, 300);
    
    sosAlarmSound = {
      oscillator: oscillator,
      gainNode: gainNode,
      filter: filter,
      context: audioContext,
      interval: sirenInterval,
      startTime: audioContext.currentTime
    };

  } catch (error) {
    console.warn("Audio context error:", error);
    // Fallback: Use visual alert only
    showToast("warning", "⚠️ Audio Not Available", "Using visual alert only");
  }
}

function triggerSOSHighlighting() {
  // Add red blinking effect to body
  document.body.style.animation = "sosFlash 0.5s infinite";
  document.body.style.backgroundColor = "rgba(255, 0, 0, 0.1)";
  
  // Highlight header
  const header = document.querySelector('header');
  if (header) {
    header.style.boxShadow = '0 0 30px 5px rgba(255, 75, 75, 0.9)';
    header.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
  }
  
  // Highlight controls
  const controls = document.querySelector('.controls');
  if (controls) {
    controls.style.boxShadow = '0 0 30px 5px rgba(255, 75, 75, 0.9)';
    controls.style.borderColor = '#ff4b4b';
    controls.style.borderWidth = '3px';
  }
  
  // Highlight SOS button
  const sosBtn = document.getElementById('sosBtn');
  if (sosBtn) {
    sosBtn.style.boxShadow = '0 0 40px 8px rgba(255, 75, 75, 0.9)';
    sosBtn.style.borderColor = '#ff4b4b';
    sosBtn.style.borderWidth = '2px';
  }

  // Add pulsing red border to entire page
  document.documentElement.style.borderLeft = '6px solid #ff4b4b';
  document.documentElement.style.borderRight = '6px solid #ff4b4b';
  document.documentElement.style.borderTop = '6px solid #ff4b4b';
  document.documentElement.style.borderBottom = '6px solid #ff4b4b';
}

function deactivateSOS(btn) {
  sosActive = false;
  btn.classList.remove("sos-alert");
  
  // Stop alarm
  if (sosAlarmSound) {
    try {
      // Clear interval first
      if (sosAlarmSound.interval) {
        clearInterval(sosAlarmSound.interval);
      }
      
      // Stop oscillator
      if (sosAlarmSound.oscillator) {
        sosAlarmSound.oscillator.stop(sosAlarmSound.context.currentTime);
      }
      
      sosAlarmSound = null;
    } catch (error) {
      console.warn("Error stopping alarm:", error);
    }
  }
  
  // Remove visual effects with smooth transition
  document.body.style.animation = "none";
  document.body.style.backgroundColor = "";
  
  document.documentElement.style.borderLeft = "none";
  document.documentElement.style.borderRight = "none";
  document.documentElement.style.borderTop = "none";
  document.documentElement.style.borderBottom = "none";
  
  // Remove highlights from all elements
  const allElements = document.querySelectorAll('header, .controls, #sosBtn');
  allElements.forEach(el => {
    el.style.boxShadow = '';
    el.style.borderColor = '';
    el.style.borderWidth = '';
    el.style.backgroundColor = '';
  });

  showToast("info", "🔕 SOS Deactivated", "Alert system turned off");
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
    c.innerHTML += `
      <div class="contact-card" style="border-left:4px solid ${x.color}; cursor: pointer;" onclick="callEmergency('${x.number}', '${x.name}')">
        <h3>${x.icon} ${x.name}</h3>
        <p>${x.number}</p>
      </div>
    `;
  });
}

function callEmergency(number, name) {
  showModernPopup({
    icon: "📞",
    title: `Call ${name}`,
    message: `Dial ${number} to reach ${name}.`,
    details: {
      "📞 Number": number,
      "🏢 Service": name,
      "⏱️ Available": "24/7"
    }
  });
  showToast("info", `📞 ${name}`, `Number: ${number}`);
}

// Initialize on load
document.addEventListener("DOMContentLoaded", loadEmergencyContacts);

// Old backup popup (kept for compatibility)
function showPopup(txt) {
  const popup = document.getElementById("popup");
  document.getElementById("popup-text").innerText = txt;
  popup.style.display = "flex";
}

function closePopup() {
  document.getElementById("popup").style.display = "none";
}

