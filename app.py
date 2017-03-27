import cPickle as pickle

from datetime import datetime, date
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


# Could also implement using decorator - would be more functional
def parse_time(t_str):
    d_today = date.today()
    time_str_format = "%H:%M:%S"
    return datetime.strptime(t_str, time_str_format).replace(
        year=d_today.year,
        month=d_today.month,
        day=d_today.day
    )


def schedule_init():
    """Finds the index of the next starting subway trip.
    TODO: Populates an active_cars array of the currently underway and
    unfinished subway trips.

    Returns:
        str: day of the week to key times dictionary
        int: index of next starting train in times[weekday]
        list: currently underway and unfinished trips
    """

    weekday = {5: "SAT", 6: "SUN"}.get(datetime.today().weekday(), "WKD")

    active_cars = []

    daily_schedule = times[weekday]
    today = datetime.today()
    c = find_index_of_next_train(daily_schedule, today)
    # relatively inefficient way to find all operational cars
    for i in xrange(c):
        train_stop_time = parse_time(daily_schedule[i]["trip_time"][-1][0])
        if (train_stop_time - today).days >= 0:
            active_cars.append(i)

    return c, weekday, active_cars


def find_index_of_next_train(arr, t_target):
    """Standard binary search through sorted arr to find the next starting
    mta trip.

    Args:
        arr (list): all current trips for the day sorted by time
        t_target (datetime.datetime): current datetime

    Returns:
        int: index of next starting trip
    """

    lo, hi = 0, len(arr)

    while lo < hi:
        mid = (lo + hi) / 2
        t_delta = parse_time(arr[mid]["init_time"]) - t_target

        # check to see if the difference is negative
        if t_delta.days < 0:
            lo = mid + 1
        else:
            hi = mid
    return lo


def schedule_handler():
    """This function is used for testing for now - will be replaced in the
    future
    """
    while (True):
        next_subway_index, weekday, active_cars = schedule_init()
        socketio.emit("update", [times[weekday][next_subway_index],
                      active_cars])
        log("emitted update")
        sleep(5)


@socketio.on('get_feed')
def subway_cars():
    global feed_event

    if feed_event is None:
        feed_event = socketio.start_background_task(target=subway_cars_timer)

    log("Emitted.")
    # emit('feed', demos[0])


def subway_cars_timer():
    pass


if __name__ == "__main__":
    feed_thread = feed.start_timer()
    # testing/debugging purposes only
    spawn(schedule_handler)
    try:
        socketio.run(app, debug=True)
    finally:
        feed_thread.cancel()
