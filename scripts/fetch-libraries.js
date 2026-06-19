/**
 * Fetch NYC libraries from three sources (NYPL, Queens, Brooklyn) and merge
 * into /data/libraries.json
 *
 * Run locally: node scripts/fetch-libraries.js
 */
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

function fetchGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod
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

function fetchPost(url, body, contentType) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = mod.request(options, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString()));
      res.on("error", reject);
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function fetchNYPL() {
  console.log("  Fetching NYPL branches...");
  const raw = await fetchGet(
    "https://refinery.nypl.org/api/nypl/locations/v1.0/locations?location_type=branch"
  );
  const json = JSON.parse(raw);
  const locations = json.locations || json;

  return (Array.isArray(locations) ? locations : [])
    .filter(
      (item) =>
        item.geolocation &&
        item.geolocation.coordinates &&
        item.geolocation.coordinates.length >= 2
    )
    .map((item) => ({
      name: item.name,
      address: item.street_address,
      lat: item.geolocation.coordinates[1],
      lng: item.geolocation.coordinates[0],
      system: "NYPL",
    }));
}

async function fetchQueens() {
  console.log("  Fetching Queens library branches...");
  const raw = await fetchGet(
    "https://data.cityofnewyork.us/resource/kh3d-xhq7.json?$limit=100"
  );
  const json = JSON.parse(raw);

  return json
    .filter((r) => {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      return !isNaN(lat) && !isNaN(lng);
    })
    .map((r) => ({
      name: r.name,
      address: r.address,
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
      system: "Queens",
    }));
}

async function fetchBrooklyn() {
  console.log("  Fetching Brooklyn library branches via Overpass...");
  const body =
    'data=[out:json];area["name"="Brooklyn"]["admin_level"="6"]->.a;node["amenity"="library"](area.a);out body;';
  const raw = await fetchPost(
    "https://overpass-api.de/api/interpreter",
    body,
    "application/x-www-form-urlencoded"
  );
  const json = JSON.parse(raw);

  return (json.elements || []).map((node) => ({
    name: (node.tags && node.tags.name) || "Brooklyn Library Branch",
    address: (node.tags && node.tags["addr:street"]) || "",
    lat: node.lat,
    lng: node.lon,
    system: "Brooklyn",
  }));
}

async function main() {
  console.log("Fetching NYC library data from three sources...");

  const [nypl, queens, brooklyn] = await Promise.all([
    fetchNYPL(),
    fetchQueens(),
    fetchBrooklyn(),
  ]);

  console.log(
    `  NYPL: ${nypl.length}, Queens: ${queens.length}, Brooklyn: ${brooklyn.length}`
  );

  const output = [...nypl, ...queens, ...brooklyn];

  const outPath = path.join(__dirname, "..", "data", "libraries.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} libraries to ${outPath}`);
}

main().catch((err) => {
  console.error("Error fetching libraries:", err.message);
  process.exit(1);
});
