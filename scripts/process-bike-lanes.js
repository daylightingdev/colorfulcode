/**
 * Process bike lane data from Overpass API into /data/bike-lanes.json
 * Run: node scripts/process-bike-lanes.js
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const QUERY = `[out:json];area["name"="New York City"]->.nyc;way(area.nyc)["highway"]["cycleway"]->.lanes;(.lanes;);out geom;`;

function fetch(url, postData) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString()));
      res.on("error", reject);
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Map cycleway tag values to protection levels.
 * - track, separate -> protected
 * - lane -> painted
 * - shared_lane, sharrow -> shared
 */
function getProtectionLevel(tags) {
  const cyclewayValues = [
    tags.cycleway,
    tags["cycleway:left"],
    tags["cycleway:right"],
    tags["cycleway:both"],
  ].filter(Boolean);

  for (const val of cyclewayValues) {
    if (val === "track" || val === "separate") return "protected";
  }
  for (const val of cyclewayValues) {
    if (val === "lane") return "painted";
  }
  for (const val of cyclewayValues) {
    if (val === "shared_lane" || val === "sharrow") return "shared";
  }

  // Default to painted if we can't determine
  return "painted";
}

async function main() {
  console.log("Fetching bike lane data from Overpass API...");
  console.log("(This may take a while for a large area like NYC)");

  const postData = `data=${encodeURIComponent(QUERY)}`;
  const raw = await fetch(OVERPASS_URL, postData);
  const json = JSON.parse(raw);

  const elements = json.elements || [];
  const ways = elements.filter(
    (el) => el.type === "way" && el.geometry && el.geometry.length > 0
  );

  const output = ways.map((way) => ({
    protection_level: getProtectionLevel(way.tags || {}),
    coords: way.geometry.map((pt) => [pt.lon, pt.lat]),
  }));

  const outPath = path.join(__dirname, "..", "data", "bike-lanes.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} bike lane segments to ${outPath}`);
}

main().catch((err) => {
  console.error("Error processing bike lane data:", err.message);
  process.exit(1);
});
