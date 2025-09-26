let map;
let directionsService;
let directionsRenderer;

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 21.1458, lng: 79.0882 }, // Nagpur
        zoom: 12,
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);
}

function showMessage() {
    const pickup = document.getElementById("start").value;
    const destination = document.getElementById("destination").value;

    if (!pickup || !destination) {
        alert("Please enter both Pickup and Destination!");
        return;
    }

    document.getElementById("popup-text").innerText =
        `Pickup: ${pickup}\nDestination: ${destination}\nHere is the shortest path you want!`;

    document.getElementById("popup").style.display = "flex";

    // Draw route on map
    directionsService.route(
        {
            origin: pickup,
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING
        },
        (result, status) => {
            if (status === "OK") {
                directionsRenderer.setDirections(result);
            } else {
                alert("Could not find route: " + status);
            }
        }
    );
}

function closePopup() {
    document.getElementById("popup").style.display = "none";
}


