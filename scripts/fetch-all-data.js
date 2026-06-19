/**
 * Master script that runs all data fetch scripts.
 *
 * Run locally: node scripts/fetch-all-data.js
 */
const { execSync } = require("child_process");
const path = require("path");

const scripts = [
  { name: "Citi Bike stations", file: "fetch-citibike.js" },
  { name: "Farmers Markets", file: "fetch-farmers-markets.js" },
  { name: "GreenThumb Gardens", file: "fetch-greenthumb-gardens.js" },
  { name: "NYC Parks", file: "fetch-nyc-parks.js" },
  { name: "Libraries", file: "fetch-libraries.js" },
  { name: "DonateNYC", file: "fetch-donatenyc.js" },
  { name: "Bike Routes", file: "fetch-bike-routes.js" },
];

const scriptsDir = __dirname;

for (const script of scripts) {
  const scriptPath = path.join(scriptsDir, script.file);
  console.log(`\nFetching ${script.name}...`);
  try {
    execSync(`node "${scriptPath}"`, { stdio: "inherit" });
    console.log(`Done.`);
  } catch (err) {
    console.error(
      `Error running ${script.file}: ${err.message || "unknown error"}`
    );
  }
}

console.log("\nAll fetch scripts complete.");
