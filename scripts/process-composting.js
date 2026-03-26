/**
 * Process NYC composting / food scrap drop-off data into /data/composting-sites.json
 * Run: node scripts/process-composting.js
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const URL =
  "https://data.cityofnewyork.us/resource/8hmm-ypp5.json?$limit=5000";

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
  console.log("Fetching NYC composting sites data...");
  const raw = await fetch(URL);
  const json = JSON.parse(raw);

  const output = json
    .filter((s) => {
      const lat = parseFloat(s.latitude);
      const lng = parseFloat(s.longitude);
      return !isNaN(lat) && !isNaN(lng);
    })
    .map((s) => ({
      name:
        s.food_scrap_drop_off_site || s.site_name || s.name || "Unknown Site",
      lat: parseFloat(s.latitude),
      lng: parseFloat(s.longitude),
    }));

  const outPath = path.join(__dirname, "..", "data", "composting-sites.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} composting sites to ${outPath}`);
}

main().catch((err) => {
  console.error("Error processing composting data:", err.message);
  process.exit(1);
});
