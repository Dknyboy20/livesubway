import json
from operator import itemgetter
from datetime import time

DIR = "transit_files/"


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


def parseTrips(trips_f):
    """Reads each line of the trip file and creates a dictionary object with
    subway line, train id, and time scheduled to start. Each object is further
    placed into an array indexed by days (WKD, SAT, SUN) and sorted by time.
    
    Args:
        trips_f (file): file containing all scheduled trips info
    
    Returns:
        void: writes a json object into mapfiles/
    """
    trips_j = {}

    for line in trips_f:
        line = line.split(',')
        sbw_line = line[0]
        sbw_id = line[2]
        sbw_info = sbw_id.split('_')
        sbw_day = sbw_info[0][-3:]
        sbw_time = convertTime(sbw_info[1])

        sbw_entry = {
            "line": sbw_line,
            "id": sbw_id,
            "time": sbw_time
        }
        if sbw_day not in trips_j:
            trips_j[sbw_day] = []
        trips_j[sbw_day].append(sbw_entry)
    for sbw_day in trips_j:
        sbw_dict = trips_j[sbw_day]
        trips_j[sbw_day] = sorted(sbw_dict, key=lambda x:
                                  (int(x.get("id").split('_')[1]),
                                   x.get("line")))
    with open("map_files/trips.json", "w") as trips_fo:
        json.dump(trips_j, trips_fo)

with open(DIR + "trips.txt", "r") as trips_f,\
        open(DIR + "stop_times.txt", "r") as times_f:
    parseTrips(trips_f)
