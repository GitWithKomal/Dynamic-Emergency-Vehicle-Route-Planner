# EmergencyRouteFinder
all codes for the project will be uploaded here 
this is for Html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Emergency Vehicle Route Planner</title>
    <link rel="stylesheet" href="style.css"> <!-- Linking external CSS -->
</head>
<body>
    <header>🚑 Emergency Vehicle Route Planner</header>

    <div class="container">
        <label for="start">Start Location:</label>
        <input type="text" id="start" placeholder="Enter starting point">

        <label for="destination">Destination:</label>
        <input type="text" id="destination" placeholder="Enter destination">

        <label for="vehicle">Vehicle Type:</label>
        <select id="vehicle">
            <option value="ambulance">Ambulance</option>
            <option value="firetruck">Fire Truck</option>
            <option value="police">Police Vehicle</option>
        </select>

        <button>Find Fastest Route</button>

        <div id="map">
            Map will be displayed here
        </div>
    </div>

    <footer>
        &copy; 2025 Emergency Planner | Powered by AI & GPS Data
    </footer>
</body>
</html>
<div id="map"></div>

<script>
  function initMap() {
    // Create map centered on India
    var indiaCenter = { lat: 20.5937, lng: 78.9629 };
    var map = new google.maps.Map(document.getElementById("map"), {
      zoom: 5,
      center: indiaCenter
    });
  }
</script>

<!-- Google Maps API script -->
<script async defer
    src="https://maps.googleapis.com/maps/api/js?key=AIzaSyAX2h2t5DSv4TwXmpMbUZEdMklqWK6EaGs&callback=initMap">
</script>
kj
