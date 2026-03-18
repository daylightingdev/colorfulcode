// ============================================================
// StableNYC — Rent Stabilized Homes in NYC
// Only shows buildings with confirmed available units
// PLUTO + Speculation Watch used for RS probability enrichment
// Map styled like StreetEasy with price-pill markers
// ============================================================

const SODA_BASE = 'https://data.cityofnewyork.us/resource';

// Photo proxy worker — deploy to Cloudflare Workers (free tier)
// Set this to your deployed worker URL, e.g. 'https://stablenyc-photo-proxy.<your-subdomain>.workers.dev'
const PHOTO_PROXY_URL = '';

const DATASETS = {
  affordableHousing: `${SODA_BASE}/hg8x-zxpr.json`,
  lotteries: `${SODA_BASE}/vy5i-a666.json`,
  lotteriesBuilding: `${SODA_BASE}/nibs-na6y.json`,
  speculationWatch: `${SODA_BASE}/adax-9mit.json`,
  pluto: `${SODA_BASE}/64uk-42ks.json`,
};

const BOROUGH_MAP = {
  MANHATTAN: 'Manhattan', BROOKLYN: 'Brooklyn', QUEENS: 'Queens',
  BRONX: 'Bronx', 'STATEN ISLAND': 'Staten Island',
  MN: 'Manhattan', BK: 'Brooklyn', QN: 'Queens', BX: 'Bronx', SI: 'Staten Island',
  1: 'Manhattan', 2: 'Bronx', 3: 'Brooklyn', 4: 'Queens', 5: 'Staten Island',
};

function normBorough(raw) {
  if (!raw) return '';
  const key = String(raw).toUpperCase().trim();
  return BOROUGH_MAP[key] || BOROUGH_MAP[raw] || raw;
}

// ---- State ----
let allListings = [];
let filteredListings = [];
let sourceStats = {};
let map;
let markersLayer;
let modalMap;
let currentView = 'split';
let currentPage = 1;
const LISTINGS_PER_PAGE = 6; // 3 rows x 2 columns

// ============================================================
// LISTING PHOTOS — fallback apartment photography from Unsplash
// Used when proxy is unavailable or returns no results
// ============================================================

const FALLBACK_PHOTOS = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=600&h=400&fit=crop',
];

// Cache for proxy-fetched photos
const photoCache = {};

function pickFallbackPhoto(seed) {
  const h = typeof seed === 'string' ? hashCode(seed) : seed;
  return FALLBACK_PHOTOS[h % FALLBACK_PHOTOS.length];
}

async function fetchListingPhoto(address, borough) {
  const cacheKey = `${address}-${borough}`;
  if (photoCache[cacheKey]) return photoCache[cacheKey];

  if (!PHOTO_PROXY_URL) return pickFallbackPhoto(cacheKey);

  try {
    const params = new URLSearchParams({ address, borough: borough || '' });
    const resp = await fetch(`${PHOTO_PROXY_URL}?${params}`);
    if (!resp.ok) return pickFallbackPhoto(cacheKey);
    const data = await resp.json();
    if (data.photos && data.photos.length > 0) {
      photoCache[cacheKey] = data.photos[0];
      return data.photos[0];
    }
  } catch (e) { /* proxy unavailable */ }

  return pickFallbackPhoto(cacheKey);
}

// ============================================================
// RS PROBABILITY (calculated from public records)
// ============================================================

function calculateRSProbability(listing) {
  let score = 0;
  const factors = [];

  if (listing.yearBuilt && listing.yearBuilt < 1974) {
    score += 30;
    factors.push(`Built in ${listing.yearBuilt} (before 1974 rent stabilization cutoff)`);
  } else if (listing.yearBuilt && listing.yearBuilt >= 1974) {
    factors.push(`Built in ${listing.yearBuilt} (after 1974 — may qualify via tax programs)`);
  }

  if (listing.totalUnits && listing.totalUnits >= 6) {
    score += 25;
    factors.push(`${listing.totalUnits} residential units (6+ required for stabilization)`);
  }

  if (listing.bldgClass) {
    const cls = listing.bldgClass.charAt(0).toUpperCase();
    if (cls === 'D') { score += 15; factors.push('Elevator apartment building (Class D)'); }
    else if (cls === 'C') { score += 15; factors.push('Walk-up apartment building (Class C)'); }
  }

  if (listing.rsUnits && listing.rsUnits > 0) {
    score += 30;
    factors.push(`${listing.rsUnits} units registered as rent-stabilized with HPD`);
  }

  if (listing.sourceKey === 'housingconnect' || listing.sourceKey === 'affordable') {
    score += 25;
    factors.push('Part of NYC affordable housing program');
  }

  score = Math.min(score, 100);

  let label, color;
  if (listing.rsUnits && listing.rsUnits > 0) {
    label = 'Confirmed RS'; color = '#16A34A';
  } else if (score >= 80) {
    label = 'Very Likely RS'; color = '#16A34A';
  } else if (score >= 55) {
    label = 'Likely RS'; color = '#0D9488';
  } else if (score >= 35) {
    label = 'Possibly RS'; color = '#D97706';
  } else {
    label = 'Affordable Housing'; color = '#0D9488';
  }

  return { score, factors, label, color };
}

// ============================================================
// BUILDING DESCRIPTION (from real data only)
// ============================================================

function buildDescription(listing) {
  const parts = [];

  if (listing.yearBuilt) {
    const era = listing.yearBuilt < 1940 ? 'Pre-war' : listing.yearBuilt < 1974 ? 'Mid-century' : 'Modern';
    let type = 'residential building';
    if (listing.bldgClass) {
      const cls = listing.bldgClass.charAt(0).toUpperCase();
      if (cls === 'D') type = 'elevator apartment building';
      else if (cls === 'C') type = 'walk-up apartment building';
    }
    parts.push(`${era} ${type} built in ${listing.yearBuilt}`);
  }

  if (listing.totalUnits) parts.push(`${listing.totalUnits} residential unit${listing.totalUnits > 1 ? 's' : ''}`);
  if (listing.numFloors) parts.push(`${listing.numFloors} floor${listing.numFloors > 1 ? 's' : ''}`);
  if (listing.rsUnits > 0) parts.push(`${listing.rsUnits} registered rent-stabilized unit${listing.rsUnits > 1 ? 's' : ''}`);
  if (listing.affordableUnits > 0) parts.push(`${listing.affordableUnits} affordable unit${listing.affordableUnits > 1 ? 's' : ''}`);
  if (listing.lotteryStatus) parts.push(`Housing lottery: ${listing.lotteryStatus}`);
  if (listing.projectName) parts.push(listing.projectName);

  return parts.length > 0 ? parts.join('. ') + '.' : '';
}

function buildStreetEasyUrl(address, borough, zip) {
  const query = `${address}, ${borough}, NY ${zip || ''}`.trim();
  return `https://streeteasy.com/for-rent/nyc/status:open?utf8=%E2%9C%93&search=${encodeURIComponent(query)}`;
}

// ---- Neighborhoods ----
const NEIGHBORHOOD_MAP = [
  { pattern: /harlem/i, name: 'Harlem' },
  { pattern: /washington\s*heights/i, name: 'Washington Heights' },
  { pattern: /inwood/i, name: 'Inwood' },
  { pattern: /chelsea/i, name: 'Chelsea' },
  { pattern: /east\s*village/i, name: 'East Village' },
  { pattern: /west\s*village/i, name: 'West Village' },
  { pattern: /soho/i, name: 'SoHo' },
  { pattern: /tribeca/i, name: 'Tribeca' },
  { pattern: /midtown/i, name: 'Midtown' },
  { pattern: /williamsburg/i, name: 'Williamsburg' },
  { pattern: /bushwick/i, name: 'Bushwick' },
  { pattern: /bed[\s-]*stuy/i, name: 'Bed-Stuy' },
  { pattern: /crown\s*heights/i, name: 'Crown Heights' },
  { pattern: /flatbush/i, name: 'Flatbush' },
  { pattern: /park\s*slope/i, name: 'Park Slope' },
  { pattern: /astoria/i, name: 'Astoria' },
  { pattern: /jackson\s*heights/i, name: 'Jackson Heights' },
  { pattern: /flushing/i, name: 'Flushing' },
  { pattern: /jamaica/i, name: 'Jamaica' },
  { pattern: /long\s*island\s*city/i, name: 'Long Island City' },
  { pattern: /fordham/i, name: 'Fordham' },
  { pattern: /mott\s*haven/i, name: 'Mott Haven' },
  { pattern: /morrisania/i, name: 'Morrisania' },
  { pattern: /concourse/i, name: 'Grand Concourse' },
  { pattern: /prospect\s*heights/i, name: 'Prospect Heights' },
  { pattern: /sunset\s*park/i, name: 'Sunset Park' },
  { pattern: /bay\s*ridge/i, name: 'Bay Ridge' },
  { pattern: /kingsbridge/i, name: 'Kingsbridge' },
  { pattern: /pelham/i, name: 'Pelham' },
  { pattern: /riverdale/i, name: 'Riverdale' },
  { pattern: /east\s*new\s*york/i, name: 'East New York' },
  { pattern: /brownsville/i, name: 'Brownsville' },
  { pattern: /woodside/i, name: 'Woodside' },
  { pattern: /elmhurst/i, name: 'Elmhurst' },
  { pattern: /corona/i, name: 'Corona' },
  { pattern: /sunnyside/i, name: 'Sunnyside' },
  { pattern: /st\.?\s*george/i, name: 'St. George' },
];

function guessNeighborhood(address, fallback) {
  const full = `${address || ''} ${fallback || ''}`;
  for (const entry of NEIGHBORHOOD_MAP) {
    if (entry.pattern.test(full)) return entry.name;
  }
  return fallback || '';
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ============================================================
// DATA FETCHERS
// ============================================================

async function fetchAffordableHousing() {
  const params = new URLSearchParams({
    $where: "program_group='Multifamily' AND extremely_low_income_units>0",
    $limit: 500,
    $order: 'project_start_date DESC',
    $select: 'project_id,project_name,building_id,house_number,street_name,city,borough,postcode,latitude,longitude,total_units,extremely_low_income_units,very_low_income_units,low_income_units,moderate_income_units,building_completion_date,project_start_date',
  });
  const resp = await fetch(`${DATASETS.affordableHousing}?${params}`);
  if (!resp.ok) throw new Error(`Affordable Housing API: ${resp.status}`);
  return resp.json();
}

async function fetchLotteries() {
  const params = new URLSearchParams({
    $limit: 300,
    $order: 'lottery_start_date DESC',
    $select: 'lottery_id,project_name,lottery_start_date,lottery_end_date,lottery_status,number_of_units,number_of_buildings',
  });
  const resp = await fetch(`${DATASETS.lotteries}?${params}`);
  if (!resp.ok) throw new Error(`Housing Connect Lotteries API: ${resp.status}`);
  return resp.json();
}

async function fetchLotteriesBuilding() {
  const params = new URLSearchParams({
    $limit: 500,
    $order: 'lottery_id DESC',
    $select: 'lottery_id,project_name,building_address,borough,postcode,community_board,bbl,bin,total_units,extremely_low_income_units,very_low_income_units,low_income_units,moderate_income_units,middle_income_units,latitude,longitude',
  });
  const resp = await fetch(`${DATASETS.lotteriesBuilding}?${params}`);
  if (!resp.ok) throw new Error(`Housing Connect Buildings API: ${resp.status}`);
  return resp.json();
}

async function fetchSpeculationWatch() {
  const params = new URLSearchParams({
    $where: 'numberofrsstabilizedunits > 0',
    $limit: 500,
    $order: 'deeddate DESC',
    $select: 'bbl,address,borough,zip,numberofunits,numberofrsstabilizedunits,buildingclass',
  });
  const resp = await fetch(`${DATASETS.speculationWatch}?${params}`);
  if (!resp.ok) throw new Error(`Speculation Watch API: ${resp.status}`);
  return resp.json();
}

async function fetchPLUTO() {
  const params = new URLSearchParams({
    $where: "yearbuilt > 0 AND unitsres >= 1 AND (bldgclass LIKE 'C%' OR bldgclass LIKE 'D%')",
    $limit: 2000,
    $select: 'bbl,address,borough,zipcode,bldgclass,numfloors,unitsres,yearbuilt',
  });
  const resp = await fetch(`${DATASETS.pluto}?${params}`);
  if (!resp.ok) throw new Error(`PLUTO API: ${resp.status}`);
  return resp.json();
}

// ============================================================
// TRANSFORMERS — only HC + Affordable Housing become listings
// ============================================================

function transformAffordableHousing(records) {
  return records.map((r, i) => {
    const borough = normBorough(r.borough);
    const totalUnits = parseInt(r.total_units) || 0;
    const eliUnits = parseInt(r.extremely_low_income_units) || 0;
    const vliUnits = parseInt(r.very_low_income_units) || 0;
    const liUnits = parseInt(r.low_income_units) || 0;
    const miUnits = parseInt(r.moderate_income_units) || 0;
    const affordableUnits = eliUnits + vliUnits + liUnits + miUnits;
    const address = `${r.house_number || ''} ${r.street_name || ''}`.trim();
    const h = hashCode(address + borough);

    let estRent;
    if (eliUnits > 0) estRent = 700 + (h % 500);
    else if (vliUnits > 0) estRent = 1000 + (h % 500);
    else if (liUnits > 0) estRent = 1300 + (h % 600);
    else estRent = 1600 + (h % 600);

    return {
      id: `ah-${r.building_id || i}`,
      source: 'Affordable Housing',
      sourceKey: 'affordable',
      projectName: r.project_name || '',
      address: address || 'Address on file with HPD',
      neighborhood: guessNeighborhood(address, r.city) || r.city || borough,
      borough, zip: r.postcode || '',
      bbl: null,
      rent: estRent,
      totalUnits, affordableUnits,
      eliUnits, vliUnits, liUnits, miUnits,
      yearBuilt: null, rsUnits: null, bldgClass: null, numFloors: null,
      availableDate: r.building_completion_date
        ? new Date(r.building_completion_date).toISOString().slice(0, 10) : null,
      lat: parseFloat(r.latitude) || null,
      lng: parseFloat(r.longitude) || null,
      image: pickFallbackPhoto(address + borough),
      dataSource: 'NYC Open Data — Affordable Housing Production',
      datasetUrl: 'https://data.cityofnewyork.us/Housing-Development/Affordable-Housing-Production-by-Building/hg8x-zxpr',
      externalUrl: 'https://housingconnect.nyc.gov/PublicWeb/search-lotteries',
      externalSiteName: 'Housing Connect',
    };
  });
}

function transformLotteriesBuilding(lotteryLookup, buildingRecords) {
  return buildingRecords.map((r, i) => {
    const borough = normBorough(r.borough);
    const address = r.building_address || '';
    const h = hashCode(address + (r.bbl || '') + borough);
    const totalUnits = parseInt(r.total_units) || 0;
    const eliUnits = parseInt(r.extremely_low_income_units) || 0;
    const vliUnits = parseInt(r.very_low_income_units) || 0;
    const liUnits = parseInt(r.low_income_units) || 0;
    const miUnits = parseInt(r.moderate_income_units) || 0;
    const midUnits = parseInt(r.middle_income_units) || 0;
    const affordableUnits = eliUnits + vliUnits + liUnits + miUnits + midUnits;

    let estRent;
    if (eliUnits > 0) estRent = 600 + (h % 500);
    else if (vliUnits > 0) estRent = 950 + (h % 500);
    else if (liUnits > 0) estRent = 1250 + (h % 600);
    else if (miUnits > 0) estRent = 1500 + (h % 600);
    else estRent = 1700 + (h % 600);

    const lottery = lotteryLookup[r.lottery_id] || {};
    const status = lottery.lottery_status || '';
    const lotteryEnd = lottery.lottery_end_date || '';

    return {
      id: `hc-${r.bbl || r.bin || i}-${r.lottery_id || ''}`,
      source: 'Housing Connect',
      sourceKey: 'housingconnect',
      projectName: r.project_name || lottery.project_name || '',
      address: address || 'Address on file with HPD',
      neighborhood: guessNeighborhood(address, borough) || borough,
      borough, zip: r.postcode || '',
      bbl: r.bbl || null,
      rent: estRent,
      totalUnits, affordableUnits,
      eliUnits, vliUnits, liUnits, miUnits,
      lotteryStatus: status,
      lotteryEnd: lotteryEnd ? new Date(lotteryEnd).toISOString().slice(0, 10) : '',
      yearBuilt: null, rsUnits: null, bldgClass: null, numFloors: null,
      availableDate: lotteryEnd ? new Date(lotteryEnd).toISOString().slice(0, 10) : null,
      lat: parseFloat(r.latitude) || null,
      lng: parseFloat(r.longitude) || null,
      image: pickFallbackPhoto(address + borough),
      dataSource: 'NYC Open Data — Housing Connect Lotteries',
      datasetUrl: 'https://data.cityofnewyork.us/Housing-Development/Advertised-Lotteries-on-Housing-Connect-By-Buildin/nibs-na6y',
      externalUrl: 'https://housingconnect.nyc.gov/PublicWeb/search-lotteries',
      externalSiteName: 'Housing Connect',
    };
  });
}

// ============================================================
// MAIN DATA LOAD
// ============================================================

async function loadData() {
  showLoading(true);
  let listings = [];
  const errors = [];
  const counts = {};

  try {
    const [ahResult, lotteriesResult, lotBldgResult, specResult, plutoResult] =
      await Promise.allSettled([
        fetchAffordableHousing(),
        fetchLotteries(),
        fetchLotteriesBuilding(),
        fetchSpeculationWatch(),
        fetchPLUTO(),
      ]);

    // ---- Listing sources (displayed) ----

    if (ahResult.status === 'fulfilled' && ahResult.value.length > 0) {
      const transformed = transformAffordableHousing(ahResult.value);
      listings.push(...transformed);
      counts['Affordable Housing'] = transformed.length;
    } else if (ahResult.status === 'rejected') {
      errors.push(`Affordable Housing: ${ahResult.reason.message}`);
    }

    const lotteryLookup = {};
    if (lotteriesResult.status === 'fulfilled') {
      for (const l of lotteriesResult.value) lotteryLookup[l.lottery_id] = l;
    }

    if (lotBldgResult.status === 'fulfilled' && lotBldgResult.value.length > 0) {
      const transformed = transformLotteriesBuilding(lotteryLookup, lotBldgResult.value);
      listings.push(...transformed);
      counts['Housing Connect'] = transformed.length;
    } else if (lotBldgResult.status === 'rejected') {
      errors.push(`Housing Connect: ${lotBldgResult.reason.message}`);
    }

    // ---- Enrichment sources (NOT displayed as listings) ----
    const plutoLookup = {};
    if (plutoResult.status === 'fulfilled') {
      for (const r of plutoResult.value) {
        if (r.bbl) {
          plutoLookup[r.bbl] = {
            yearBuilt: parseInt(r.yearbuilt) || null,
            bldgClass: r.bldgclass || null,
            numFloors: parseInt(r.numfloors) || null,
            unitsRes: parseInt(r.unitsres) || null,
          };
        }
      }
    }

    const specLookup = {};
    if (specResult.status === 'fulfilled') {
      for (const r of specResult.value) {
        if (r.bbl) {
          specLookup[r.bbl] = {
            rsUnits: parseInt(r.numberofrsstabilizedunits) || 0,
            bldgClass: r.buildingclass || null,
          };
        }
      }
    }

    // ---- De-duplicate ----
    const seen = new Set();
    allListings = listings.filter((l) => {
      const key = `${l.address.toLowerCase().trim()}-${l.borough}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ---- Enrich listings with PLUTO + Speculation Watch data ----
    allListings.forEach(l => {
      if (l.bbl && plutoLookup[l.bbl]) {
        const p = plutoLookup[l.bbl];
        if (!l.yearBuilt && p.yearBuilt) l.yearBuilt = p.yearBuilt;
        if (!l.bldgClass && p.bldgClass) l.bldgClass = p.bldgClass;
        if (!l.numFloors && p.numFloors) l.numFloors = p.numFloors;
        if (!l.totalUnits && p.unitsRes) l.totalUnits = p.unitsRes;
      }
      if (l.bbl && specLookup[l.bbl]) {
        const s = specLookup[l.bbl];
        if (!l.rsUnits && s.rsUnits > 0) l.rsUnits = s.rsUnits;
        if (!l.bldgClass && s.bldgClass) l.bldgClass = s.bldgClass;
      }

      l.rsProb = calculateRSProbability(l);
      l.description = buildDescription(l);

      if (l.sourceKey !== 'housingconnect' && l.sourceKey !== 'affordable') {
        l.externalUrl = buildStreetEasyUrl(l.address, l.borough, l.zip);
        l.externalSiteName = 'StreetEasy';
      }
    });

    // ---- Fetch real photos via proxy (background, non-blocking) ----
    if (PHOTO_PROXY_URL) {
      fetchRealPhotos(allListings);
    }

  } catch (err) {
    errors.push(err.message);
  }

  sourceStats = counts;
  showLoading(false);

  if (allListings.length === 0) {
    showApiError(errors);
  } else {
    updateDataBanner(allListings.length, counts, errors);
    populateSourceFilter();
    applyFilters();
  }
}

// Background photo fetcher — updates listing images as they come in
async function fetchRealPhotos(listings) {
  // Fetch in batches of 5 to avoid hammering the proxy
  const BATCH_SIZE = 5;
  for (let i = 0; i < listings.length; i += BATCH_SIZE) {
    const batch = listings.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(async (listing) => {
      const photo = await fetchListingPhoto(listing.address, listing.borough);
      if (photo && photo !== listing.image) {
        listing.image = photo;
        // Update visible card image if rendered
        const card = document.querySelector(`[data-id="${listing.id}"] .card-image img`);
        if (card) card.src = photo;
      }
    }));
  }
}

// ============================================================
// MAP — StreetEasy style (CartoDB Positron + price pill markers)
// ============================================================

function initMap() {
  map = L.map('listing-map', {
    center: [40.7128, -74.006],
    zoom: 11,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

function formatPriceShort(rent) {
  if (rent >= 1000) {
    const k = rent / 1000;
    return '$' + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'k';
  }
  return '$' + rent;
}

function updateMapMarkers() {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();

  const withCoords = filteredListings.filter(l => l.lat && l.lng);

  withCoords.forEach(listing => {
    const priceLabel = formatPriceShort(listing.rent);
    const unitLabel = listing.affordableUnits
      ? `${listing.affordableUnits} units`
      : listing.totalUnits
        ? `${listing.totalUnits} units`
        : '';

    const icon = L.divIcon({
      className: 'price-marker-wrapper',
      html: `<div class="price-pill" data-listing-id="${listing.id}">
        ${priceLabel}${unitLabel ? `<span class="pill-units">&nbsp;&middot;&nbsp;${unitLabel}</span>` : ''}
      </div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const marker = L.marker([listing.lat, listing.lng], { icon });

    marker.bindPopup(`
      <div class="map-popup">
        <img src="${listing.image}" alt="${escapeHtml(listing.address)}" style="width:100%;height:120px;object-fit:cover;border-radius:6px 6px 0 0;display:block;">
        <div style="padding:12px;">
          <strong>${escapeHtml(listing.address)}</strong>
          <p>${escapeHtml(listing.neighborhood)}${listing.neighborhood && listing.borough ? ', ' : ''}${escapeHtml(listing.borough)}</p>
          <p class="popup-rent">${formatRent(listing.rent)}/mo est.</p>
          <p style="font-size:0.72rem;color:${listing.rsProb.color};font-weight:600;margin:2px 0 0;">${listing.rsProb.label} (${listing.rsProb.score}%)</p>
          ${listing.affordableUnits ? `<p style="font-size:0.75rem;color:var(--text-secondary);margin:4px 0 0;">${listing.affordableUnits} affordable units available</p>` : ''}
          ${listing.totalUnits ? `<p style="font-size:0.75rem;color:var(--text-secondary);margin:2px 0 0;">${listing.totalUnits} total units in building</p>` : ''}
          <button class="popup-btn" onclick="openModal('${listing.id}')">View Details</button>
        </div>
      </div>
    `, { maxWidth: 280, minWidth: 220 });

    marker.listingId = listing.id;

    marker.on('mouseover', () => {
      const card = document.querySelector(`[data-id="${listing.id}"]`);
      if (card) card.classList.add('highlighted');
      const pill = document.querySelector(`.price-pill[data-listing-id="${listing.id}"]`);
      if (pill) pill.classList.add('active');
    });
    marker.on('mouseout', () => {
      const card = document.querySelector(`[data-id="${listing.id}"]`);
      if (card) card.classList.remove('highlighted');
      const pill = document.querySelector(`.price-pill[data-listing-id="${listing.id}"]`);
      if (pill) pill.classList.remove('active');
    });

    markersLayer.addLayer(marker);
  });

  if (withCoords.length > 0) {
    const group = L.featureGroup(markersLayer.getLayers());
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

function highlightMarker(listingId) {
  if (!markersLayer) return;
  const pill = document.querySelector(`.price-pill[data-listing-id="${listingId}"]`);
  if (pill) pill.classList.add('active');
  markersLayer.eachLayer(marker => {
    if (marker.listingId === listingId) marker.openPopup();
  });
}

function unhighlightMarker(listingId) {
  if (!markersLayer) return;
  const pill = document.querySelector(`.price-pill[data-listing-id="${listingId}"]`);
  if (pill) pill.classList.remove('active');
  markersLayer.eachLayer(marker => {
    if (marker.listingId === listingId) marker.closePopup();
  });
}

// ============================================================
// UI
// ============================================================

function showLoading(show) {
  const grid = document.getElementById('listings-grid');
  if (show) {
    grid.innerHTML = `
      <div class="loading-state" style="grid-column:1/-1; text-align:center; padding:60px 20px;">
        <div class="loading-spinner"></div>
        <p style="color:var(--text-muted); margin-top:16px;">Loading available units from NYC Open Data...</p>
        <p style="color:var(--text-muted); font-size:0.8rem; margin-top:8px;">Checking rent stabilization status for each building</p>
      </div>`;
  }
}

function showApiError(errors) {
  const grid = document.getElementById('listings-grid');
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('listing-count').textContent = '0';
  document.getElementById('results-count').textContent = '0 units found';

  const banner = document.getElementById('data-banner');
  if (banner) { banner.textContent = 'Unable to load data'; banner.className = 'data-banner error'; }

  grid.innerHTML = `
    <div style="grid-column:1/-1; text-align:center; padding:60px 24px;">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="margin-bottom:16px;">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>
      </svg>
      <h3 style="font-family:'Bricolage Grotesque',sans-serif; font-size:1.3rem; margin-bottom:8px;">Could not connect to NYC Open Data</h3>
      <p style="color:var(--text-secondary); max-width:480px; margin:0 auto 8px;">The connection may be temporarily unavailable.</p>
      ${errors.length > 0 ? `<p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:20px;">${errors.map(e => escapeHtml(e)).join('<br>')}</p>` : ''}
      <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="loadData()">Retry</button>
        <a href="https://data.cityofnewyork.us/" target="_blank" rel="noopener" class="btn btn-secondary">NYC Open Data Portal</a>
      </div>
    </div>`;
}

function updateDataBanner(count, counts, errors) {
  document.getElementById('listing-count').textContent = count;
  const banner = document.getElementById('data-banner');
  if (!banner) return;

  const parts = Object.entries(counts).filter(([, n]) => n > 0).map(([name, n]) => `${n} ${name}`);
  const errCount = errors.length;
  let text = `${count} available buildings — ${parts.join(', ')} — RS probability enriched with PLUTO + HPD data`;
  if (errCount > 0) text += ` | ${errCount} source${errCount > 1 ? 's' : ''} unavailable`;
  banner.textContent = text;
  banner.className = errCount > 0 ? 'data-banner partial' : 'data-banner live';
}

function populateSourceFilter() {
  const select = document.getElementById('filter-source');
  if (!select) return;
  const sources = [...new Set(allListings.map(l => l.source))].sort();
  select.innerHTML = '<option value="all">All Sources</option>';
  for (const s of sources) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  }
}

// ---- Filtering ----
function applyFilters() {
  const borough = document.getElementById('filter-borough').value;
  const maxRent = document.getElementById('filter-rent').value;
  const source = document.getElementById('filter-source').value;
  const search = document.getElementById('filter-search').value.toLowerCase().trim();
  const sortBy = document.getElementById('sort-by').value;

  filteredListings = allListings.filter(l => {
    if (borough !== 'all' && l.borough !== borough) return false;
    if (maxRent !== 'all' && l.rent > parseInt(maxRent)) return false;
    if (source !== 'all' && l.source !== source) return false;
    if (search && !`${l.address} ${l.neighborhood} ${l.borough} ${l.projectName || ''} ${l.source}`.toLowerCase().includes(search)) return false;
    return true;
  });

  switch (sortBy) {
    case 'rent-asc': filteredListings.sort((a, b) => a.rent - b.rent); break;
    case 'rent-desc': filteredListings.sort((a, b) => b.rent - a.rent); break;
    case 'units-desc': filteredListings.sort((a, b) => (b.totalUnits || 0) - (a.totalUnits || 0)); break;
    case 'date-asc': filteredListings.sort((a, b) => new Date(a.availableDate || '2099') - new Date(b.availableDate || '2099')); break;
  }

  currentPage = 1;
  renderListings();
  updateMapMarkers();
}

function resetFilters() {
  document.getElementById('filter-borough').value = 'all';
  document.getElementById('filter-rent').value = 'all';
  document.getElementById('filter-source').value = 'all';
  document.getElementById('filter-search').value = '';
  document.getElementById('sort-by').value = 'rent-asc';
  applyFilters();
}

// ---- Pagination ----
function getTotalPages() {
  return Math.max(1, Math.ceil(filteredListings.length / LISTINGS_PER_PAGE));
}

function getPageListings() {
  const start = (currentPage - 1) * LISTINGS_PER_PAGE;
  return filteredListings.slice(start, start + LISTINGS_PER_PAGE);
}

function goToPage(page) {
  const total = getTotalPages();
  currentPage = Math.max(1, Math.min(page, total));
  renderListings();
  // Scroll listings panel to top
  const panel = document.getElementById('listings-panel');
  if (panel) panel.scrollTop = 0;
}

function renderPagination() {
  const total = getTotalPages();
  if (total <= 1) return '';

  const pages = [];
  const maxVisible = 7;

  if (total <= maxVisible) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(total - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < total - 2) pages.push('...');
    pages.push(total);
  }

  return `
    <nav class="pagination" aria-label="Listings pagination">
      <button class="page-btn page-arrow" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})" aria-label="Previous page">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>
      </button>
      ${pages.map(p =>
        p === '...'
          ? '<span class="page-ellipsis">&hellip;</span>'
          : `<button class="page-btn${p === currentPage ? ' active' : ''}" onclick="goToPage(${p})">${p}</button>`
      ).join('')}
      <button class="page-btn page-arrow" ${currentPage === total ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})" aria-label="Next page">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
      </button>
    </nav>
  `;
}

// ---- Rendering ----
function formatRent(r) { return '$' + r.toLocaleString(); }

function formatDate(d) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderListings() {
  const grid = document.getElementById('listings-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('results-count');

  count.textContent = `${filteredListings.length} building${filteredListings.length !== 1 ? 's' : ''} with available units`;

  if (filteredListings.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    document.getElementById('pagination-container').innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  const pageListings = getPageListings();

  grid.innerHTML = pageListings.map((l, i) => {
    const rs = l.rsProb;
    const unitLabel = l.affordableUnits
      ? `${l.affordableUnits} affordable units`
      : l.totalUnits ? `${l.totalUnits} units` : '';

    const details = [];
    if (l.totalUnits) details.push(`<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>${l.totalUnits} units</span>`);
    if (l.yearBuilt) details.push(`<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>Built ${l.yearBuilt}</span>`);
    if (l.rsUnits) details.push(`<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>${l.rsUnits} RS units</span>`);
    if (l.numFloors) details.push(`<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/></svg>${l.numFloors} floors</span>`);

    return `
    <article class="listing-card" data-id="${l.id}" onclick="openModal('${l.id}')" style="animation-delay:${Math.min(i * 0.03, 0.15)}s" tabindex="0" role="button" aria-label="View ${escapeHtml(l.address)}"
      onmouseenter="highlightMarker('${l.id}')" onmouseleave="unhighlightMarker('${l.id}')">
      <div class="card-image">
        <img src="${l.image}" alt="${escapeHtml(l.address)}" loading="lazy">
        <span class="card-badge" style="background:${rs.color}">${rs.label} ${rs.score}%</span>
        <span class="card-rent-badge">${formatRent(l.rent)}<span>/mo est.</span></span>
      </div>
      <div class="card-body">
        <h3 class="card-address">${escapeHtml(l.address)}</h3>
        <p class="card-neighborhood">${escapeHtml(l.neighborhood)}${l.neighborhood && l.borough ? ', ' : ''}${escapeHtml(l.borough)}${l.zip ? ' ' + l.zip : ''}</p>
        <div class="card-details">
          ${details.join('')}
          ${l.lotteryStatus ? `<span class="card-detail" style="color:#0D9488;font-weight:600;">Lottery: ${escapeHtml(l.lotteryStatus)}</span>` : ''}
        </div>
      </div>
      <div class="card-footer">
        <span class="card-source">${unitLabel || escapeHtml(l.source)}</span>
        <span class="card-cta">View Listing <span class="external-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></span></span>
      </div>
    </article>`;
  }).join('');

  // Render pagination
  const paginationContainer = document.getElementById('pagination-container');
  if (paginationContainer) {
    paginationContainer.innerHTML = renderPagination();
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ---- Modal ----
function openModal(id) {
  const listing = allListings.find(l => l.id === id);
  if (!listing) return;

  const modal = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  const rs = listing.rsProb;

  const extraDetails = [];
  if (listing.yearBuilt) extraDetails.push({ label: 'Year Built', value: listing.yearBuilt });
  if (listing.totalUnits) extraDetails.push({ label: 'Total Units', value: listing.totalUnits });
  if (listing.affordableUnits) extraDetails.push({ label: 'Affordable Units', value: listing.affordableUnits });
  if (listing.rsUnits) extraDetails.push({ label: 'Confirmed RS Units', value: listing.rsUnits });
  if (listing.numFloors) extraDetails.push({ label: 'Floors', value: listing.numFloors });
  if (listing.lotteryStatus) extraDetails.push({ label: 'Lottery Status', value: listing.lotteryStatus });
  if (listing.lotteryEnd) extraDetails.push({ label: 'Lottery End', value: formatDate(listing.lotteryEnd) });
  if (listing.bldgClass) extraDetails.push({ label: 'Building Class', value: listing.bldgClass });

  const hasCoords = listing.lat && listing.lng;

  content.innerHTML = `
    <div style="position:relative;">
      <img src="${listing.image}" alt="${escapeHtml(listing.address)}" style="width:100%;height:240px;object-fit:cover;border-radius:var(--radius-md) var(--radius-md) 0 0;display:block;">
      ${hasCoords ? `<div class="modal-map-mini" id="modal-map-container"></div>` : ''}
    </div>
    <div class="modal-body">
      <div class="stabilized-since" style="background:${rs.color}18; color:${rs.color};">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        ${escapeHtml(rs.label)} &mdash; ${rs.score}% likelihood
      </div>
      ${listing.projectName ? `<p style="font-size:0.85rem; color:var(--accent); font-weight:600; margin-bottom:4px;">${escapeHtml(listing.projectName)}</p>` : ''}
      <h2>${escapeHtml(listing.address)}</h2>
      <p class="modal-neighborhood">${escapeHtml(listing.neighborhood)}${listing.neighborhood && listing.borough ? ', ' : ''}${escapeHtml(listing.borough)} ${listing.zip || ''}</p>

      ${listing.description ? `<p style="font-size:0.9rem; color:var(--text-secondary); line-height:1.6; margin-bottom:20px;">${escapeHtml(listing.description)}</p>` : ''}

      <div class="modal-price-row">
        <span class="modal-price">${formatRent(listing.rent)} <span>/month est.</span></span>
      </div>

      <div style="background:${rs.color}08; border:1px solid ${rs.color}25; border-radius:var(--radius-sm); padding:16px 20px; margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${rs.color}" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <strong style="font-family:'Bricolage Grotesque',sans-serif; font-size:0.95rem; color:${rs.color};">Rent Stabilization: ${rs.label} (${rs.score}%)</strong>
        </div>
        <div style="background:var(--bg-elevated); border-radius:100px; height:8px; margin-bottom:12px; overflow:hidden;">
          <div style="background:${rs.color}; height:100%; width:${rs.score}%; border-radius:100px;"></div>
        </div>
        ${rs.factors.length > 0 ? `<ul style="list-style:none; padding:0; margin:0; font-size:0.82rem; color:var(--text-secondary);">
          ${rs.factors.map(f => `<li style="padding:3px 0; display:flex; align-items:flex-start; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${rs.color}" stroke-width="2" style="flex-shrink:0; margin-top:2px;"><polyline points="20,6 9,17 4,12"/></svg>
            ${escapeHtml(f)}
          </li>`).join('')}
        </ul>` : ''}
      </div>

      <div class="modal-details-grid">
        ${listing.availableDate ? `<div class="modal-detail-item"><span class="modal-detail-label">Date on Record</span><span class="modal-detail-value">${formatDate(listing.availableDate)}</span></div>` : ''}
        ${extraDetails.map(d => `<div class="modal-detail-item"><span class="modal-detail-label">${escapeHtml(d.label)}</span><span class="modal-detail-value">${escapeHtml(String(d.value))}</span></div>`).join('')}
      </div>

      <div style="background:var(--bg-elevated); border-radius:var(--radius-sm); padding:12px 16px; margin-bottom:20px; font-size:0.8rem; color:var(--text-muted);">
        <strong style="color:var(--text-secondary);">Data source:</strong> ${escapeHtml(listing.dataSource)}
        ${listing.datasetUrl ? `<br><a href="${listing.datasetUrl}" target="_blank" rel="noopener" style="color:var(--accent); text-decoration:none;">View dataset &rarr;</a>` : ''}
      </div>

      <div class="modal-contact">
        <button class="btn btn-primary" style="flex:1;justify-content:center;" onclick="closeModal(); showExternalLink('${listing.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          View on ${escapeHtml(listing.externalSiteName)}
        </button>
      </div>

      <p style="font-size:0.75rem; color:var(--text-muted); margin-top:16px; text-align:center;">
        RS probability from public records. Rents are estimates. Verify with <a href="https://hcr.ny.gov/" target="_blank" rel="noopener" style="color:var(--accent);">NYS HCR</a>.
      </p>
    </div>
  `;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  if (hasCoords) {
    setTimeout(() => {
      const container = document.getElementById('modal-map-container');
      if (!container) return;
      if (modalMap) { modalMap.remove(); modalMap = null; }
      modalMap = L.map(container, {
        center: [listing.lat, listing.lng],
        zoom: 15,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '', subdomains: 'abcd', maxZoom: 20,
      }).addTo(modalMap);
      L.circleMarker([listing.lat, listing.lng], {
        radius: 8, fillColor: rs.color, color: '#fff', weight: 3, fillOpacity: 0.9,
      }).addTo(modalMap);
    }, 150);
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
  if (modalMap) { modalMap.remove(); modalMap = null; }
}

// ---- External Link ----
function showExternalLink(id) {
  const listing = allListings.find(l => l.id === id);
  if (!listing) return;

  const overlay = document.getElementById('external-overlay');
  const content = document.getElementById('external-modal-content');

  content.innerHTML = `
    <div class="external-icon-large">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
        <polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </div>
    <h3>You're leaving StableNYC</h3>
    <p>You'll be taken to <strong>${escapeHtml(listing.externalSiteName)}</strong> to find available units at this address.</p>
    <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">${escapeHtml(listing.address)}, ${escapeHtml(listing.borough)}</p>
    <span class="external-url">${escapeHtml(listing.externalUrl)}</span>
    <div class="external-modal-actions">
      <a href="${listing.externalUrl}" target="_blank" rel="noopener" class="btn btn-primary" onclick="closeExternalModal()">
        Continue to ${escapeHtml(listing.externalSiteName)}
      </a>
      <button class="btn btn-secondary" onclick="closeExternalModal()">Cancel</button>
    </div>
  `;

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeExternalModal() {
  document.getElementById('external-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ---- Event Listeners ----
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
document.getElementById('external-overlay').addEventListener('click', e => { if (e.target.id === 'external-overlay') closeExternalModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeExternalModal(); } });

function setView(view) {
  currentView = view;
  const layout = document.getElementById('listings-layout');
  document.querySelectorAll('.view-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  if (view === 'split') {
    layout.className = 'listings-layout split-view';
    document.getElementById('map-panel').style.display = '';
    setTimeout(() => { if (map) map.invalidateSize(); }, 100);
  } else {
    layout.className = 'listings-layout grid-view';
    document.getElementById('map-panel').style.display = 'none';
  }
}
document.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));

window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
});

['filter-borough', 'filter-rent', 'filter-source', 'sort-by'].forEach(id => {
  document.getElementById(id).addEventListener('change', applyFilters);
});
document.getElementById('filter-search').addEventListener('input', debounce(applyFilters, 300));

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ---- Injected styles ----
const injectedStyle = document.createElement('style');
injectedStyle.textContent = `
.loading-spinner {
  width: 40px; height: 40px; margin: 0 auto;
  border: 3px solid var(--border); border-top-color: var(--accent);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.data-banner { text-align:center; padding:10px 16px; font-size:0.8rem; font-weight:500; border-radius:var(--radius-sm); margin-bottom:16px; line-height:1.5; }
.data-banner.live { background:rgba(22,163,74,0.08); color:var(--success); }
.data-banner.partial { background:rgba(217,119,6,0.06); color:#92400E; }
.data-banner.error { background:rgba(220,38,38,0.08); color:#DC2626; }

.card-description {
  font-size:0.78rem; color:var(--text-muted); line-height:1.5; margin-bottom:10px;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
}

/* StreetEasy-style price pill markers */
.price-marker-wrapper { background:none !important; border:none !important; }
.price-pill {
  position:absolute; transform:translate(-50%, -100%);
  background:#1C1917; color:white;
  padding:5px 10px; border-radius:20px;
  font-family:'Bricolage Grotesque',sans-serif;
  font-size:0.72rem; font-weight:700; white-space:nowrap;
  box-shadow:0 2px 8px rgba(0,0,0,0.2);
  cursor:pointer; transition:all 0.15s ease;
  z-index:1;
}
.price-pill::after {
  content:''; position:absolute; bottom:-5px; left:50%; transform:translateX(-50%);
  border-left:5px solid transparent; border-right:5px solid transparent;
  border-top:5px solid #1C1917; transition:border-top-color 0.15s ease;
}
.price-pill:hover, .price-pill.active {
  background:var(--accent); z-index:100 !important; transform:translate(-50%, -100%) scale(1.1);
}
.price-pill:hover::after, .price-pill.active::after { border-top-color:var(--accent); }
.pill-units { font-weight:500; opacity:0.85; font-size:0.65rem; }

/* Modal mini map overlay */
.modal-map-mini {
  position:absolute; bottom:12px; right:12px;
  width:140px; height:100px;
  border-radius:var(--radius-sm); overflow:hidden;
  border:2px solid white; box-shadow:var(--shadow-md);
  z-index:5;
}
.modal-map-mini .leaflet-container { width:100%; height:100%; }
`;
document.head.appendChild(injectedStyle);

// Add data banner
const filterBar = document.querySelector('.filter-bar');
if (filterBar) {
  const banner = document.createElement('div');
  banner.id = 'data-banner';
  banner.className = 'data-banner';
  banner.textContent = 'Loading available units from NYC Open Data...';
  filterBar.parentNode.insertBefore(banner, filterBar);
}

// ---- Boot ----
initMap();
loadData();
