/**
 * Pre-compute Low Carbon Access Scores for all census tract centroids.
 * Uses only static data (no Google Places API calls).
 * Run: node scripts/compute-tract-scores.js
 *
 * Output: /data/tract-scores.json
 */
const fs = require("fs");
const path = require("path");

// Load data
const centroids = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/tract-centroids.json"), "utf-8")
);
const transitStops = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/gtfs-stops.json"), "utf-8")
);
const bikeLanes = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/bike-lanes.json"), "utf-8")
);
const bikeShares = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/bikeshare-docks.json"), "utf-8")
);
const gardens = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/community-gardens.json"), "utf-8")
);
const compost = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/composting-sites.json"), "utf-8")
);
const equity = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/equity-by-tract.json"), "utf-8")
);

// Distance helper (haversine, miles)
function distMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearby(items, lat, lng, radius) {
  return items.filter((i) => distMiles(lat, lng, i.lat, i.lng) <= radius);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function distToSegment(lat, lng, coords) {
  let minDist = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    const dx = lng2 - lng1, dy = lat2 - lat1;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? clamp(((lng - lng1) * dx + (lat - lat1) * dy) / len2, 0, 1) : 0;
    minDist = Math.min(minDist, distMiles(lat, lng, lat1 + t * dy, lng1 + t * dx));
  }
  return minDist;
}

function nearbyLanes(lanes, lat, lng, radius) {
  return lanes.filter((l) => distToSegment(lat, lng, l.coords) <= radius);
}

// Simplified scoring (mirrors lib/scoring.ts logic)
function scoreForCentroid(lat, lng) {
  const transit = nearby(transitStops, lat, lng, 0.5);
  const subways = transit.filter((s) => s.type === "subway");
  const buses = transit.filter((s) => s.type === "bus");
  let transitScore = 0;
  if (subways.length > 0) {
    transitScore += Math.min(subways.length * 4, 10);
    const avgH = subways.reduce((s, x) => s + (x.headway_minutes || 10), 0) / subways.length;
    if (avgH < 6) transitScore += 5; else if (avgH < 10) transitScore += 3;
    transitScore = Math.min(transitScore, 15);
  }
  transitScore += Math.min(buses.length * 2, 8);
  transitScore = Math.min(transitScore, 30);

  const lanes = nearbyLanes(bikeLanes, lat, lng, 0.25);
  const prot = lanes.filter((l) => l.protection_level === "protected");
  const paint = lanes.filter((l) => l.protection_level === "painted");
  let mobilityScore = 0;
  if (prot.length > 0) mobilityScore += Math.min(prot.length * 4, 8);
  else mobilityScore += Math.min(paint.length * 2, 4);
  const shares = nearby(bikeShares, lat, lng, 0.25);
  mobilityScore += Math.min(shares.length * 3, 8);
  mobilityScore = Math.min(mobilityScore, 20);

  // Daily needs: 0 for pre-compute (no Google Places)
  const dailyScore = 0;

  // Circular economy: compost only
  const comp = nearby(compost, lat, lng, 0.5);
  let circularScore = Math.min(comp.length * 3, 5);
  circularScore = Math.min(circularScore, 15);

  // Local food: gardens
  const gard = nearby(gardens, lat, lng, 0.5);
  let foodScore = Math.min(gard.length * 2, 4);
  foodScore = Math.min(foodScore, 10);

  const cleanScore = 0; // No static EV/water data

  return transitScore + mobilityScore + dailyScore + circularScore + foodScore + cleanScore;
}

// Compute scores for all centroids
const result = {};
for (const c of centroids) {
  const score = scoreForCentroid(c.lat, c.lng);
  result[c.tract] = {
    score,
    lat: c.lat,
    lng: c.lng,
  };
}

const outPath = path.join(__dirname, "../data/tract-scores.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`Computed scores for ${Object.keys(result).length} tracts`);

// Show score distribution
const scores = Object.values(result).map((r) => r.score);
const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
const min = Math.min(...scores);
const max = Math.max(...scores);
console.log(`Score range: ${min}-${max}, average: ${avg}`);
