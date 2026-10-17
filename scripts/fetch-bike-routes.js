/**
 * Fetch NYC bike routes and write to /data/bike-routes.json
 *
 * Run locally: node scripts/fetch-bike-routes.js
 *
 * facilityClass values:
 *   "I"   = protected bike lane
 *   "II"  = standard bike lane
 *   "III" = sharrow (shared lane marking)
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const URL =
  "https://data.cityofnewyork.us/resource/mzxg-pwib.json?$where=status=%27Current%27&$limit=50000";

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

async function main() {
  console.log("Fetching NYC bike routes...");
  const raw = await fetch(URL);
  const json = JSON.parse(raw);

  const output = json
    .filter((r) => r.the_geom)
    .map((r) => ({
      street: r.street,
      facilityClass: r.facilitycl,
      facilityType: r.ft_facilit,
      borough: r.boro,
      geometry: r.the_geom,
    }));

  const outPath = path.join(__dirname, "..", "data", "bike-routes.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} bike routes to ${outPath}`);
}

main().catch((err) => {
  console.error("Error fetching bike routes:", err.message);
  process.exit(1);
});
