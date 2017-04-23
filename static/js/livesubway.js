"use strict";

const SUBWAY_STOP_DELAY = 20; // unused for now
const SPEED = 60;
const DURATION = 30;
const TOTAL_FRAMERATE = SPEED * DURATION;
const INTERVAL = 1000 / SPEED;
const SAMPLE_POINTS = 20;
const TIME_FORMAT = "HH:mm:ss";


const SERVER_DELAY = 5;
const ACTIVE_CARS = {

};

const DB_NAME = "LIVESUBWAY_DB";
const DB_ROUTES_STORE = "ROUTES_STORE";
const DB_STOPS_STORE = "STOPS_STORE";

const LEAFLET_TYLE_LAYER = "http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";
const LEAFLET_ATTRIBUTION = `&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy;` +
  `<a href="http://cartodb.com/attributions">CartoDB</a>`;

const LEAFLET_ZOOM = 13;
const LEAFLET_MAX_ZOOM = 25;
const LEAFLET_CENTER = [40.758896, -73.985130];
const LEAFLET_MAP_BOUND = [
  [40.440957, -74.380673],
  [40.938094, -73.676237]
];

const SUBWAY_ICON = `<i class="fa fa-dot-circle-o" aria-hidden="true" style="visibility:hidden;"></i>`;

const MAPBOX = {
  container: "subwaymap",
  style: "mapbox://styles/mapbox/light-v9",
  center: [-73.889393, 40.730552],
  dragRotate: false,
  zoom: 10.45,
  minZoom: 10.15,
  bearing: 28.3
};

const MAPBOX_LAYER_LAYOUT = {
  "line-join": "round",
  "line-cap": "round"
};

const MAPBOX_STOPS_PAINT = {
  "circle-radius": {
    stops: [[11, 3], [14, 4], [16, 5]],
  },
  "circle-color": "#ccc",
};


// _________________________________________
// START OF ANIMATION SEGMENT


//TODO: Does not need to be hardcoded but will remain
//      as such until a later date
const ActiveTrains = {
  "1": [],
  "2": [],
  "3": [],
  "4": [],
  "5": [],
  "6": [],
  "B": [],
  "D": [],
  "F": [],
  "M": [],
  "A": [],
  "C": [],
  "E": [],
  "G": [],
  "J": [],
  "Z": [],
  "L": [],
  "N": [],
  "Q": [],
  "R": [],
  "S": [],
  "7": [],
  "SIR": [],
};

(function() {
    var lastTime = 0;
    var vendors = ["ms", "moz", "webkit", "o"];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+"RequestAnimationFrame"];
        window.cancelAnimationFrame = window[vendors[x]+"CancelAnimationFrame"] || 
        window[vendors[x]+"CancelRequestAnimationFrame"];
    }
 
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

const Point = coordinate => {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Point",
      coordinates: coordinate
    }
  };
};


const findDistanceByCoord = (c1, c2) => {
  return turf.distance(Point(c1), Point(c2), "miles");
};

// Finds the distance between two indices on the geojson line.
// Adds up the individual segments until the end segment.
// All units are in miles
const findDistanceByIndex = (startindex, endindex, coordmap) => {
  let dist = 0;
  while (startindex !== endindex){
    dist += findDistanceByCoord(coordmap[startindex], coordmap[endindex]);
  }
  return dist;
};

// Calculates the speed of the train required to get 
// from <startindex:int> to <endindex:int> along the specific line
// within SERVER_DELAY seconds.
/**
 * @param  {[type]}
 * @param  {[type]}
 * @param  {[type]}
 * @return {[type]}
 */
const calcSpeed = (startindex, endindex, coordmap) => {
  return findDistanceByIndex(startindex, endindex, coordmap)/SERVER_DELAY;
 };


// };

const animateTrains = (map, subwayCars) => {
  const lineTuple = subwayCars.map(subwayCar => {
    const line = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: subwayCar.path,
      },
    };

    const distance = turf.lineDistance(line, "miles");
    const distanceTraveled = subwayCar.progress * distance;

    return [line, distance, distanceTraveled, subwayCar.remaining_time];
  });

  const points = lineTuple.map(x => {
    return turf.along(x[0], x[2], "miles");
  });

  const allAnimSteps = lineTuple.map(x => {
    const [line, d, dT, rT] = x;
    const remainingDistance = d - dT;
    const animSpeed = SPEED * rT;
    const animFrames = SPEED * Math.min(DURATION, rT);

    return [...Array(TOTAL_FRAMERATE).keys()].map((x, i) => {
      const distance = i < animFrames ? dT + (i / animSpeed) * remainingDistance : d;

      const segment = turf.along(line, distance, "miles");

      return segment.geometry.coordinates;
    });
  });



  const start = Date.now();

  let then = start;
  let counter = 0;

  const animate = () => {
    if (counter / INTERVAL < (SPEED * DURATION) - 1) {
      const now = Date.now();
      const elapsed = now - then;

      then = now;

      points.forEach((point, i) => {
        const animSteps = allAnimSteps[i];

        point.geometry.coordinates = animSteps[Math.round(elapsed / INTERVAL)];
      });

      map.getSource("subwayCars").setData({
        type: "FeatureCollection",
        features: points,
      });

      counter += elapsed;

      requestAnimationFrame(animate);
    } else {
      const animTime = ((Date.now() - start) / 1000).toString();

      console.log(`Time elapsed for animation: ${animTime}`);
    }
  };

  animate();
};
// _________________________________________
// END OF ANIMATION SEGMENT

const getJSON = (path, success, fail) => {
  const xmlhttp = new XMLHttpRequest();

  xmlhttp.onreadystatechange = () => {
    if (xmlhttp.readyState === XMLHttpRequest.DONE) {
      if (xmlhttp.status === 200) {
        success(JSON.parse(xmlhttp.responseText));
      } else {
        fail();
      }
    }
  };

  xmlhttp.open("GET", path, true);
  xmlhttp.send();
};

const fetchMap = (fetcher, map, finish) => {
  const prefix_distances = routesData => {
    console.log("test", routesData);
    routesData.features.forEach(routeData => {
      let total_distance = 0;
      let previous = routeData.geometry.coordinates[0];
      routeData.prefixDistances = routeData.geometry.coordinates.map( point => {
        total_distance += findDistanceByCoord(previous, point);
        previous = point;
        return total_distance;
      });
    });
  };

  const renderRoutes = (routesData, cb) => {
    routesData.features.forEach((routeData) => {
      map.addSource(routeData.properties.route_id,
      {
        type: "geojson",
        data: routeData
      });
      
      map.addLayer(
      {
        id: routeData.properties.route_id,
        type: "line",
        source: routeData.properties.route_id,
        layout: MAPBOX_LAYER_LAYOUT,
        paint: {"line-color": routeData.properties.color }
      });

    });
    prefix_distances(routesData);
    //console.log(routesData);
    cb(routesData);
  };

  const routePromise = new Promise((resolve, reject) => {
    fetcher("/map_geojson", (routesData) => {
      renderRoutes(routesData, resolve);
    }, reject);
  });

  const renderStops = (stopData, cb) => {
    const stops = Object.entries(stopData).filter(([_, stopVal]) => {
      return stopVal.name.toLowerCase().indexOf("2 av") === -1;
    }).map(([_, stopVal]) => {
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: stopVal.coordinates.reverse()
        },
        properties: {
          title: stopVal.name
        }
      };
    });
    map.addSource("subwayStops", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: stops
      }
    });

    map.addLayer({
      id: "subwayStops",
      type: "circle",
      source: "subwayStops",
      paint: MAPBOX_STOPS_PAINT
    });

    cb(stopData);
  };

  const stopPromise = new Promise((resolve, reject) => {
    fetcher("/stops_json", (stopData) => {
      renderStops(stopData, resolve);
    }, reject);
  });

  Promise.all([routePromise, stopPromise])
    .then((data) => {
      const [routes, stops] = data;
      finish(routes, stops);
    }).catch(() => {});
};

document.addEventListener("DOMContentLoaded", () => {
  mapboxgl.accessToken = ACCESS_TOKEN;
  const map = new mapboxgl.Map(MAPBOX);


  const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

  const socket = io.connect("localhost:5000");


  map.on("load", () => {

    const compareCoordinates = stop_coordinate => {
      return element => {
       // console.log(element, stop_coordinate);
       return element[0] === stop_coordinate[0] && element[1] === stop_coordinate[1]; 
      };
    };

    fetchMap(getJSON, map, (routes, stops) => {
      socket.emit("get_feed");
      console.log(routes, stops);
      
      socket.on("schedule", (data) => {
        
        const animation_schedule = data.map( schedule => {
          console.log(schedule);
          const animation_steps = [];
          const current_route = routes.features.find((element) => {
            return element.properties.route_id === schedule.line;
          });
          if (current_route === null){
            throw "failed to find route";
          }

          console.log(current_route);

          const route_coordinates = current_route.geometry.coordinates;
          const route_distances = current_route.prefixDistances;

          let previous = null;
          let previous_index = schedule.direction == "N" ? 0 : route_coordinates.length - 1;
          schedule.trip_time.forEach(stop_time => {
            if (previous === null){
              previous = stop_time;
            }
            else {

              const seconds_difference = moment(stop_time[0], TIME_FORMAT).diff(moment(previous[0], TIME_FORMAT),
                "seconds");
              const stop_coordinate = stops[stop_time[1].slice(0, -1)].coordinates;
              const stop_index = route_coordinates.findIndex(compareCoordinates(stop_coordinate));

              // if (stop_index === -1) throw "Unable to find stop in routes: " + stop_index;
              const stop_distance = Math.abs(route_distances[stop_index] - route_distances[previous_index]);
              // console.log(seconds_difference, stop_index, previous_index, stop_distance, stop_time[0], previous[0]);
              previous_index = stop_index;
              const subway_speed = stop_distance / seconds_difference;
              console.log(subway_speed * 60 * 60);

            }


          });

        });
      });
    });
  });


  socket.on("feed", subwayCars => {
    animateTrains(map, subwayCars);
  });

});