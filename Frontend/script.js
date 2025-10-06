let map;  // global map variable

function initMap() {
  // Default center (can be your city)
  const defaultLocation = { lat: 19.0760, lng: 72.8777 }; // Mumbai coords example

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultLocation,
    zoom: 12,
  });

  // Optional: marker at center
  new google.maps.Marker({
    position: defaultLocation,
    map: map,
    title: "Default location",
  });
}

function getLocation(){
  if(!navigator.geolocation){
    alert('Geolocation not supported.');
    return;
  }
  navigator.geolocation.getCurrentPosition((pos)=>{
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    document.getElementById('start').value = `${lat}, ${lng}`;

    if(window.map){
      const userLoc = {lat: lat, lng: lng};
      map.setCenter(userLoc);
      new google.maps.Marker({position: userLoc, map: map, title: "You are here"});
    }
  }, (err)=>{
    alert('Could not get location: ' + err.message);
  }, { enableHighAccuracy:true, timeout:10000 });
}

// Frontend behaviors: map init (optional), UI actions, AJAX calls to backend

const API_BASE = window.location.origin.replace(/:\d+$/,':5000'); 
// If backend runs on same host but port 5000. Adjust as needed.

function showPopup(text){
  document.getElementById('popup-text').innerText = text;
  document.getElementById('popup').style.display = 'flex';
}

function closePopup(){
  document.getElementById('popup').style.display = 'none';
}

// Load contacts from backend
async function loadContacts(){
  try{
    const res = await fetch(API_BASE + '/contacts');
    const data = await res.json();
    const list = document.getElementById('contacts-list');
    list.innerHTML = '';
    data.contacts.forEach(c=>{
      const d = document.createElement('div');
      d.textContent = `${c.name} — ${c.phone} (${c.relation})`;
      list.appendChild(d);
    });
  }catch(err){
    console.error(err);
    document.getElementById('contacts-list').innerText = 'Unable to load contacts.';
  }
}

// Geolocation helper
function getLocation(){
  if(!navigator.geolocation){
    alert('Geolocation not supported.');
    return;
  }
  navigator.geolocation.getCurrentPosition((pos)=>{
    const lat = pos.coords.latitude.toFixed(6);
    const lng = pos.coords.longitude.toFixed(6);
    document.getElementById('start').value = `${lat}, ${lng}`;
    // Optionally center map if client-side map is loaded
    if(window.map && window.map.setCenter){
      window.map.setCenter({lat: parseFloat(lat), lng: parseFloat(lng)});
    }
  }, (err)=>{
    alert('Could not get location: ' + err.message);
  }, { enableHighAccuracy:true, timeout:10000 });
}

// Find route -> call backend route endpoint
async function findRoute(){
  const pickup = document.getElementById('start').value.trim();
  const destination = document.getElementById('destination').value.trim();
  const vehicle = document.getElementById('vehicle').value;

  if(!pickup || !destination){
    alert('Enter pickup and destination.');
    return;
  }

  // disable button while processing
  const btn = document.querySelector('.btn');
  btn.disabled = true; btn.style.opacity = 0.7;

  try{
    const res = await fetch(API_BASE + '/route', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ pickup, destination, vehicle })
    });
    const data = await res.json();
    if(data.error){
      alert('Error: ' + data.error);
    } else {
      // Show summary & popup
      const summary = `Pickup: ${pickup}\nDestination: ${destination}\nDistance: ${data.distance}\nETA: ${data.duration}\nRoute score: ${data.score}`;
      document.getElementById('route-summary').innerText = `Distance: ${data.distance} • ETA: ${data.duration}`;
      document.getElementById('route-info').hidden = false;
      showPopup(summary);
      // Optionally render route polyline client-side if returned polyline present
      if(data.polyline) {
        // if you include Google Maps client, decode and draw polyline
        console.log('Polyline returned (encoded):', data.polyline);
      }
    }
  }catch(err){
    console.error(err);
    alert('Error contacting backend.');
  }finally{
    btn.disabled = false; btn.style.opacity = 1;
  }
}

// SOS: send to backend to notify contacts (simulation)
async function sendSOS(){
  const pickup = document.getElementById('start').value.trim();
  if(!pickup){
    alert('Please set your location (Pickup) first.');
    return;
  }
  try{
    const res = await fetch(API_BASE + '/sos', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ location: pickup, note: 'SOS: Need immediate help!' })
    });
    const data = await res.json();
    if(data.success){
      showPopup('SOS sent to emergency contacts (simulated).');
    } else {
      alert('SOS failed: ' + (data.error||'unknown'));
    }
  }catch(err){
    console.error(err);
    alert('SOS error.');
  }
}

// Startup tasks
window.addEventListener('DOMContentLoaded', ()=>{
  loadContacts();
});

/* =============================
   Emergency Contacts Interaction
   ============================= */

// Example emergency contact data
const emergencyContacts = [
  {
    name: "Police",
    number: "100",
    icon: "🚓",
    color: "#2979ff"
  },
  {
    name: "Ambulance",
    number: "108",
    icon: "🚑",
    color: "#43a047"
  },
  {
    name: "Fire Station",
    number: "101",
    icon: "🔥",
    color: "#d32f2f"
  },
  {
    name: "Women Helpline",
    number: "1091",
    icon: "👩‍🦰",
    color: "#ff4081"
  }
];

// Function to load contacts dynamically
function loadEmergencyContacts() {
  const container = document.getElementById("emergency-contacts");
  if (!container) return;

  container.innerHTML = "";
  emergencyContacts.forEach(contact => {
    const card = document.createElement("div");
    card.className = "contact-card";
    card.style.border = `1px solid ${contact.color}`;
    card.style.padding = "12px";
    card.style.borderRadius = "10px";
    card.style.background = "rgba(255,255,255,0.05)";
    card.style.textAlign = "center";
    card.style.marginBottom = "12px";

    card.innerHTML = `
      <i style="font-size:24px;">${contact.icon}</i>
      <h3>${contact.name}</h3>
      <p><strong>Number:</strong> ${contact.number}</p>
      <button class="btn" style="background:${contact.color}; margin-top:8px;" onclick="callNumber('${contact.number}')">📞 Call</button>
    `;

    container.appendChild(card);
  });
}

// Function to simulate calling
function callNumber(number) {
  window.location.href = `tel:${number}`;
  alert(`📞 Dialing ${number}...`);
}

// Run when page loads
document.addEventListener("DOMContentLoaded", loadEmergencyContacts);


