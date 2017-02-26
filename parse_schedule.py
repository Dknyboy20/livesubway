import simplejson as json
from datetime import time

TRANSIT_DIR = "transit_files/"
MAP_DIR = "map_files/"


def parse_routes(shapes_fin):
    """Generates routes.json that contains the geojson mappings for each of
    the subway lines used.
    Args:
        shapes_fin (file): shapes.json that contains all coordinates
    Returns:
        void: writes to routes.json
    """
    shapes_jin = json.load(shapes_fin)
    best_path_found = {}
    for line, data in shapes_jin.iteritems():
        sbw_line = line[:line.find('.')]
        sbw_direc = line[line.rfind('.') + 1]
        coord_list_len = int(data["sequence"])

        better_path_exists = sbw_line not in best_path_found or \
            coord_list_len > best_path_found[sbw_line]["length"]

        if sbw_direc == 'N' and better_path_exists:
            best_path_found[sbw_line] = {
                "color": data["color"],
                "length": coord_list_len,
                "coordinates": data["points"]

            }
    geojson_out = {"type": "FeatureCollection", "features": []}
    for sbw_line, best_path in best_path_found.iteritems():
        geojson_ins = {
            "type": "Feature",
            "properties": {
                "color": best_path["color"],
                "length": best_path["length"],
                "route_id": sbw_line
            },
            "geometry": {
                "type": "LineString",
                "coordinates": best_path["coordinates"]
            }
        }
        geojson_out["features"].append(geojson_ins)
    with open(MAP_DIR + "routes.json", "w") as shapes_fout:
        json.dump(geojson_out, shapes_fout)


def convertTime(sbw_time):
    """Converts sbw_time string into a datetime time object
    Args:
        sbw_time (str): created from sbw_id.
    Returns:
        str: time in standard isoformat
    """
    fulltime = int(sbw_time[:-2])
    sec_diff = int(sbw_time[-2:])
    hour = (fulltime / 60) % 24
    minute = fulltime % 60
    second = (sec_diff / 100.0) * 60
    return time(hour, minute, int(second)).isoformat()


def parse_trips(trips_fin):
    """Reads each line of the trip file and creates a dictionary object with
    the they key equals the day (WKD, SAT, SUN) and the corresponding train
    schedule for each day an array of dictionary objects. Each object contains
    essential infomation about the unique train schedule and is sorted by
    incrasing starting time.
    Args:
        trips_f (file): file containing all scheduled trips info
    Returns:
        void: writes a json object into mapfiles/
    """
    trips_jout = {}
    trips_fin.readline()
    for fl in trips_fin:
        fl = fl.split(',')
        sbw_line, sbw_id = fl[0], fl[2]
        sbw_info = sbw_id.split('_')
        sbw_day, sbw_time = sbw_info[0][-3:], convertTime(sbw_info[1])

        sbw_entry = {
            "line": sbw_line,
            "id": sbw_id,
            "time": sbw_time
        }

        if sbw_day not in trips_jout:
            trips_jout[sbw_day] = []

        trips_jout[sbw_day].append(sbw_entry)
    for sbw_day, sbw_data in trips_jout.iteritems():
        trips_jout[sbw_day] = sorted(sbw_data, key=lambda x:
                                     (int(x.get("id").split('_')[1]),
                                      x.get("line")))
    with open("map_files/trips.json", "w") as trips_fot:
        json.dump(trips_jout, trips_fot)


# TODO: Add argument parser
with open(TRANSIT_DIR + "trips.txt", "r") as trips_fin, \
        open(TRANSIT_DIR + "stop_times.txt", "r") as times_fin, \
        open(MAP_DIR + "shapes.json", "r") as shapes_fin:
    parse_trips(trips_fin)
    parse_routes(shapes_fin)
