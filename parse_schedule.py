import simplejson as json
from datetime import time

TRANSIT_DIR = "transit_files/ "
MAP_DIR = "map_files/"


def parse_routes(shapes_fin):
    """Generates routes.json that contains the geojson mappings for each of
    the train lines used.

    Args:
        shapes_fin (file): shapes.json that contains all coordinates

    """
    # H and SI lines do not have a color defined by the MTA
    DEFAULT = "#2850AD"
    shapes_jin = json.load(shapes_fin)
    best_path_found = {}
    for line, data in shapes_jin.iteritems():
        train_line = line[:line.find('.')]
        train_direc = line[line.rfind('.') + 1]
        coord_list_len = int(data["sequence"])

        # Finds best path by considering longest collection of coordinates
        better_path_exists = train_line not in best_path_found or \
            coord_list_len > best_path_found[train_line]["length"]

        if train_direc == 'N' and better_path_exists:
            best_path_found[train_line] = {
                "color": data["color"] if data["color"] == "#" else DEFAULT,
                "length": coord_list_len,
                "coordinates": data["points"]

            }
    geojson_out = {"type": "FeatureCollection", "features": []}
    for train_line, best_path in best_path_found.iteritems():
        geojson_ins = {
            "type": "Feature",
            "properties": {
                "color": best_path["color"],
                "length": best_path["length"],
                "route_id": train_line
            },
            "geometry": {
                "type": "LineString",
                "coordinates": best_path["coordinates"]
            }
        }
        geojson_out["features"].append(geojson_ins)
    with open(MAP_DIR + "routes.json", "w") as shapes_fout:
        json.dump(geojson_out, shapes_fout)


def convertTime(train_time):
    """Converts train_time string into a datetime time object

    Args:
        train_time (str): created from train_id.

    Returns:
        str: time in standard isoformat HH:MM:SS
    """
    fulltime = int(train_time[:-2])
    sec_diff = int(train_time[-2:])
    hour = (fulltime / 60) % 24
    minute = fulltime % 60
    second = (sec_diff / 100.0) * 60
    return time(hour, minute, int(second)).isoformat()


def parse_times(times_fin):
    """Creates a JSON file that contains the scheduled time information for
    subway trips. Partitioned into respective days (Weekday, Saturday, Sunday)
    and sorted by increasing start time.

    Args:
        times_fin (FILE): .txt file from MTA listing all trip schedules

    """
    times_fin.readline()
    times_jout = {"WKD": [], "SAT": [], "SUN": []}
    current_trip_id = None
    current_trip = []
    for line in times_fin:
        line = line.split(",")
        if current_trip_id is None:
            current_trip_id = line[0]
        # check to see if the train trip has changed - all trips are
        # expected to be in order
        elif current_trip_id != line[0]:
            mta_train_id = current_trip_id.split("_")
            operation_day = mta_train_id[0][-3:]
            times_jout[operation_day].append({
                "line": mta_train_id[-1][0:mta_train_id[-1].find('.')],
                "id": current_trip_id,
                "init_time": convertTime(mta_train_id[1]),
                "trip_time": current_trip
            })

            current_trip_id, current_trip = line[0], []

        current_trip.append((line[1], line[3]))

    for operation_day, train_data in times_jout.iteritems():
        times_jout[operation_day] = sorted(
            train_data,
            key=lambda x: (int(x["id"].split('_')[1]), x["line"])
        )
    with open(MAP_DIR + "times.json", "w") as times_fout:
        json.dump(times_jout, times_fout)


# TODO: Add argument parser
with open(TRANSIT_DIR + "stop_times.txt", "r") as times_fin, \
        open(MAP_DIR + "shapes.json", "r") as shapes_fin:
    parse_routes(shapes_fin)
    parse_times(times_fin)
