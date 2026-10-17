/**
 * Process Citi Bike station data into /data/bikeshare-docks.json
 * Run: node scripts/process-citibike.js
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const URL = "https://gbfs.citibikenyc.com/gbfs/en/station_information.json";

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
  console.log("Fetching Citi Bike station data...");
  const raw = await fetch(URL);
  const json = JSON.parse(raw);

  const stations = json.data?.stations || [];
  const output = stations
    .filter((s) => s.lat != null && s.lon != null)
    .map((s) => ({
      name: s.name,
      lat: parseFloat(s.lat),
      lng: parseFloat(s.lon),
    }));

  const outPath = path.join(__dirname, "..", "data", "bikeshare-docks.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} bike stations to ${outPath}`);
}

main().catch((err) => {
  console.error("Error processing Citi Bike data:", err.message);
  process.exit(1);
});
