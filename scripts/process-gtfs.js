/**
 * Process MTA GTFS subway data into /data/gtfs-stops.json
 * Run: node scripts/process-gtfs.js
 */
const fs = require("fs");
const path = require("path");

const GTFS_DIR = "/tmp/gtfs_subway";

function parseCsv(filename) {
  const content = fs.readFileSync(path.join(GTFS_DIR, filename), "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    // Handle quoted fields
    const values = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = values[i] || "";
    });
    return obj;
  });
}

// 1. Parse stops — only parent stations (location_type=1) or stops without parent
const stops = parseCsv("stops.txt");
const parentStops = stops.filter(
  (s) => s.location_type === "1" || (!s.location_type && !s.parent_station)
);

// Map child stop_ids to parent stop_id
const childToParent = {};
stops.forEach((s) => {
  if (s.parent_station) {
    childToParent[s.stop_id] = s.parent_station;
  }
});

// 2. Parse trips to get route_id per trip_id
const trips = parseCsv("trips.txt");
const tripToRoute = {};
trips.forEach((t) => {
  tripToRoute[t.trip_id] = t.route_id;
});

// 3. Parse stop_times to find routes per stop and calculate headways
console.log("Parsing stop_times (this may take a moment)...");
const stopTimes = parseCsv("stop_times.txt");

// Collect routes per parent stop
const stopRoutes = {};
// Collect arrival times per stop for headway calculation (weekday morning 7-9am)
const stopArrivals = {};

stopTimes.forEach((st) => {
  const stopId = childToParent[st.stop_id] || st.stop_id;
  const routeId = tripToRoute[st.trip_id];
  if (!routeId) return;

  if (!stopRoutes[stopId]) stopRoutes[stopId] = new Set();
  stopRoutes[stopId].add(routeId);

  // Collect arrivals for headway (use all times, approximate peak)
  const timeParts = st.arrival_time?.split(":");
  if (timeParts && timeParts.length === 3) {
    const hour = parseInt(timeParts[0]);
    const min = parseInt(timeParts[1]);
    // Peak hours: 7-9am
    if (hour >= 7 && hour < 9) {
      if (!stopArrivals[stopId]) stopArrivals[stopId] = [];
      stopArrivals[stopId].push(hour * 60 + min);
    }
  }
});

// Calculate average headway per stop
function calcHeadway(arrivals) {
  if (!arrivals || arrivals.length < 2) return null;
  const sorted = [...arrivals].sort((a, b) => a - b);
  let totalGap = 0;
  let gaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > 0 && gap < 30) {
      // Filter out gaps > 30 min (likely different routes)
      totalGap += gap;
      gaps++;
    }
  }
  return gaps > 0 ? Math.round(totalGap / gaps) : null;
}

// 4. Build output
const output = parentStops.map((s) => {
  const routes = stopRoutes[s.stop_id]
    ? [...stopRoutes[s.stop_id]].sort()
    : [];
  const headway = calcHeadway(stopArrivals[s.stop_id]);
  return {
    stop_id: s.stop_id,
    name: s.stop_name,
    lat: parseFloat(s.stop_lat),
    lng: parseFloat(s.stop_lon),
    routes,
    type: "subway",
    headway_minutes: headway || 8, // default 8 min if unknown
  };
});

// Filter out stops with no routes (shouldn't happen but just in case)
const filtered = output.filter((s) => s.routes.length > 0);

const outPath = path.join(__dirname, "..", "data", "gtfs-stops.json");
fs.writeFileSync(outPath, JSON.stringify(filtered, null, 2));
console.log(`Wrote ${filtered.length} subway stops to ${outPath}`);
