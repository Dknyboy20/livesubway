"use strict";

const SPEED = 60;
const DURATION = 30;
const TOTAL_FRAMERATE = SPEED * DURATION;
const INTERVAL = 1000 / SPEED;
const SAMPLE_POINTS = 20;

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

// Finds the distance between two indices on the geojson line.
// Adds up the individual segments until the end segment.
// All units are in miles
const findDistance = (startindex, endindex, coordmap) => {
  let dist = 0;
  while (startindex !== endindex){
    dist += turf.along(coordmap[startindex], coordmap[++startindex], "miles");
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
  return findDistance(startindex, endindex, coordmap)/SERVER_DELAY;
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

  const source = {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: points,
    },
  };

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
    fetchMap(getJSON, map, (routes, stops) => {
      socket.emit("get_feed");
      const schedule_handler = (routes, stops) => {

      };
      socket.on("schedule", handler(routes, stops));
    });
  });


  socket.on("feed", subwayCars => {
    animateTrains(map, subwayCars);
  });
  socket.on("update", newSubways => {
    console.log(newSubways);
    const animation_steps = newSubways.map(newSubway => {

    });

  });
});