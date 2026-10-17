/**
 * Fetch GreenThumb community gardens and write to /data/greenthumb-gardens.json
 *
 * Run locally: node scripts/fetch-greenthumb-gardens.js
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const URL =
  "https://data.cityofnewyork.us/resource/p78i-pat6.json?$limit=700";

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
  console.log("Fetching GreenThumb gardens data...");
  const raw = await fetch(URL);
  const json = JSON.parse(raw);

  const output = json
    .map((r) => {
      const centroid = r.multipolygon ? computeCentroid(r.multipolygon) : null;
      if (!centroid) return null;
      return {
        name: r.gardenname,
        address: r.address,
        lat: centroid.lat,
        lng: centroid.lng,
        borough: r.borough,
      };
    })
    .filter(Boolean);

  const outPath = path.join(__dirname, "..", "data", "greenthumb-gardens.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} GreenThumb gardens to ${outPath}`);
}

main().catch((err) => {
  console.error("Error fetching GreenThumb gardens:", err.message);
  process.exit(1);
});
