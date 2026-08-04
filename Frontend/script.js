
const API_BASE   = "http://127.0.0.1:5000";
const NAGPUR_LAT = 21.1458;
const NAGPUR_LNG = 79.0882;
const MAPPLS_KEY = "e4c70b528058ef82f6c4b85b546c30b1";

let map               = null;
let routeLayer        = null;
let carMarker         = null;
let destinationMarker = null;
let routeCoords       = [];
let watchId           = null;
let isFollowing       = true;
let isTracking        = false;
let sosActive         = false;
let sosAlarmSound     = null;
let audioContext      = null;
let sheetExpanded     = false;
let suggestDebounceTimer = null;
let activeSuggestField   = null;


let _mapplsToken = null;
let _tokenExpiry = 0;

async function getMapplsToken() {
  if (_mapplsToken && Date.now() < _tokenExpiry) return _mapplsToken;
  try {
    const res  = await fetch(
      `https://outpost.mappls.com/api/security/oauth/token?grant_type=client_credentials&client_id=${MAPPLS_KEY}&client_secret=${MAPPLS_KEY}`
    );
    const data = await res.json();
    _mapplsToken = data.access_token;
    _tokenExpiry  = Date.now() + (data.expires_in - 60) * 1000;
    return _mapplsToken;
  } catch { return MAPPLS_KEY; }
}


function initMap() {
  map = new mappls.Map("map", {
    center: { lat: NAGPUR_LAT, lng: NAGPUR_LNG },
    zoom: 13, search: false
  });

  let lockCount = 0;
  const lockInterval = setInterval(() => {
    if (lockCount < 10) { map.setCenter({ lat: NAGPUR_LAT, lng: NAGPUR_LNG }); map.setZoom(13); lockCount++; }
    else clearInterval(lockInterval);
  }, 300);

  map.on("load", () => {
    clearInterval(lockInterval);
    map.setCenter({ lat: NAGPUR_LAT, lng: NAGPUR_LNG });
    map.setZoom(13);
    addRecenterButton();
    updateMapStatus("READY", "success");
  });

  map.on("dragstart", () => { isFollowing = false; });

  map.on("zoom", () => {
    const z = map.getZoom ? Math.round(map.getZoom()) : 13;
    const el = document.getElementById("mapZoomDisplay");
    if (el) el.innerHTML = `<i class="fas fa-search-plus"></i> ZOOM: ${z}`;
  });
}

function updateMapStatus(text, state) {
  const badge = document.getElementById("mapLiveBadge");
  if (!badge) return;
  const colors = { success:"#00e676", active:"#00e5ff", warning:"#ff9100", danger:"#ff1744" };
  badge.textContent = `⬤ ${text}`;
  badge.style.color = colors[state] || colors.success;
}

function addRecenterButton() {
  const existing = document.getElementById("recenterBtn");
  if (existing) existing.remove();
  const btn = document.createElement("button");
  btn.id = "recenterBtn";
  btn.innerHTML = `<i class="fas fa-crosshairs"></i>`;
  btn.title = "Recenter";
  btn.style.cssText = `position:absolute;bottom:90px;right:12px;z-index:999;width:40px;height:40px;
    border-radius:50%;background:rgba(7,14,26,0.88);border:1px solid rgba(0,229,255,0.3);
    color:#00e5ff;font-size:15px;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;transition:all 0.2s;backdrop-filter:blur(8px);`;
  btn.onmouseover = () => btn.style.transform = "scale(1.1)";
  btn.onmouseout  = () => btn.style.transform = "scale(1)";
  btn.onclick = () => {
    isFollowing = true;
    if (carMarker) { const pos = carMarker.getPosition(); if (pos) { map.setCenter({lat:pos.lat,lng:pos.lng}); map.setZoom(15); } }
    else { map.setCenter({lat:NAGPUR_LAT,lng:NAGPUR_LNG}); map.setZoom(13); }
  };
  document.getElementById("map").appendChild(btn);
}


function updateClock() {
  const el = document.getElementById("liveClock");
  if (el) el.textContent = new Date().toLocaleTimeString("en-IN", {hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"});
}
setInterval(updateClock, 1000);


function selectVehicle(type, el) {
  document.querySelectorAll(".vehicle-card").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("vehicle").value = type;
}


function getLocation() {
  const btn = event.currentTarget;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude:lat, longitude:lng, accuracy } = pos.coords;
      document.getElementById("start").value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      map.setCenter({lat,lng}); map.setZoom(15);
      if (carMarker) { carMarker.remove(); carMarker = null; }
      carMarker = new mappls.Marker({map, position:{lat,lng}, html:markerHTML("origin"), width:30, height:30});
      btn.innerHTML = '<i class="fas fa-crosshairs"></i>'; btn.disabled = false;
      showToast("success","📍 Location Found",`Accuracy: ±${accuracy.toFixed(0)}m`);
      updateMapStatus("GPS LOCKED","active");
    },
    () => { btn.innerHTML='<i class="fas fa-crosshairs"></i>'; btn.disabled=false; showToast("error","GPS Error","Enable location permission"); },
    {enableHighAccuracy:true, timeout:10000}
  );
}


function markerHTML(type) {
  if (type === "origin") return `<div style="width:30px;height:30px;background:#0077b6;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(0,229,255,0.6);display:flex;align-items:center;justify-content:center;"><i class="fas fa-location-arrow" style="color:white;font-size:12px;"></i></div>`;
  return `<div style="text-align:center;"><i class="fas fa-map-marker-alt" style="color:#ff1744;font-size:34px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));"></i></div>`;
}


async function handleAutosuggest(fieldId) {
  const input = document.getElementById(fieldId);
  const list  = document.getElementById(`${fieldId}-suggestions`);
  if (!input || !list) return;
  const query = input.value.trim();
  clearTimeout(suggestDebounceTimer);
  if (query.length < 2) { list.classList.remove("active"); list.innerHTML = ""; return; }

  suggestDebounceTimer = setTimeout(async () => {
    try {
      const token = await getMapplsToken();
      const res   = await fetch(`https://atlas.mappls.com/api/places/search/json?query=${encodeURIComponent(query+" Nagpur")}&region=IND&tokenizeAddress=true`,
        {headers:{Authorization:`Bearer ${token}`}});
      const data  = await res.json();
      const results = data.suggestedLocations || [];

      if (!results.length) {
        list.innerHTML = `<li onclick="selectSuggestion('${fieldId}','${query}, Nagpur',0,0)"><span class="suggest-icon">🔍</span><span class="suggest-text"><span class="suggest-main">${query}, Nagpur</span><span class="suggest-sub">Search this location</span></span></li>`;
        list.classList.add("active"); return;
      }

      list.innerHTML = results.slice(0,7).map((r,i) => {
        const name = (r.placeName||"Unknown").replace(/[`"<>]/g,"'");
        const addr = (r.placeAddress||"").replace(/[`"<>]/g,"'");
        const lat  = r.latitude||0; const lng = r.longitude||0;
        return `<li onclick="selectSuggestion('${fieldId}','${name}',${lat},${lng})" onmouseover="highlightSuggestion('${fieldId}',${i})"><span class="suggest-icon">📍</span><span class="suggest-text"><span class="suggest-main">${name}</span><span class="suggest-sub">${addr}</span></span></li>`;
      }).join("");
      list.classList.add("active"); activeSuggestField = fieldId;
    } catch(err) {
      list.innerHTML = `<li onclick="selectSuggestion('${fieldId}','${query}, Nagpur',0,0)"><span class="suggest-icon">🔍</span><span class="suggest-text"><span class="suggest-main">${query}, Nagpur</span><span class="suggest-sub">Search this location</span></span></li>`;
      list.classList.add("active");
    }
  }, 280);
}

function selectSuggestion(fieldId, name, lat, lng) {
  const input = document.getElementById(fieldId);
  const list  = document.getElementById(`${fieldId}-suggestions`);
  if (input) input.value = name;
  if (list)  list.classList.remove("active");
  activeSuggestField = null;
  if (map && lat && lng) { map.setCenter({lat:parseFloat(lat),lng:parseFloat(lng)}); map.setZoom(15); }
}

function highlightSuggestion(fieldId, index) {
  document.querySelectorAll(`#${fieldId}-suggestions li`).forEach((li,i) => li.classList.toggle("highlighted", i===index));
}

function handleSuggestKey(e, fieldId) {
  const list  = document.getElementById(`${fieldId}-suggestions`);
  const items = list?.querySelectorAll("li");
  if (!items||!items.length) return;
  const current = [...items].findIndex(li => li.classList.contains("highlighted"));
  if (e.key==="ArrowDown")  { e.preventDefault(); const next=current<items.length-1?current+1:0; items.forEach((li,i)=>li.classList.toggle("highlighted",i===next)); items[next].scrollIntoView({block:"nearest"}); }
  else if (e.key==="ArrowUp")   { e.preventDefault(); const prev=current>0?current-1:items.length-1; items.forEach((li,i)=>li.classList.toggle("highlighted",i===prev)); items[prev].scrollIntoView({block:"nearest"}); }
  else if (e.key==="Enter"&&current!==-1) { e.preventDefault(); items[current].click(); }
  else if (e.key==="Escape") { list.classList.remove("active"); activeSuggestField=null; }
}

document.addEventListener("click", (e) => {
  ["start","destination","sheet-start","sheet-destination"].forEach(id => {
    const wrapper = document.getElementById(id)?.closest(".autocomplete-wrapper");
    const list    = document.getElementById(`${id}-suggestions`);
    if (list&&wrapper&&!wrapper.contains(e.target)) list.classList.remove("active");
  });
});


async function handleAutosuggestSheet(sheetInputId, mainInputId) {
  const sheetVal = document.getElementById(sheetInputId)?.value||"";
  const mi = document.getElementById(mainInputId);
  if (mi) mi.value = sheetVal;
  if (mainInputId==="start") { const p=document.getElementById("peekStart"); if(p){p.textContent=sheetVal||"Where from?";p.classList.toggle("has-value",!!sheetVal);} }
  else { const p=document.getElementById("peekDest"); if(p){p.textContent=sheetVal||"Where to?";p.classList.toggle("has-value",!!sheetVal);} }
  await handleAutosuggest(sheetInputId);
}

function selectSuggestionSheet(fieldId, name, lat, lng) {
  selectSuggestion(fieldId, name, lat, lng);
  if (fieldId==="sheet-start") { const m=document.getElementById("start"); if(m)m.value=name; const p=document.getElementById("peekStart"); if(p){p.textContent=name;p.classList.add("has-value");} }
  else { const m=document.getElementById("destination"); if(m)m.value=name; const p=document.getElementById("peekDest"); if(p){p.textContent=name;p.classList.add("has-value");} }
}

function getLocationSheet() {
  const btn = event.currentTarget;
  btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; btn.disabled=true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const {latitude:lat,longitude:lng,accuracy}=pos.coords;
      const val=`${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const si=document.getElementById("sheet-start"); const mi=document.getElementById("start");
      if(si)si.value=val; if(mi)mi.value=val;
      const peek=document.getElementById("peekStart"); if(peek){peek.textContent=val;peek.classList.add("has-value");}
      map.setCenter({lat,lng}); map.setZoom(15);
      if(carMarker){carMarker.remove();carMarker=null;}
      carMarker=new mappls.Marker({map,position:{lat,lng},html:markerHTML("origin"),width:30,height:30});
      btn.innerHTML='<i class="fas fa-crosshairs"></i>'; btn.disabled=false;
      showToast("success","📍 Location Found",`Accuracy: ±${accuracy.toFixed(0)}m`);
    },
    () => { btn.innerHTML='<i class="fas fa-crosshairs"></i>'; btn.disabled=false; showToast("error","GPS Error","Enable location permission"); },
    {enableHighAccuracy:true, timeout:10000}
  );
}

function findRouteFromSheet() {
  const ss=document.getElementById("sheet-start")?.value.trim();
  const sd=document.getElementById("sheet-destination")?.value.trim();
  if(ss) document.getElementById("start").value=ss;
  if(sd) document.getElementById("destination").value=sd;
  collapseSheet();
  findRoute();
}

function updateSheetRouteInfo(distance, duration, vehicle) {
  const info=document.getElementById("sheetRouteInfo"); if(!info)return;
  document.getElementById("sheetDistance").textContent=distance;
  document.getElementById("sheetTime").textContent=duration;
  document.getElementById("sheetVehicle").textContent=vehicle;
  info.style.display="block";
}


function expandSheet() {
  const s=document.getElementById("bottomSheet"); const o=document.getElementById("sheetOverlay");
  if(s)s.classList.add("expanded"); if(o)o.classList.add("active"); sheetExpanded=true;
}

function collapseSheet() {
  const s=document.getElementById("bottomSheet"); const o=document.getElementById("sheetOverlay");
  if(s)s.classList.remove("expanded"); if(o)o.classList.remove("active"); sheetExpanded=false;
  ["sheet-start","sheet-destination"].forEach(id => document.getElementById(`${id}-suggestions`)?.classList.remove("active"));
}


function removeRoute() {
  if(routeLayer){ try{routeLayer.setMap(null);}catch(e){try{routeLayer.remove();}catch(e2){}} routeLayer=null; }
}

async function findRoute() {
  const startRaw = document.getElementById("start").value.trim();
  const destRaw  = document.getElementById("destination").value.trim();
  const vehicle  = document.getElementById("vehicle").value;
  if(!startRaw||!destRaw){ showToast("error","Missing Fields","Enter both start and destination"); return; }

  const btn=document.getElementById("findRouteBtn");
  btn.classList.add("loading"); btn.innerHTML='<div class="spinner"></div> Calculating...';

  const start       = startRaw.toLowerCase().includes("nagpur")?startRaw:`${startRaw}, Nagpur`;
  const destination = destRaw.toLowerCase().includes("nagpur")?destRaw:`${destRaw}, Nagpur`;

  try {
    const res  = await fetch(`${API_BASE}/api/route`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({start,destination})});
    const data = await res.json();
    if(data.error){ showToast("error","Route Error",data.error); resetRouteBtn(btn); return; }

    routeCoords=data.polyline.coordinates; removeRoute();
    new mappls.Polyline({map, path:routeCoords.map(([lng,lat])=>({lat,lng})), strokeColor:"#ffffff", strokeOpacity:0.8, strokeWeight:10});
    routeLayer=new mappls.Polyline({map, path:routeCoords.map(([lng,lat])=>({lat,lng})), strokeColor:"#00b8d4", strokeOpacity:1, strokeWeight:6});

    const [startLng,startLat]=routeCoords[0];
    if(carMarker)carMarker.remove();
    carMarker=new mappls.Marker({map,position:{lat:startLat,lng:startLng},html:markerHTML("origin"),width:30,height:30});

    const [destLng,destLat]=routeCoords[routeCoords.length-1];
    if(destinationMarker)destinationMarker.remove();
    destinationMarker=new mappls.Marker({map,position:{lat:destLat,lng:destLng},html:markerHTML("dest"),width:34,height:44});

    const lats=routeCoords.map(([,lat])=>lat); const lngs=routeCoords.map(([lng])=>lng);
    map.fitBounds([{lat:Math.min(...lats),lng:Math.min(...lngs)},{lat:Math.max(...lats),lng:Math.max(...lngs)}]);
    isFollowing=true;

    const distText=data.distance_km.toFixed(1)+" km";
    const etaText=data.duration_min+" min";
    const vehText=vehicle.toUpperCase();

    document.getElementById("routeInfo").style.display="flex";
    document.getElementById("routeDistance").textContent=distText;
    document.getElementById("routeTime").textContent=etaText;
    document.getElementById("vehicleType").textContent=vehText;
    updateSheetRouteInfo(distText,etaText,vehText);

    resetRouteBtn(btn);
    updateMapStatus("ROUTE ACTIVE","active");
    enterFullscreenMap(distText,etaText,vehText);

    showModernPopup({icon:"🗺️",title:"ROUTE CALCULATED",message:"Fastest emergency route is ready. Proceed with caution.",details:{"📏 Distance":distText,"⏱️ ETA":etaText,"🚗 Unit":vehText}});

    setTimeout(()=>checkTrafficOnRoute(distText,etaText,vehText), 1500);
  } catch(error) {
    showToast("error","Connection Error","Could not reach route server");
    resetRouteBtn(btn);
  }
}

function resetRouteBtn(btn) {
  btn.classList.remove("loading");
  btn.innerHTML='<i class="fas fa-route"></i><span>Find Fastest Route</span>';
}


function enterFullscreenMap(distance, duration, vehicle) {
  const navbar=document.getElementById("mainNavbar"); const controls=document.getElementById("controlsPanel"); const mapSection=document.getElementById("mapview");
  if(navbar)navbar.classList.add("hidden"); if(controls)controls.classList.add("hidden");
  setTimeout(()=>{
    mapSection.classList.add("fullscreen");
    const backBtn=document.getElementById("mapBackBtn"); if(backBtn)backBtn.classList.add("visible");
    const chip=document.getElementById("mapRouteChip");
    if(chip){ document.getElementById("chipDistance").textContent=distance; document.getElementById("chipDuration").textContent=duration; document.getElementById("chipVehicle").textContent=vehicle; chip.classList.add("visible"); }
    setTimeout(()=>{ if(map&&map.resize)map.resize(); },650);
  },300);
}

function exitFullscreenMap() {
  document.getElementById("mapBackBtn")?.classList.remove("visible");
  document.getElementById("mapRouteChip")?.classList.remove("visible");
  setTimeout(()=>{
    document.getElementById("mapview")?.classList.remove("fullscreen");
    document.getElementById("mainNavbar")?.classList.remove("hidden");
    document.getElementById("controlsPanel")?.classList.remove("hidden");
    setTimeout(()=>{ if(map&&map.resize)map.resize(); },650);
  },200);
}


function toggleTracking() {
  const btn=document.getElementById("startTrackingBtn");
  const badge=document.getElementById("trackingBadge");
  const sheetBadge=document.getElementById("sheetTrackingBadge");
  if(!isTracking){
    startTracking(); isTracking=true;
    if(btn){btn.innerHTML='<i class="fas fa-satellite-dish"></i><span>Stop</span>';btn.style.background="linear-gradient(135deg,#ff1744,#b71c1c)";btn.style.borderColor="transparent";}
    if(badge)badge.style.display="flex"; if(sheetBadge)sheetBadge.style.display="flex";
    updateMapStatus("TRACKING","active"); showToast("success","Tracking Started","Live GPS is now active");
  } else {
    stopTracking(); isTracking=false;
    if(btn){btn.innerHTML='<i class="fas fa-satellite-dish"></i><span>Track</span>';btn.style.background="";btn.style.borderColor="";}
    if(badge)badge.style.display="none"; if(sheetBadge)sheetBadge.style.display="none";
    updateMapStatus("READY","success"); showToast("info","Tracking Stopped","GPS tracking disabled");
  }
}

function startTracking() {
  if(!navigator.geolocation){showToast("error","GPS Unavailable","Geolocation not supported");return;}
  if(watchId)navigator.geolocation.clearWatch(watchId);
  watchId=navigator.geolocation.watchPosition(
    (pos)=>{
      const {latitude:lat,longitude:lng}=pos.coords;
      const val=`${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      const c=document.getElementById("trackingCoords"); const sc=document.getElementById("sheetTrackingCoords");
      if(c)c.textContent=val; if(sc)sc.textContent=val;
      if(!carMarker){carMarker=new mappls.Marker({map,position:{lat,lng},html:markerHTML("origin"),width:30,height:30});}
      else carMarker.setPosition({lat,lng});
      if(isFollowing)map.setCenter({lat,lng});
      if(routeCoords.length>0){
        const newRoute=routeCoords.filter(([x,y])=>Math.sqrt((x-lng)**2+(y-lat)**2)>0.0005);
        removeRoute();
        if(newRoute.length>1){
          new mappls.Polyline({map,path:newRoute.map(([lng,lat])=>({lat,lng})),strokeColor:"#ffffff",strokeOpacity:0.8,strokeWeight:10});
          routeLayer=new mappls.Polyline({map,path:newRoute.map(([lng,lat])=>({lat,lng})),strokeColor:"#00b8d4",strokeOpacity:1,strokeWeight:6});
        }
      }
    },
    ()=>showToast("error","Tracking Error","Enable GPS permission"),
    {enableHighAccuracy:true,maximumAge:0,timeout:10000}
  );
}

function stopTracking() { if(watchId){navigator.geolocation.clearWatch(watchId);watchId=null;} }


const congestionLevels = {
  low:    {color:"#00e676",message:"Route is clear — no congestion detected.",   icon:"🟢"},
  medium: {color:"#ff9100",message:"Moderate traffic detected on route.",         icon:"🟡"},
  high:   {color:"#ff5722",message:"Heavy traffic — proceed with caution.",       icon:"🔴"},
  severe: {color:"#ff1744",message:"Severe congestion — consider alternate route.",icon:"⛔"}
};

const trafficSpots = [
  {lat:21.15,lng:79.08,level:"medium",description:"Traffic light queue"},
  {lat:21.16,lng:79.09,level:"high",  description:"Heavy vehicle movement"},
  {lat:21.14,lng:79.10,level:"low",   description:"Clear road ahead"}
];

function checkTrafficOnRoute(distance, eta, unit) {
  if(!routeCoords.length) return;
  const warnings=[];
  routeCoords.forEach((coord,idx)=>{
    const [lng,lat]=coord;
    trafficSpots.forEach(spot=>{
      const dist=Math.sqrt((lat-spot.lat)**2+(lng-spot.lng)**2);
      if(dist<0.02) warnings.push({...spot,percentage:Math.round(((idx+1)/routeCoords.length)*100)});
    });
  });
  const lvlMap={low:1,medium:2,high:3,severe:4};
  const level=warnings.length ? warnings.reduce((p,c)=>lvlMap[c.level]>lvlMap[p.level]?c:p).level : "low";
  const info=congestionLevels[level];
  const popup=document.getElementById("trafficPopup"); if(!popup)return;
  popup.className=`traffic-popup ${level}`;
  document.getElementById("trafficIcon").textContent=info.icon;
  document.getElementById("trafficTitle").textContent="TRAFFIC ALERT";
  document.getElementById("trafficMsg").textContent=info.message;
  document.getElementById("tStatDistance").textContent=distance||"--";
  document.getElementById("tStatETA").textContent=eta||"--";
  document.getElementById("tStatUnit").textContent=unit||"--";
  popup.classList.add("active");
  clearTimeout(window._trafficTimer);
  window._trafficTimer=setTimeout(closeTrafficPopup,6200);
  if(warnings.length){
    const worst=warnings.reduce((p,c)=>lvlMap[c.level]>lvlMap[p.level]?c:p);
    new mappls.Marker({map,position:{lat:worst.lat,lng:worst.lng},html:`<div style="width:18px;height:18px;background:${info.color};border-radius:50%;border:2px solid white;box-shadow:0 0 10px ${info.color};"></div>`,width:18,height:18});
  }
}

function closeTrafficPopup() { document.getElementById("trafficPopup")?.classList.remove("active"); clearTimeout(window._trafficTimer); }


async function sendSOS() {
  const loc=document.getElementById("start").value.trim();
  if(!loc){showToast("warning","Location Required","Set your start location first");return;}
  const btn=document.getElementById("sosBtn");
  if(sosActive){deactivateSOS(btn);return;}
  sosActive=true; btn.classList.add("sos-alert"); document.body.classList.add("sos-active");

  let sosLat=NAGPUR_LAT,sosLng=NAGPUR_LNG;
  if(loc.includes(",")){ const parts=loc.split(","); sosLat=parseFloat(parts[0])||NAGPUR_LAT; sosLng=parseFloat(parts[1])||NAGPUR_LNG; }
  else if(carMarker){ const pos=carMarker.getPosition(); if(pos){sosLat=pos.lat;sosLng=pos.lng;} }

  try {
    const res=await fetch(`${API_BASE}/api/sos`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:loc})});
    const data=await res.json();
    if(data.success){
      triggerSOSAlarm();
      showModernPopup({icon:"🚨",title:"SOS ACTIVATED",message:"Emergency services alerted. Nearby hospitals are loading.",details:{"📍 Location":loc,"🕒 Time":new Date().toLocaleTimeString(),"📞 Services":"Police · Ambulance · Fire","⏱️ Status":"Response Dispatched"}});
      showToast("error","🚨 SOS ACTIVATED","Tap SOS again to deactivate");
      updateMapStatus("SOS ACTIVE","danger");
      setTimeout(()=>fetchNearbyHospitals(sosLat,sosLng),900);
    }
  } catch(error) {
    triggerSOSAlarm();
    showToast("warning","🚨 SOS — Server Offline","Showing nearby hospitals");
    updateMapStatus("SOS ACTIVE","danger");
    setTimeout(()=>fetchNearbyHospitals(sosLat,sosLng),400);
  }
  setTimeout(()=>{ if(sosActive){deactivateSOS(btn);showToast("info","SOS Auto-Deactivated","60 second timeout reached");} },60000);
}

function deactivateSOS(btn) {
  sosActive=false; btn.classList.remove("sos-alert"); document.body.classList.remove("sos-active");
  if(sosAlarmSound){ try{ if(sosAlarmSound.interval)clearInterval(sosAlarmSound.interval); if(sosAlarmSound.oscillator)sosAlarmSound.oscillator.stop(); sosAlarmSound=null; }catch(e){} }
  updateMapStatus("READY","success"); showToast("info","SOS Deactivated","Alert system turned off");
}

function triggerSOSAlarm() {
  try {
    if(!audioContext)audioContext=new(window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==="suspended")audioContext.resume();
    const osc=audioContext.createOscillator(),gain=audioContext.createGain(),filter=audioContext.createBiquadFilter();
    osc.connect(filter);filter.connect(gain);gain.connect(audioContext.destination);
    osc.type="sine"; osc.frequency.setValueAtTime(900,audioContext.currentTime); gain.gain.setValueAtTime(0.18,audioContext.currentTime); osc.start();
    let isHigh=true;
    const interval=setInterval(()=>{ if(!sosActive){clearInterval(interval);return;} try{osc.frequency.setTargetAtTime(isHigh?1200:800,audioContext.currentTime,0.05);isHigh=!isHigh;}catch(e){clearInterval(interval);} },350);
    sosAlarmSound={oscillator:osc,gainNode:gain,interval};
  } catch(e){console.warn("Audio error:",e);}
}


async function fetchNearbyHospitals(lat, lng) {
  const modal=document.getElementById("hospitalModal"); const list=document.getElementById("hospitalList");
  if(!modal||!list)return;
  modal.classList.add("active");
  list.innerHTML=`<div class="hospital-loading"><div class="hospital-spinner"></div><span>Scanning nearby hospitals...</span></div>`;

  try {
    const token=await getMapplsToken();
    const res=await fetch(`https://atlas.mappls.com/api/places/nearby/json?keywords=hospital&refLocation=${lat},${lng}&radius=5000&sortBy=dist&region=IND`,
      {headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"}});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    const places=data.suggestedLocations||data.results||[];
    if(!places.length)throw new Error("No results");

    list.innerHTML=places.slice(0,8).map(h=>{
      const name=h.placeName||h.name||"Hospital";
      const addr=h.placeAddress||h.address||"Nagpur";
      const dist=h.distance?(h.distance>=1000?(h.distance/1000).toFixed(1)+" km":Math.round(h.distance)+" m"):"--";
      const dLat=h.latitude||lat; const dLng=h.longitude||lng;
      const safe=name.replace(/'/g,"\\'");
      return `<div class="hospital-card"><div class="hospital-card-icon">🏥</div><div class="hospital-card-info"><div class="hospital-card-name" title="${name}">${name}</div><div class="hospital-card-address" title="${addr}">${addr}</div></div><div class="hospital-card-distance">${dist}</div><button class="hosp-route-btn" onclick="routeToHospital('${safe}',${dLat},${dLng})">Route</button></div>`;
    }).join("");
  } catch(err) {
    console.warn("Hospital API failed, using fallback:", err);
    showFallbackHospitals(list,lat,lng);
  }
}

function showFallbackHospitals(list, lat, lng) {
  const hospitals=[
    {name:"AIIMS Nagpur",             addr:"Mihan, Nagpur",             lat:21.0778,lng:79.0538},
    {name:"GMCH Nagpur",              addr:"Medical Square, Nagpur",    lat:21.1502,lng:79.0849},
    {name:"Orange City Hospital",     addr:"Khamla Road, Nagpur",       lat:21.1314,lng:79.0576},
    {name:"Alexis Multispeciality",   addr:"Dairy Farm, Nagpur",        lat:21.1567,lng:79.0412},
    {name:"Wockhardt Hospital",       addr:"Ramdaspeth, Nagpur",        lat:21.1423,lng:79.0781},
    {name:"Care Hospital",            addr:"Dhantoli, Nagpur",          lat:21.1388,lng:79.0892},
    {name:"NKP Salve Medical College",addr:"Digdoh Hills, Nagpur",      lat:21.1089,lng:79.0634},
    {name:"Lata Mangeshkar Hospital", addr:"Digdoh, Nagpur",            lat:21.1102,lng:79.0589},
  ];
  hospitals.sort((a,b)=>{
    const dA=Math.sqrt(Math.pow((lat-a.lat)*111,2)+Math.pow((lng-a.lng)*111,2));
    const dB=Math.sqrt(Math.pow((lat-b.lat)*111,2)+Math.pow((lng-b.lng)*111,2));
    return dA-dB;
  });
  list.innerHTML=hospitals.slice(0,5).map(h=>{
    const distKm=Math.sqrt(Math.pow((lat-h.lat)*111,2)+Math.pow((lng-h.lng)*111,2)).toFixed(1);
    const safe=h.name.replace(/'/g,"\\'");
    return `<div class="hospital-card"><div class="hospital-card-icon">🏥</div><div class="hospital-card-info"><div class="hospital-card-name">${h.name}</div><div class="hospital-card-address">${h.addr}</div></div><div class="hospital-card-distance">~${distKm} km</div><button class="hosp-route-btn" onclick="routeToHospital('${safe}',${h.lat},${h.lng})">Route</button></div>`;
  }).join("");
}

function closeHospitalModal() { document.getElementById("hospitalModal")?.classList.remove("active"); }

function routeToHospital(name,lat,lng) {
  closeHospitalModal();
  document.getElementById("destination").value=name;
  showToast("info","🏥 Routing to hospital",name);
  findRoute();
}


const emergencyContacts=[
  {name:"Police",        number:"100",  icon:"🚓",color:"#2196f3"},
  {name:"Ambulance",     number:"108",  icon:"🚑",color:"#4caf50"},
  {name:"Fire Station",  number:"101",  icon:"🔥",color:"#ff5722"},
  {name:"Women Helpline",number:"1091", icon:"👩",color:"#e91e63"},
];

function loadEmergencyContacts() {
  const container=document.getElementById("emergency-contacts"); if(!container)return;
  container.innerHTML=emergencyContacts.map(x=>`
    <div class="contact-card" style="border-left:3px solid ${x.color};" onclick="callEmergency('${x.number}','${x.name}')">
      <div class="contact-icon-wrap" style="background:${x.color}22;border-color:${x.color}44;"><span style="font-size:20px;">${x.icon}</span></div>
      <div class="contact-info"><div class="contact-name">${x.name}</div><div class="contact-number">${x.number}</div></div>
      <i class="fas fa-phone-alt contact-call-icon"></i>
    </div>`).join("");
}

function callEmergency(number,name) {
  showModernPopup({icon:"📞",title:`CALL ${name.toUpperCase()}`,message:`Dial ${number} immediately to reach ${name} emergency services.`,details:{"📞 Number":number,"🏢 Service":name,"⏱️ Available":"24/7 Emergency"}});
  showToast("info",`📞 ${name}`,`Dial: ${number}`);
}


function showToast(type,title,message="") {
  const container=document.getElementById("notificationContainer"); if(!container)return;
  const toast=document.createElement("div"); toast.className=`toast ${type}`;
  const icons={success:"✅",error:"🚨",warning:"⚠️",info:"ℹ️"};
  toast.innerHTML=`<div class="toast-icon">${icons[type]||"ℹ️"}</div><div class="toast-content"><div class="toast-title">${title}</div>${message?`<div class="toast-message">${message}</div>`:""}</div>`;
  container.appendChild(toast);
  setTimeout(()=>{ toast.classList.add("removing"); setTimeout(()=>toast.remove(),380); },3200);
}


function showModernPopup(config) {
  document.getElementById("popupIcon").textContent=config.icon||"✅";
  document.getElementById("popupTitle").textContent=config.title||"Notice";
  document.getElementById("popupMessage").textContent=config.message||"";
  const d=document.getElementById("popupDetails");
  if(config.details&&Object.keys(config.details).length){
    d.innerHTML=Object.entries(config.details).map(([k,v])=>`<div><span class="label">${k}</span><span class="value">${v}</span></div>`).join("");
    d.style.display="block";
  } else d.style.display="none";
  document.getElementById("modernPopup").style.display="flex";
}

function closeModernPopup() { document.getElementById("modernPopup").style.display="none"; }
function showPopup(txt) { document.getElementById("popup-text").innerText=txt; document.getElementById("popup").style.display="flex"; }
function closePopup() { document.getElementById("popup").style.display="none"; }


function updateActiveNav() {
  const sections=["home","mapview","contacts","about"]; const hrefs=["#home","#mapview","#contacts","#about"]; let current="home";
  sections.forEach(id=>{ const el=document.getElementById(id); if(el&&window.scrollY>=el.offsetTop-100)current=id; });
  document.querySelectorAll(".nav-link").forEach((link,i)=>link.classList.toggle("active",hrefs[i]===`#${current}`));
}
window.addEventListener("scroll",updateActiveNav,{passive:true});


document.addEventListener("DOMContentLoaded", () => {
  loadEmergencyContacts();
  updateClock();

  const s=document.getElementById("bottomSheet");
  const handleArea=document.getElementById("sheetHandleArea");
  if(!s||!handleArea)return;

  let dragStartY=0, dragStartTY=0, dragging=false;

  function getCurrentTY() {
    const matrix=new DOMMatrix(window.getComputedStyle(s).transform);
    return matrix.m42;
  }

  handleArea.addEventListener("touchstart",(e)=>{
    dragStartY=e.touches[0].clientY; dragStartTY=getCurrentTY(); dragging=true; s.style.transition="none";
  },{passive:true});

  handleArea.addEventListener("touchmove",(e)=>{
    if(!dragging)return;
    const delta=e.touches[0].clientY-dragStartY;
    const newY=Math.max(0,dragStartTY+delta);
    s.style.transform=`translateY(${newY}px)`;
  },{passive:true});

  handleArea.addEventListener("touchend",(e)=>{
    dragging=false; s.style.transition=""; s.style.transform="";
    const delta=e.changedTouches[0].clientY-dragStartY;
    if(sheetExpanded){ delta>80?collapseSheet():expandSheet(); }
    else { delta<-60?expandSheet():collapseSheet(); }
  });

  handleArea.addEventListener("click",()=>{ sheetExpanded?collapseSheet():expandSheet(); });
});