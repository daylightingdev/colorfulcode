/**
 * Fetch NYC Parks (Flagship, Community, Neighborhood, Nature Areas, Waterfront)
 * and write to /data/nyc-parks.json
 *
 * Run locally: node scripts/fetch-nyc-parks.js
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const URL =
  "https://data.cityofnewyork.us/resource/enfh-gkve.json?$where=typecategory%20IN(%27Flagship%20Park%27,%27Community%20Park%27,%27Neighborhood%20Park%27,%27Nature%20Area%27,%27Waterfront%20Facility%27)&$limit=600";

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString()));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

/**
 * Compute centroid of a GeoJSON MultiPolygon by averaging all coordinates.
 */
function computeCentroid(multipolygon) {
  let totalLat = 0;
  let totalLng = 0;
  let count = 0;

  try {
    const coordinates = multipolygon.coordinates || [];
    for (const polygon of coordinates) {
      for (const ring of polygon) {
        for (const point of ring) {
          totalLng += point[0];
          totalLat += point[1];
          count++;
        }
      }
    }
  } catch (e) {
    return null;
  }

  if (count === 0) return null;
  return { lat: totalLat / count, lng: totalLng / count };
}

async function main() {
  console.log("Fetching NYC Parks data...");
  const raw = await fetch(URL);
  const json = JSON.parse(raw);

  const output = json
    .map((r) => {
      const centroid = r.multipolygon ? computeCentroid(r.multipolygon) : null;
      if (!centroid) return null;
      return {
        name: r.signname || r.name311,
        address: r.address,
        lat: centroid.lat,
        lng: centroid.lng,
        borough: r.borough,
        type: r.typecategory,
        acres: parseFloat(r.acres) || 0,
      };
    })
    .filter(Boolean);

  const outPath = path.join(__dirname, "..", "data", "nyc-parks.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} NYC parks to ${outPath}`);
}

main().catch((err) => {
  console.error("Error fetching NYC parks:", err.message);
  process.exit(1);
});
