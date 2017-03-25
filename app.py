import cPickle as pickle

from datetime import datetime
from eventlet import monkey_patch
from eventlet.greenthread import spawn, sleep
from flask import Flask, json, jsonify, render_template
from flask_socketio import SocketIO, emit

from API_KEYS import mapbox_key
from static import Edge, PrevStops, Segment, Stop, StopGraph, StopID  # noqa: F401

import feed

monkey_patch()

JSON_DIR = "map_files/"
PICKLE_DIR = ".cache/"

app = Flask(__name__)
socketio = SocketIO(app)
feed_event = None

with open(PICKLE_DIR + "graph.pkl", "rb") as graph_f, \
        open(PICKLE_DIR + "prev_stops.pkl", "rb") as prev_stops_f, \
        open(JSON_DIR + "shapes.json", "r") as shapes_f, \
        open(JSON_DIR + "stops.json", "r") as stops_f, \
        open(JSON_DIR + "routes.json", "r") as routes_f, \
        open(JSON_DIR + "colors.json", "r") as colors_f, \
        open(JSON_DIR + "times.json", "r") as times_f:
    graph = pickle.load(graph_f)
    prev_stops = pickle.load(prev_stops_f)
    shapes = json.load(shapes_f)
    stops = json.load(stops_f)
    routes = json.load(routes_f)
    colors = json.load(colors_f)
    times = json.load(times_f)


def log(msg):
    print "[{}] {}".format(str(datetime.now().replace(microsecond=0)),
                           msg)
# demos = [
#     [
#         {
#             "path": [[-73.96411, 40.807722], [-73.958372, 40.815581]],
#             "progress": 0.5,
#             "remaining_time": 10
#         },
#         {
#             "path": graph.get_path("118", "119", shapes),
#             "progress": 0.3,
#             "remaining_time": 15
#         }
#     ],
#     [
#         {
#             "path": [[-73.96411, 40.807722], [-73.959874, 40.77362]],
#             "progress": 0.5,
#             "remaining_time": 10
#         },
#         {
#             "path": [[-73.958372, 40.815581], [-73.987691, 40.755477]],
#             "progress": 0.3,
#             "remaining_time": 25
#         },
#     ],
#     [
#         {
#             "path": [[-73.958372, 40.815581], [-73.987691, 40.755477]],
#             "progress": 0.3,
#             "remaining_time": 25
#         },
#         {
#             "path": [[-73.992629, 40.730328], [-73.989951, 40.734673]],
#             "progress": 0.3,
#             "remaining_time": 15
#         }
#     ]
# ]


@app.route('/')
def index():
    return render_template("index.html", mapbox_key=mapbox_key,
                           subway_routes=shapes.keys(), route_colors=colors)


@app.route('/map_json/<route>')
def map_json(route):
    return jsonify(shapes[route])


@app.route('/map_geojson')
def map_geojson():
    # Documentation for shapes.json:
    # shape_id: {
    #      sequence: number of points,
    #      color: route color,
    #      points: [[lon, lat],...,]
    # }
    return jsonify(routes)


@app.route('/stops_json')
def stops_json():
    # Documentation for stops.json:
    # stop_id: {
    #      coordinates: {
    #          lat: latitude,
    #          lon: longitude
    #      },
    #      name: name
    # }
    return jsonify(stops)


def schedule_timer():
    while True:
        spawn(schedule_handler)
        sleep(5)


def schedule_handler():
    log("server emmited hello world")
    socketio.emit("update", {"hello": "world"})


@socketio.on('get_feed')
def subway_cars():
    global feed_event

    if feed_event is None:
        feed_event = socketio.start_background_task(target=subway_cars_timer)

    log("Emitted.")
    # emit('feed', demos[0])

# @socketio.on('update_subway_cars')
# def update_subway_cars:
# TODO: Implement


def subway_cars_timer():
    while True:
        socketio.sleep(30)
        # demo_emit = demos[counter % len(demos)]
        # print demo_emit
        # print "Emitted."
        # socketio.emit('feed', demo_emit)
        # counter += 1


if __name__ == "__main__":
    feed_thread = feed.start_timer()
    schedule_thread = spawn(schedule_timer)

    try:
        socketio.run(app, debug=True)
    finally:
        feed_thread.cancel()
        schedule_thread.cancel()
