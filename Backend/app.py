from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

# -------------------------------
# ✅ FREE GEOCODER (NOMINATIM)
# -------------------------------
def geocode_location(query):
    # If lat,lng directly provided
    if "," in query:
        parts = query.split(",")
        if len(parts) >= 2:
            try:
                lat = float(parts[0].strip())
                lng = float(parts[1].strip())
                return lat, lng
            except:
                return None

    # Otherwise → Nominatim search
    url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json"
    try:
        res = requests.get(url, headers={"User-Agent": "EmergencyRouteApp"})
        data = res.json()

        if not data:
            return None

        return float(data[0]["lat"]), float(data[0]["lon"])
    except:
        return None


# -------------------------------
# ✅ FREE OSRM ROUTING
# -------------------------------
def get_osrm_route(lat1, lng1, lat2, lng2):
    url = (
        f"http://router.project-osrm.org/route/v1/driving/"
        f"{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson"
    )

    try:
        res = requests.get(url)
        data = res.json()

        if "routes" not in data or len(data["routes"]) == 0:
            return None

        route = data["routes"][0]

        return {
            "distance": round(route["distance"] / 1000, 2),
            "duration": round(route["duration"] / 60, 1),
            "geometry": route["geometry"]
        }
    except:
        return None


# -------------------------------
# ✅ MAIN ROUTE API (SAFE + DEBUG)
# -------------------------------
@app.route("/api/route", methods=["POST"])
def route_api():
    try:
        data = request.get_json()

        start = data.get("start")
        destination = data.get("destination")

        print("\n===== ROUTE REQUEST RECEIVED =====")
        print("Start input:", start)
        print("Destination input:", destination)
        print("==================================\n")

        if not start or not destination:
            return jsonify({"error": "Missing start or destination"}), 400

        # ✅ Geocode start + destination
        s_loc = geocode_location(start)
        d_loc = geocode_location(destination)

        print("Geocode START:", s_loc)
        print("Geocode DEST:", d_loc)

        if s_loc is None:
            return jsonify({"error": "Invalid START location"}), 400
        if d_loc is None:
            return jsonify({"error": "Invalid DESTINATION location"}), 400

        s_lat, s_lng = s_loc
        d_lat, d_lng = d_loc

        # ✅ Get OSRM route
        route = get_osrm_route(s_lat, s_lng, d_lat, d_lng)

        print("Route data:", route)

        if route is None:
            return jsonify({"error": "No route found"}), 404

        return jsonify({
            "start": start,
            "destination": destination,
            "distance_km": route["distance"],
            "duration_min": route["duration"],
            "polyline": route["geometry"]
        })

    except Exception as e:
        print("\n🔥 BACKEND CRASHED:", str(e))
        return jsonify({"error": str(e)}), 500


# -------------------------------
# ✅ SOS API
# -------------------------------
@app.route("/api/sos", methods=["POST"])
def sos_api():
    data = request.get_json()
    location = data.get("location")

    if not location:
        return jsonify({"error": "Location missing"}), 400

    print("\n🚨 SOS RECEIVED 🚨")
    print("Location:", location)
    print("================================\n")

    return jsonify({"success": True, "message": "SOS sent!"})


@app.route("/")
def home():
    return jsonify({"message": "Backend running on port 5000"})


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
