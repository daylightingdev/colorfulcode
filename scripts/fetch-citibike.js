/**
 * Fetch ALL Citi Bike stations and write to /data/bikeshare-docks.json
 *
 * Run locally: node scripts/process-citibike.js
 *
 * This fetches the live GBFS feed which has ~2000+ stations.
 * Run periodically to pick up new stations.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const URL = "https://gbfs.citibikenyc.com/gbfs/en/station_information.json";

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Failed to parse JSON"));
        }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function main() {
  console.log("Fetching Citi Bike station data...");
  const raw = await fetch(URL);

  const stations = (raw.data?.stations || [])
    .filter((s) => s.lat && s.lon)
    .map((s) => ({
      name: `Citi Bike - ${s.name}`,
      lat: parseFloat(s.lat.toFixed(6)),
      lng: parseFloat(s.lon.toFixed(6)),
    }));

  const outPath = path.join(__dirname, "../data/bikeshare-docks.json");
  fs.writeFileSync(outPath, JSON.stringify(stations, null, 2));
  console.log(`Wrote ${stations.length} Citi Bike stations to ${outPath}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
