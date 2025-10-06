from flask import Flask, request, jsonify
import googlemaps
import os

app = Flask(__name__)

# Use your Google Maps API key
API_KEY = "AIzaSyAX2h2t5DSv4TwXmpMbUZEdMklqWK6EaGs"
gmaps = googlemaps.Client(key=API_KEY)

@app.route('/')
def home():
    return "Emergency Route Finder Backend is Running 🚑"

@app.route('/route', methods=['POST'])
def get_route():
    data = request.get_json()

    start = data.get('start')
    destination = data.get('destination')
    vehicle = data.get('vehicle', 'ambulance')

    if not start or not destination:
        return jsonify({'error': 'Missing start or destination'}), 400

    # Request route from Google Maps
    directions = gmaps.directions(start, destination, mode="driving")

    if not directions:
        return jsonify({'error': 'No route found'}), 404

    leg = directions[0]['legs'][0]
    distance = leg['distance']['text']
    duration = leg['duration']['text']

    # Simple AI-like adjustment (you can improve this later)
    ai_duration = f"{int(leg['duration']['value'] / 60 * 0.9)} mins"  # 10% faster

    return jsonify({
        'start': start,
        'destination': destination,
        'vehicle': vehicle,
        'distance': distance,
        'duration': duration,
        'ai_predicted_duration': ai_duration
    })

if __name__ == '__main__':
    app.run(debug=True)
