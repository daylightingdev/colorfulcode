/**
 * Fetch DonateNYC drop-off sites and write to /data/donatenyc.json
 *
 * Run locally: node scripts/fetch-donatenyc.js
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const URL =
  "https://data.cityofnewyork.us/resource/gkgs-za6m.json?$limit=1600";

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
  console.log("Fetching DonateNYC drop-off sites...");
  const raw = await fetch(URL);
  const json = JSON.parse(raw);

  const output = json
    .filter((r) => {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      return !isNaN(lat) && !isNaN(lng);
    })
    .map((r) => ({
      name: r.site,
      address: r.address,
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
      categoriesAccepted: r.categoriesaccepted,
      hours: r.hours,
      website: r.website,
    }));

  const outPath = path.join(__dirname, "..", "data", "donatenyc.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} DonateNYC sites to ${outPath}`);
}

main().catch((err) => {
  console.error("Error fetching DonateNYC data:", err.message);
  process.exit(1);
});
