/**
 * Fetch NYC Farmers Markets and write to /data/farmers-markets.json
 *
 * Run locally: node scripts/fetch-farmers-markets.js
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const URL =
  "https://data.cityofnewyork.us/resource/8vwk-6iz2.json?year=2025&$limit=200";

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
  console.log("Fetching NYC Farmers Markets data...");
  const raw = await fetch(URL);
  const json = JSON.parse(raw);

  const output = json
    .filter((r) => {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      return !isNaN(lat) && !isNaN(lng);
    })
    .map((r) => ({
      name: r.marketname,
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
      borough: r.borough,
      daysOperation: r.daysoperation,
      hoursOperation: r.hoursoperations,
      acceptsEbt: r.accepts_ebt === "Yes" || r.accepts_ebt === "1",
      openYearRound: r.open_year_round === "Yes" || r.open_year_round === "1",
    }));

  const outPath = path.join(__dirname, "..", "data", "farmers-markets.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} farmers markets to ${outPath}`);
}

main().catch((err) => {
  console.error("Error fetching farmers markets:", err.message);
  process.exit(1);
});
