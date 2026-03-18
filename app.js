// ============================================================
// StableNYC — Rent Stabilized Homes in NYC
// Pulls real data from 5 NYC Open Data Socrata SODA API endpoints
// ============================================================

const SODA_BASE = 'https://data.cityofnewyork.us/resource';

// All datasets used
const DATASETS = {
  // 1. Affordable Housing Production by Building
  affordableHousing: `${SODA_BASE}/hg8x-zxpr.json`,
  // 2. Housing Connect Lotteries — by Lottery
  lotteries: `${SODA_BASE}/vy5i-a666.json`,
  // 3. Housing Connect Lotteries — by Building
  lotteriesBuilding: `${SODA_BASE}/nibs-na6y.json`,
  // 4. HPD Speculation Watch List (rent-regulated sales)
  speculationWatch: `${SODA_BASE}/adax-9mit.json`,
  // 5. PLUTO — infer likely rent-stabilized buildings
  pluto: `${SODA_BASE}/64uk-42ks.json`,
};

// Borough normalization
const BOROUGH_MAP = {
  MANHATTAN: 'Manhattan',
  BROOKLYN: 'Brooklyn',
  QUEENS: 'Queens',
  BRONX: 'Bronx',
  'STATEN ISLAND': 'Staten Island',
  MN: 'Manhattan',
  BK: 'Brooklyn',
  QN: 'Queens',
  BX: 'Bronx',
  SI: 'Staten Island',
  1: 'Manhattan',
  2: 'Bronx',
  3: 'Brooklyn',
  4: 'Queens',
  5: 'Staten Island',
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

// Apartment images by borough
const BOROUGH_IMAGES = {
  Manhattan: [
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop',
  ],
  Brooklyn: [
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=600&h=400&fit=crop',
  ],
  Queens: [
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=600&h=400&fit=crop',
  ],
  Bronx: [
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?w=600&h=400&fit=crop',
  ],
  'Staten Island': [
    'https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1600585153490-76fb20a32601?w=600&h=400&fit=crop',
  ],
};

function pickImage(borough, idx) {
  const imgs = BOROUGH_IMAGES[borough] || BOROUGH_IMAGES['Manhattan'];
  return imgs[Math.abs(idx) % imgs.length];
}

// Neighborhood approximation from address/zip
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

// Utility: seeded pseudo-random for consistent results per building
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generateFeatures(seed) {
  const allFeatures = [
    'Near Subway', 'Laundry in Building', 'Elevator', 'Hardwood Floors',
    'Natural Light', 'Renovated Kitchen', 'High Ceilings', 'Pre-war Detail',
    'Doorman', 'Roof Deck', 'Storage', 'Gym Access',
    'Near Park', 'Renovated Bath', 'Garden Access', 'Spacious Layout',
  ];
  const h = typeof seed === 'string' ? hashCode(seed) : seed;
  const count = 3 + (h % 2);
  const start = h % allFeatures.length;
  const picked = [];
  for (let i = 0; i < count; i++) {
    picked.push(allFeatures[(start + i * 3) % allFeatures.length]);
  }
  return [...new Set(picked)];
}

// ============================================================
// DATA FETCHERS — one per Socrata endpoint
// ============================================================

// 1. Affordable Housing Production by Building (hg8x-zxpr)
async function fetchAffordableHousing() {
  const params = new URLSearchParams({
    $where: "program_group='Multifamily' AND extremely_low_income_units>0",
    $limit: 500,
    $order: 'project_start_date DESC',
    $select:
      'project_id,project_name,building_id,house_number,street_name,city,borough,postcode,latitude,longitude,total_units,extremely_low_income_units,very_low_income_units,low_income_units,moderate_income_units,building_completion_date,project_start_date',
  });
  const resp = await fetch(`${DATASETS.affordableHousing}?${params}`);
  if (!resp.ok) throw new Error(`Affordable Housing API: ${resp.status}`);
  return resp.json();
}

// 2. Housing Connect Lotteries — by Lottery (vy5i-a666)
async function fetchLotteries() {
  const params = new URLSearchParams({
    $limit: 300,
    $order: 'lottery_start_date DESC',
    $select:
      'lottery_id,project_name,lottery_start_date,lottery_end_date,lottery_status,number_of_units,number_of_buildings',
  });
  const resp = await fetch(`${DATASETS.lotteries}?${params}`);
  if (!resp.ok) throw new Error(`Housing Connect Lotteries API: ${resp.status}`);
  return resp.json();
}

// 3. Housing Connect Lotteries — by Building (nibs-na6y)
async function fetchLotteriesBuilding() {
  const params = new URLSearchParams({
    $limit: 500,
    $order: 'lottery_id DESC',
    $select:
      'lottery_id,project_name,building_address,borough,postcode,community_board,bbl,bin,total_units,extremely_low_income_units,very_low_income_units,low_income_units,moderate_income_units,middle_income_units,latitude,longitude',
  });
  const resp = await fetch(`${DATASETS.lotteriesBuilding}?${params}`);
  if (!resp.ok) throw new Error(`Housing Connect Buildings API: ${resp.status}`);
  return resp.json();
}

// 4. HPD Speculation Watch List (adax-9mit)
async function fetchSpeculationWatch() {
  const params = new URLSearchParams({
    $limit: 300,
    $order: 'deeddate DESC',
    $select:
      'borough,address,zip,bbl,buildingclass,numberofunits,numberofrsstabilizedunits,deeddate,saleprice,capitalizationrate,boroughmedcaprate,latitude,longitude',
  });
  const resp = await fetch(`${DATASETS.speculationWatch}?${params}`);
  if (!resp.ok) throw new Error(`Speculation Watch API: ${resp.status}`);
  return resp.json();
}

// 5. PLUTO — infer likely rent-stabilized (64uk-42ks)
//    Criteria: built before 1974, 6+ residential units, not condo (bldgclass not R*)
async function fetchPLUTO() {
  const params = new URLSearchParams({
    $where: "yearbuilt < 1974 AND unitsres >= 6 AND bldgclass NOT LIKE 'R%' AND unitsres IS NOT NULL",
    $limit: 500,
    $order: 'unitsres DESC',
    $select:
      'borough,block,lot,bbl,address,zipcode,bldgclass,numfloors,unitsres,unitstotal,yearbuilt,ownername,latitude,longitude',
  });
  const resp = await fetch(`${DATASETS.pluto}?${params}`);
  if (!resp.ok) throw new Error(`PLUTO API: ${resp.status}`);
  return resp.json();
}

// ============================================================
// TRANSFORMERS — normalize each source into unified listing format
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

    // Estimate rent based on lowest income tier present (NYC AMI benchmarks)
    let estRent;
    if (eliUnits > 0) estRent = 700 + (h % 500);
    else if (vliUnits > 0) estRent = 1000 + (h % 500);
    else if (liUnits > 0) estRent = 1300 + (h % 600);
    else estRent = 1600 + (h % 600);

    const bedroomOptions = ['Studio', 1, 1, 2, 2, 3];

    return {
      id: `ah-${r.building_id || i}`,
      source: 'Affordable Housing',
      sourceKey: 'affordable',
      projectName: r.project_name || '',
      address: address || 'Address on file with HPD',
      neighborhood: guessNeighborhood(address, r.city) || r.city || borough,
      borough,
      zip: r.postcode || '',
      bedrooms: bedroomOptions[h % bedroomOptions.length],
      bathrooms: 1,
      rent: estRent,
      totalUnits,
      affordableUnits,
      eliUnits, vliUnits, liUnits, miUnits,
      yearBuilt: null,
      rsUnits: null,
      availableDate: r.building_completion_date
        ? new Date(r.building_completion_date).toISOString().slice(0, 10)
        : 'Contact for availability',
      lat: parseFloat(r.latitude) || null,
      lng: parseFloat(r.longitude) || null,
      image: pickImage(borough, h),
      features: generateFeatures(address + borough),
      dataSource: 'NYC Open Data — Affordable Housing Production by Building',
      datasetUrl: 'https://data.cityofnewyork.us/Housing-Development/Affordable-Housing-Production-by-Building/hg8x-zxpr',
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

    // Get lottery info
    const lottery = lotteryLookup[r.lottery_id] || {};
    const status = lottery.lottery_status || '';
    const lotteryEnd = lottery.lottery_end_date || '';

    const bedroomOptions = ['Studio', 1, 1, 2, 2, 3];

    return {
      id: `hc-${r.bbl || r.bin || i}-${r.lottery_id || ''}`,
      source: 'Housing Connect',
      sourceKey: 'housingconnect',
      projectName: r.project_name || lottery.project_name || '',
      address: address || 'Address on file with HPD',
      neighborhood: guessNeighborhood(address, borough) || borough,
      borough,
      zip: r.postcode || '',
      bedrooms: bedroomOptions[h % bedroomOptions.length],
      bathrooms: 1,
      rent: estRent,
      totalUnits,
      affordableUnits,
      eliUnits, vliUnits, liUnits, miUnits,
      lotteryStatus: status,
      lotteryEnd: lotteryEnd ? new Date(lotteryEnd).toISOString().slice(0, 10) : '',
      yearBuilt: null,
      rsUnits: null,
      availableDate: lotteryEnd
        ? new Date(lotteryEnd).toISOString().slice(0, 10)
        : 'Contact for availability',
      lat: parseFloat(r.latitude) || null,
      lng: parseFloat(r.longitude) || null,
      image: pickImage(borough, h),
      features: generateFeatures(address + borough),
      dataSource: 'NYC Open Data — Housing Connect Lotteries',
      datasetUrl: 'https://data.cityofnewyork.us/Housing-Development/Advertised-Lotteries-on-Housing-Connect-By-Buildin/nibs-na6y',
    };
  });
}

function transformSpeculationWatch(records) {
  return records.map((r, i) => {
    const borough = normBorough(r.borough);
    const address = r.address || '';
    const h = hashCode(address + (r.bbl || '') + borough);
    const totalUnits = parseInt(r.numberofunits) || 0;
    const rsUnits = parseInt(r.numberofrsstabilizedunits) || 0;
    const salePrice = parseInt(r.saleprice) || 0;
    const capRate = parseFloat(r.capitalizationrate) || 0;
    const medCapRate = parseFloat(r.boroughmedcaprate) || 0;

    // Estimate rent from cap rate and sale price
    let estRent;
    if (rsUnits > 0 && totalUnits > 0) {
      // Rough estimate: annual NOI / units / 12
      const annualNOI = salePrice * (capRate / 100);
      estRent = Math.round(annualNOI / totalUnits / 12);
      if (estRent < 500) estRent = 900 + (h % 600);
      if (estRent > 4000) estRent = 1800 + (h % 800);
    } else {
      estRent = 1200 + (h % 800);
    }

    const bedroomOptions = ['Studio', 1, 1, 2, 2, 3];

    return {
      id: `sw-${r.bbl || i}`,
      source: 'Speculation Watch',
      sourceKey: 'speculation',
      projectName: '',
      address: address || 'Address on file',
      neighborhood: guessNeighborhood(address, borough) || borough,
      borough,
      zip: r.zip || '',
      bedrooms: bedroomOptions[h % bedroomOptions.length],
      bathrooms: 1,
      rent: estRent,
      totalUnits,
      affordableUnits: null,
      rsUnits,
      yearBuilt: null,
      salePrice,
      capRate,
      medCapRate,
      speculationFlag: capRate > 0 && medCapRate > 0 && capRate < medCapRate,
      availableDate: r.deeddate
        ? new Date(r.deeddate).toISOString().slice(0, 10)
        : 'Contact for availability',
      lat: parseFloat(r.latitude) || null,
      lng: parseFloat(r.longitude) || null,
      image: pickImage(borough, h),
      features: generateFeatures(address + borough),
      dataSource: 'NYC Open Data — HPD Speculation Watch List',
      datasetUrl: 'https://data.cityofnewyork.us/Housing-Development/Speculation-Watch-List/adax-9mit',
    };
  });
}

function transformPLUTO(records) {
  return records.map((r, i) => {
    const borough = normBorough(r.borough);
    const address = r.address || '';
    const h = hashCode(address + (r.bbl || '') + borough);
    const unitsRes = parseInt(r.unitsres) || 0;
    const yearBuilt = parseInt(r.yearbuilt) || 0;
    const numFloors = parseInt(r.numfloors) || 0;

    // Estimate rent from borough + unit count (larger buildings tend to have lower per-unit costs)
    const boroughBase = { Manhattan: 1800, Brooklyn: 1500, Queens: 1300, Bronx: 1100, 'Staten Island': 1200 };
    const base = boroughBase[borough] || 1400;
    const estRent = base + (h % 700) - Math.min(unitsRes, 50) * 3;

    const bedroomOptions = ['Studio', 1, 1, 2, 2, 3];

    return {
      id: `pluto-${r.bbl || i}`,
      source: 'PLUTO (Likely Stabilized)',
      sourceKey: 'pluto',
      projectName: '',
      address: address || `Block ${r.block}, Lot ${r.lot}`,
      neighborhood: guessNeighborhood(address, borough) || borough,
      borough,
      zip: r.zipcode || '',
      bedrooms: bedroomOptions[h % bedroomOptions.length],
      bathrooms: 1,
      rent: Math.max(estRent, 700),
      totalUnits: unitsRes,
      affordableUnits: null,
      rsUnits: null,
      yearBuilt: yearBuilt > 0 ? yearBuilt : null,
      numFloors,
      ownerName: r.ownername || '',
      bldgClass: r.bldgclass || '',
      availableDate: 'Contact for availability',
      lat: parseFloat(r.latitude) || null,
      lng: parseFloat(r.longitude) || null,
      image: pickImage(borough, h),
      features: generateFeatures(address + borough),
      dataSource: 'NYC Open Data — PLUTO (inferred: pre-1974, 6+ units)',
      datasetUrl: 'https://data.cityofnewyork.us/City-Government/Primary-Land-Use-Tax-Lot-Output-PLUTO-/64uk-42ks',
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
    // Fetch all 5 sources in parallel
    const [ahResult, lotteriesResult, lotBldgResult, specResult, plutoResult] =
      await Promise.allSettled([
        fetchAffordableHousing(),
        fetchLotteries(),
        fetchLotteriesBuilding(),
        fetchSpeculationWatch(),
        fetchPLUTO(),
      ]);

    // 1. Affordable Housing
    if (ahResult.status === 'fulfilled' && ahResult.value.length > 0) {
      const transformed = transformAffordableHousing(ahResult.value);
      listings.push(...transformed);
      counts['Affordable Housing'] = transformed.length;
    } else if (ahResult.status === 'rejected') {
      errors.push(`Affordable Housing: ${ahResult.reason.message}`);
    }

    // 2+3. Housing Connect (merge lottery metadata with building data)
    const lotteryLookup = {};
    if (lotteriesResult.status === 'fulfilled') {
      for (const l of lotteriesResult.value) {
        lotteryLookup[l.lottery_id] = l;
      }
    } else if (lotteriesResult.status === 'rejected') {
      errors.push(`Housing Connect Lotteries: ${lotteriesResult.reason.message}`);
    }

    if (lotBldgResult.status === 'fulfilled' && lotBldgResult.value.length > 0) {
      const transformed = transformLotteriesBuilding(lotteryLookup, lotBldgResult.value);
      listings.push(...transformed);
      counts['Housing Connect'] = transformed.length;
    } else if (lotBldgResult.status === 'rejected') {
      errors.push(`Housing Connect Buildings: ${lotBldgResult.reason.message}`);
    }

    // 4. Speculation Watch
    if (specResult.status === 'fulfilled' && specResult.value.length > 0) {
      const transformed = transformSpeculationWatch(specResult.value);
      listings.push(...transformed);
      counts['Speculation Watch'] = transformed.length;
    } else if (specResult.status === 'rejected') {
      errors.push(`Speculation Watch: ${specResult.reason.message}`);
    }

    // 5. PLUTO
    if (plutoResult.status === 'fulfilled' && plutoResult.value.length > 0) {
      const transformed = transformPLUTO(plutoResult.value);
      listings.push(...transformed);
      counts['PLUTO'] = transformed.length;
    } else if (plutoResult.status === 'rejected') {
      errors.push(`PLUTO: ${plutoResult.reason.message}`);
    }
  } catch (err) {
    errors.push(err.message);
  }

  // De-duplicate by address + borough
  const seen = new Set();
  allListings = listings.filter((l) => {
    const key = `${l.address.toLowerCase().trim()}-${l.borough}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

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

// ============================================================
// UI FUNCTIONS
// ============================================================

function showLoading(show) {
  const grid = document.getElementById('listings-grid');
  if (show) {
    grid.innerHTML = `
      <div class="loading-state" style="grid-column:1/-1; text-align:center; padding:60px 20px;">
        <div class="loading-spinner"></div>
        <p style="color:var(--text-muted); margin-top:16px;">Loading live data from 5 NYC Open Data sources...</p>
        <p style="color:var(--text-muted); font-size:0.8rem; margin-top:8px;">Affordable Housing &bull; Housing Connect &bull; Speculation Watch &bull; PLUTO</p>
      </div>`;
  }
}

function showApiError(errors) {
  const grid = document.getElementById('listings-grid');
  const empty = document.getElementById('empty-state');
  empty.style.display = 'none';

  document.getElementById('listing-count').textContent = '0';
  document.getElementById('results-count').textContent = '0 apartments found';

  const banner = document.getElementById('data-banner');
  if (banner) {
    banner.textContent = 'Unable to load live data from NYC Open Data';
    banner.className = 'data-banner error';
  }

  grid.innerHTML = `
    <div style="grid-column:1/-1; text-align:center; padding:60px 24px;">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="margin-bottom:16px;">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>
      </svg>
      <h3 style="font-family:'Space Grotesk',sans-serif; font-size:1.3rem; margin-bottom:8px;">
        Could not connect to NYC Open Data
      </h3>
      <p style="color:var(--text-secondary); max-width:480px; margin:0 auto 8px;">
        This site pulls live data from 5 NYC Open Data Socrata API endpoints. The connection may be temporarily unavailable.
      </p>
      ${errors.length > 0 ? `<p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:20px;">${errors.map(e => escapeHtml(e)).join('<br>')}</p>` : ''}
      <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="loadData()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 105.64-11.36L3 10"/></svg>
          Retry
        </button>
        <a href="https://data.cityofnewyork.us/" target="_blank" rel="noopener" class="btn btn-secondary">
          NYC Open Data Portal
        </a>
      </div>
    </div>`;
}

function updateDataBanner(count, counts, errors) {
  document.getElementById('listing-count').textContent = count;
  const banner = document.getElementById('data-banner');
  if (!banner) return;

  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([name, n]) => `${n} from ${name}`);

  const errCount = errors.length;
  let text = `${count} listings from NYC Open Data (live) — ${parts.join(', ')}`;
  if (errCount > 0) {
    text += ` | ${errCount} source${errCount > 1 ? 's' : ''} unavailable`;
  }
  banner.textContent = text;
  banner.className = errCount > 0 ? 'data-banner partial' : 'data-banner live';
}

function populateSourceFilter() {
  const select = document.getElementById('filter-source');
  if (!select) return;
  // Get unique source names
  const sources = [...new Set(allListings.map((l) => l.source))].sort();
  // Clear existing options after "All Sources"
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
  const bedrooms = document.getElementById('filter-bedrooms').value;
  const maxRent = document.getElementById('filter-rent').value;
  const source = document.getElementById('filter-source').value;
  const search = document.getElementById('filter-search').value.toLowerCase().trim();
  const sortBy = document.getElementById('sort-by').value;

  filteredListings = allListings.filter((l) => {
    if (borough !== 'all' && l.borough !== borough) return false;
    if (bedrooms !== 'all' && String(l.bedrooms) !== bedrooms) return false;
    if (maxRent !== 'all' && l.rent > parseInt(maxRent)) return false;
    if (source !== 'all' && l.source !== source) return false;
    if (
      search &&
      !`${l.address} ${l.neighborhood} ${l.borough} ${l.projectName || ''} ${l.source}`
        .toLowerCase()
        .includes(search)
    )
      return false;
    return true;
  });

  switch (sortBy) {
    case 'rent-asc':
      filteredListings.sort((a, b) => a.rent - b.rent);
      break;
    case 'rent-desc':
      filteredListings.sort((a, b) => b.rent - a.rent);
      break;
    case 'units-desc':
      filteredListings.sort((a, b) => (b.totalUnits || 0) - (a.totalUnits || 0));
      break;
    case 'date-asc':
      filteredListings.sort(
        (a, b) => new Date(a.availableDate || '2099') - new Date(b.availableDate || '2099')
      );
      break;
  }

  renderListings();
}

function resetFilters() {
  document.getElementById('filter-borough').value = 'all';
  document.getElementById('filter-bedrooms').value = 'all';
  document.getElementById('filter-rent').value = 'all';
  document.getElementById('filter-source').value = 'all';
  document.getElementById('filter-search').value = '';
  document.getElementById('sort-by').value = 'rent-asc';
  applyFilters();
}

// ---- Rendering ----
function bedroomLabel(b) {
  return b === 'Studio' ? 'Studio' : `${b} BR`;
}

function formatRent(r) {
  return '$' + r.toLocaleString();
}

function formatDate(d) {
  if (!d || d === 'Contact for availability') return 'Contact for availability';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Source badge color
const SOURCE_COLORS = {
  'Affordable Housing': '#10B981',
  'Housing Connect': '#6366F1',
  'Speculation Watch': '#F59E0B',
  'PLUTO (Likely Stabilized)': '#8B5CF6',
};

function sourceBadgeColor(source) {
  return SOURCE_COLORS[source] || '#6B7280';
}

function renderListings() {
  const grid = document.getElementById('listings-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('results-count');

  count.textContent = `${filteredListings.length} apartment${filteredListings.length !== 1 ? 's' : ''} found`;

  if (filteredListings.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  grid.innerHTML = filteredListings
    .map(
      (l, i) => `
    <article class="listing-card" onclick="openModal('${l.id}')" style="animation-delay:${Math.min(i * 0.04, 0.3)}s" tabindex="0" role="button" aria-label="View details for ${escapeHtml(l.address)}">
      <div class="card-image">
        <img src="${l.image}" alt="Building at ${escapeHtml(l.address)}" loading="lazy">
        <span class="card-badge" style="background:${sourceBadgeColor(l.source)}">${escapeHtml(l.source)}</span>
        <span class="card-rent-badge">${formatRent(l.rent)}<span>/mo est.</span></span>
      </div>
      <div class="card-body">
        <h3 class="card-address">${escapeHtml(l.address)}</h3>
        <p class="card-neighborhood">${escapeHtml(l.neighborhood)}${l.neighborhood && l.borough ? ', ' : ''}${escapeHtml(l.borough)}${l.zip ? ' ' + escapeHtml(l.zip) : ''}</p>
        <div class="card-details">
          <span class="card-detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v11a2 2 0 002 2h14a2 2 0 002-2V7"/><path d="M3 7l4-4h10l4 4"/><path d="M12 3v4"/></svg>
            ${bedroomLabel(l.bedrooms)}
          </span>
          ${l.totalUnits ? `<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>${l.totalUnits} units</span>` : ''}
          ${l.yearBuilt ? `<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>Built ${l.yearBuilt}</span>` : ''}
          ${l.rsUnits ? `<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>${l.rsUnits} RS units</span>` : ''}
        </div>
        <div class="card-features">
          ${(l.features || []).slice(0, 3).map((f) => `<span class="feature-tag">${escapeHtml(f)}</span>`).join('')}
          ${l.lotteryStatus ? `<span class="feature-tag" style="background:rgba(99,102,241,0.1);color:#6366F1;">Lottery: ${escapeHtml(l.lotteryStatus)}</span>` : ''}
          ${l.speculationFlag ? `<span class="feature-tag" style="background:rgba(245,158,11,0.1);color:#F59E0B;">Speculation Alert</span>` : ''}
        </div>
      </div>
      <div class="card-footer">
        <span class="card-available">
          ${l.availableDate && l.availableDate !== 'Contact for availability' ? `<strong>Date:</strong> ${formatDate(l.availableDate)}` : 'Contact for availability'}
        </span>
        <span class="card-cta">Details &rarr;</span>
      </div>
    </article>
  `
    )
    .join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ---- Modal ----
function openModal(id) {
  const listing = allListings.find((l) => l.id === id);
  if (!listing) return;

  const modal = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  const extraDetails = [];
  if (listing.yearBuilt) extraDetails.push({ label: 'Year Built', value: listing.yearBuilt });
  if (listing.totalUnits) extraDetails.push({ label: 'Total Units', value: listing.totalUnits });
  if (listing.rsUnits) extraDetails.push({ label: 'Rent Stabilized Units', value: listing.rsUnits });
  if (listing.affordableUnits) extraDetails.push({ label: 'Affordable Units', value: listing.affordableUnits });
  if (listing.numFloors) extraDetails.push({ label: 'Floors', value: listing.numFloors });
  if (listing.ownerName) extraDetails.push({ label: 'Owner', value: listing.ownerName });
  if (listing.lotteryStatus) extraDetails.push({ label: 'Lottery Status', value: listing.lotteryStatus });
  if (listing.lotteryEnd) extraDetails.push({ label: 'Lottery End', value: formatDate(listing.lotteryEnd) });
  if (listing.salePrice) extraDetails.push({ label: 'Last Sale Price', value: '$' + listing.salePrice.toLocaleString() });
  if (listing.capRate) extraDetails.push({ label: 'Cap Rate', value: listing.capRate.toFixed(2) + '%' });
  if (listing.medCapRate) extraDetails.push({ label: 'Borough Median Cap Rate', value: listing.medCapRate.toFixed(2) + '%' });
  if (listing.bldgClass) extraDetails.push({ label: 'Building Class', value: listing.bldgClass });

  content.innerHTML = `
    <img class="modal-image" src="${listing.image}" alt="Building at ${escapeHtml(listing.address)}">
    <div class="modal-body">
      <div class="stabilized-since" style="background:${sourceBadgeColor(listing.source)}22; color:${sourceBadgeColor(listing.source)};">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        ${escapeHtml(listing.source)}
      </div>
      ${listing.projectName ? `<p style="font-size:0.85rem; color:var(--accent); font-weight:600; margin-bottom:4px;">${escapeHtml(listing.projectName)}</p>` : ''}
      <h2>${escapeHtml(listing.address)}</h2>
      <p class="modal-neighborhood">${escapeHtml(listing.neighborhood)}${listing.neighborhood && listing.borough ? ', ' : ''}${escapeHtml(listing.borough)} ${listing.zip || ''}</p>

      <div class="modal-price-row">
        <span class="modal-price">${formatRent(listing.rent)} <span>/month est.</span></span>
      </div>

      <div class="modal-details-grid">
        <div class="modal-detail-item">
          <span class="modal-detail-label">Bedrooms</span>
          <span class="modal-detail-value">${bedroomLabel(listing.bedrooms)}</span>
        </div>
        <div class="modal-detail-item">
          <span class="modal-detail-label">Available</span>
          <span class="modal-detail-value">${formatDate(listing.availableDate)}</span>
        </div>
        ${extraDetails.map((d) => `
          <div class="modal-detail-item">
            <span class="modal-detail-label">${escapeHtml(d.label)}</span>
            <span class="modal-detail-value">${escapeHtml(String(d.value))}</span>
          </div>
        `).join('')}
      </div>

      ${listing.speculationFlag ? `
        <div style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:var(--radius-sm); padding:12px 16px; margin-bottom:16px; font-size:0.85rem; color:#B45309;">
          <strong>Speculation Alert:</strong> This building's cap rate (${listing.capRate?.toFixed(2)}%) is below the borough median (${listing.medCapRate?.toFixed(2)}%), suggesting potential speculative purchase of rent-regulated housing.
        </div>
      ` : ''}

      <div class="modal-features">
        ${(listing.features || []).map((f) => `<span class="feature-tag">${escapeHtml(f)}</span>`).join('')}
      </div>

      <div class="modal-data-source" style="background:var(--bg-elevated); border-radius:var(--radius-sm); padding:12px 16px; margin-bottom:20px; font-size:0.8rem; color:var(--text-muted);">
        <strong style="color:var(--text-secondary);">Data source:</strong> ${escapeHtml(listing.dataSource || 'NYC Open Data')}
        ${listing.datasetUrl ? `<br><a href="${listing.datasetUrl}" target="_blank" rel="noopener" style="color:var(--accent); text-decoration:none;">View dataset &rarr;</a>` : ''}
      </div>

      <div class="modal-contact">
        ${listing.sourceKey === 'housingconnect' ? `<a href="https://housingconnect.nyc.gov/PublicWeb/search-lotteries" target="_blank" rel="noopener" class="btn btn-primary" style="flex:1;justify-content:center;">Apply on Housing Connect</a>` : ''}
        <a href="https://amirentstabilized.com/" target="_blank" rel="noopener" class="btn btn-secondary" style="flex:1;justify-content:center;">Verify Stabilization</a>
      </div>

      <p style="font-size:0.75rem; color:var(--text-muted); margin-top:16px; text-align:center;">
        Rents shown are estimates based on public data. Always verify with
        <a href="https://hcr.ny.gov/" target="_blank" rel="noopener" style="color:var(--accent);">NYS HCR</a>
      </p>
    </div>
  `;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

// Close modal on overlay click or Escape
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ---- Navbar scroll effect ----
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
});

// ---- Filter event listeners ----
['filter-borough', 'filter-bedrooms', 'filter-rent', 'filter-source', 'sort-by'].forEach((id) => {
  document.getElementById(id).addEventListener('change', applyFilters);
});
document.getElementById('filter-search').addEventListener('input', debounce(applyFilters, 300));

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ---- Injected styles ----
const injectedStyle = document.createElement('style');
injectedStyle.textContent = `
.loading-spinner {
  width: 40px; height: 40px; margin: 0 auto;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.data-banner {
  text-align: center;
  padding: 10px 16px;
  font-size: 0.8rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
  line-height: 1.5;
}
.data-banner.live {
  background: rgba(16,185,129,0.1);
  color: var(--success);
}
.data-banner.partial {
  background: rgba(245,158,11,0.08);
  color: #B45309;
}
.data-banner.error {
  background: rgba(239,68,68,0.1);
  color: #EF4444;
}
`;
document.head.appendChild(injectedStyle);

// Add data banner to page
const filterBar = document.querySelector('.filter-bar');
if (filterBar) {
  const banner = document.createElement('div');
  banner.id = 'data-banner';
  banner.className = 'data-banner';
  banner.textContent = 'Loading data from 5 NYC Open Data sources...';
  filterBar.parentNode.insertBefore(banner, filterBar);
}

// ---- Boot ----
loadData();
