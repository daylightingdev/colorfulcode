/**
 * Process NYC community gardens data into /data/community-gardens.json
 * Run: node scripts/process-community-gardens.js
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const URL =
  "https://data.cityofnewyork.us/resource/ajxm-kzmj.json?$limit=5000";

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
  console.log("Fetching NYC community gardens data...");
  const raw = await fetch(URL);
  const json = JSON.parse(raw);

  const output = json
    .filter((g) => {
      const lat = parseFloat(g.latitude);
      const lng = parseFloat(g.longitude);
      return !isNaN(lat) && !isNaN(lng);
    })
    .map((g) => ({
      name: g.garden_name || g.name || "Unknown Garden",
      lat: parseFloat(g.latitude),
      lng: parseFloat(g.longitude),
    }));

  const outPath = path.join(__dirname, "..", "data", "community-gardens.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} community gardens to ${outPath}`);
}

main().catch((err) => {
  console.error("Error processing community gardens data:", err.message);
  process.exit(1);
});
