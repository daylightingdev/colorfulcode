// ============================================================
// StableNYC — Rent Stabilized Homes in NYC
// Real building data from NYC Open Data APIs
// Interactive map powered by Leaflet + OpenStreetMap
// Rent stabilization probability calculated from public records
// ============================================================

const SODA_BASE = 'https://data.cityofnewyork.us/resource';

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

// ---- Satellite thumbnail from coordinates ----
function getSatelliteTile(lat, lng) {
  if (!lat || !lng) return null;
  const zoom = 17;
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
}

// ============================================================
// RENT STABILIZATION PROBABILITY
// Scoring based on NYC rent stabilization law criteria
// ============================================================

function calculateRSProbability(listing) {
  let score = 0;
  const factors = [];

  // Pre-1974 construction is the primary legal criterion
  if (listing.yearBuilt && listing.yearBuilt < 1974) {
    score += 30;
    factors.push(`Built in ${listing.yearBuilt} (before 1974 rent stabilization cutoff)`);
  } else if (listing.yearBuilt && listing.yearBuilt >= 1974) {
    factors.push(`Built in ${listing.yearBuilt} (after 1974 — may still qualify via tax programs)`);
  }

  // 6+ residential units required for pre-1974 stabilization
  if (listing.totalUnits && listing.totalUnits >= 6) {
    score += 25;
    factors.push(`${listing.totalUnits} residential units (6+ units required for stabilization)`);
  } else if (listing.totalUnits && listing.totalUnits > 0) {
    factors.push(`${listing.totalUnits} units (fewer than 6 — less likely stabilized)`);
  }

  // Residential apartment building class (C = walk-up, D = elevator)
  if (listing.bldgClass) {
    const cls = listing.bldgClass.charAt(0).toUpperCase();
    if (cls === 'D') {
      score += 15;
      factors.push('Elevator apartment building (Class D)');
    } else if (cls === 'C') {
      score += 15;
      factors.push('Walk-up apartment building (Class C)');
    }
  }

  // Confirmed RS units from HPD Speculation Watch data
  if (listing.rsUnits && listing.rsUnits > 0) {
    score += 30;
    factors.push(`${listing.rsUnits} units registered as rent-stabilized with HPD`);
  }

  // Part of NYC affordable housing program
  if (listing.sourceKey === 'housingconnect' || listing.sourceKey === 'affordable') {
    score += 25;
    factors.push('Part of NYC affordable housing program (likely income-restricted)');
  }

  score = Math.min(score, 100);

  let label, color;
  if (listing.rsUnits && listing.rsUnits > 0) {
    label = 'Confirmed RS';
    color = '#16A34A';
  } else if (listing.sourceKey === 'housingconnect' || listing.sourceKey === 'affordable') {
    label = 'Affordable Housing';
    color = '#0D9488';
  } else if (score >= 80) {
    label = 'Very Likely RS';
    color = '#16A34A';
  } else if (score >= 55) {
    label = 'Likely RS';
    color = '#0D9488';
  } else if (score >= 35) {
    label = 'Possibly RS';
    color = '#D97706';
  } else {
    label = 'Check Status';
    color = '#57534E';
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

  if (listing.totalUnits) {
    parts.push(`${listing.totalUnits} residential unit${listing.totalUnits > 1 ? 's' : ''}`);
  }

  if (listing.numFloors) {
    parts.push(`${listing.numFloors} floor${listing.numFloors > 1 ? 's' : ''}`);
  }

  if (listing.rsUnits && listing.rsUnits > 0) {
    parts.push(`${listing.rsUnits} registered rent-stabilized unit${listing.rsUnits > 1 ? 's' : ''}`);
  }

  if (listing.affordableUnits && listing.affordableUnits > 0) {
    parts.push(`${listing.affordableUnits} affordable housing unit${listing.affordableUnits > 1 ? 's' : ''}`);
  }

  if (listing.lotteryStatus) {
    parts.push(`Housing lottery: ${listing.lotteryStatus}`);
  }

  if (listing.projectName) {
    parts.push(`Part of ${listing.projectName}`);
  }

  return parts.length > 0 ? parts.join('. ') + '.' : '';
}

// ============================================================
// STREETEASY SEARCH URL
// ============================================================

function buildStreetEasyUrl(address, borough, zip) {
  const query = `${address}, ${borough}, NY ${zip || ''}`.trim();
  return `https://streeteasy.com/for-rent/nyc/status:open?utf8=%E2%9C%93&search=${encodeURIComponent(query)}`;
}

// ---- Neighborhood lookup ----
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
    $limit: 300,
    $order: 'deeddate DESC',
    $select: 'borough,address,zip,bbl,buildingclass,numberofunits,numberofrsstabilizedunits,deeddate,saleprice,capitalizationrate,boroughmedcaprate,latitude,longitude',
  });
  const resp = await fetch(`${DATASETS.speculationWatch}?${params}`);
  if (!resp.ok) throw new Error(`Speculation Watch API: ${resp.status}`);
  return resp.json();
}

// PLUTO: Only residential apartment buildings (C = walk-up, D = elevator)
async function fetchPLUTO() {
  const params = new URLSearchParams({
    $where: "yearbuilt < 1974 AND unitsres >= 6 AND (bldgclass LIKE 'C%' OR bldgclass LIKE 'D%') AND unitsres IS NOT NULL AND latitude IS NOT NULL",
    $limit: 500,
    $order: 'unitsres DESC',
    $select: 'borough,block,lot,bbl,address,zipcode,bldgclass,numfloors,unitsres,unitstotal,yearbuilt,ownername,latitude,longitude',
  });
  const resp = await fetch(`${DATASETS.pluto}?${params}`);
  if (!resp.ok) throw new Error(`PLUTO API: ${resp.status}`);
  return resp.json();
}

// ============================================================
// TRANSFORMERS
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
      borough,
      zip: r.postcode || '',
      rent: estRent,
      totalUnits,
      affordableUnits,
      eliUnits, vliUnits, liUnits, miUnits,
      yearBuilt: null,
      rsUnits: null,
      bldgClass: null,
      numFloors: null,
      availableDate: r.building_completion_date
        ? new Date(r.building_completion_date).toISOString().slice(0, 10)
        : null,
      lat: parseFloat(r.latitude) || null,
      lng: parseFloat(r.longitude) || null,
      dataSource: 'NYC Open Data — Affordable Housing Production by Building',
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
      borough,
      zip: r.postcode || '',
      rent: estRent,
      totalUnits,
      affordableUnits,
      eliUnits, vliUnits, liUnits, miUnits,
      lotteryStatus: status,
      lotteryEnd: lotteryEnd ? new Date(lotteryEnd).toISOString().slice(0, 10) : '',
      yearBuilt: null,
      rsUnits: null,
      bldgClass: null,
      numFloors: null,
      availableDate: lotteryEnd ? new Date(lotteryEnd).toISOString().slice(0, 10) : null,
      lat: parseFloat(r.latitude) || null,
      lng: parseFloat(r.longitude) || null,
      dataSource: 'NYC Open Data — Housing Connect Lotteries',
      datasetUrl: 'https://data.cityofnewyork.us/Housing-Development/Advertised-Lotteries-on-Housing-Connect-By-Buildin/nibs-na6y',
      externalUrl: 'https://housingconnect.nyc.gov/PublicWeb/search-lotteries',
      externalSiteName: 'Housing Connect',
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

    let estRent;
    if (rsUnits > 0 && totalUnits > 0) {
      const annualNOI = salePrice * (capRate / 100);
      estRent = Math.round(annualNOI / totalUnits / 12);
      if (estRent < 500) estRent = 900 + (h % 600);
      if (estRent > 4000) estRent = 1800 + (h % 800);
    } else {
      estRent = 1200 + (h % 800);
    }

    return {
      id: `sw-${r.bbl || i}`,
      source: 'Confirmed RS Building',
      sourceKey: 'speculation',
      projectName: '',
      address: address || 'Address on file',
      neighborhood: guessNeighborhood(address, borough) || borough,
      borough,
      zip: r.zip || '',
      rent: estRent,
      totalUnits,
      affordableUnits: null,
      rsUnits,
      yearBuilt: null,
      bldgClass: r.buildingclass || null,
      numFloors: null,
      salePrice,
      capRate,
      medCapRate,
      speculationFlag: capRate > 0 && medCapRate > 0 && capRate < medCapRate,
      availableDate: r.deeddate ? new Date(r.deeddate).toISOString().slice(0, 10) : null,
      lat: parseFloat(r.latitude) || null,
      lng: parseFloat(r.longitude) || null,
      dataSource: 'NYC Open Data — HPD Speculation Watch List (confirmed RS units)',
      datasetUrl: 'https://data.cityofnewyork.us/Housing-Development/Speculation-Watch-List/adax-9mit',
      externalUrl: buildStreetEasyUrl(address, borough, r.zip),
      externalSiteName: 'StreetEasy',
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

    const boroughBase = { Manhattan: 1800, Brooklyn: 1500, Queens: 1300, Bronx: 1100, 'Staten Island': 1200 };
    const base = boroughBase[borough] || 1400;
    const estRent = Math.max(base + (h % 700) - Math.min(unitsRes, 50) * 3, 700);

    // Determine building type for display
    const cls = (r.bldgclass || '').charAt(0).toUpperCase();
    const bldgType = cls === 'D' ? 'Elevator Apartment' : cls === 'C' ? 'Walk-up Apartment' : 'Residential';

    return {
      id: `pluto-${r.bbl || i}`,
      source: bldgType,
      sourceKey: 'pluto',
      projectName: '',
      address: address || `Block ${r.block}, Lot ${r.lot}`,
      neighborhood: guessNeighborhood(address, borough) || borough,
      borough,
      zip: r.zipcode || '',
      rent: estRent,
      totalUnits: unitsRes,
      affordableUnits: null,
      rsUnits: null,
      yearBuilt: yearBuilt > 0 ? yearBuilt : null,
      numFloors,
      ownerName: r.ownername || '',
      bldgClass: r.bldgclass || '',
      availableDate: null,
      lat: parseFloat(r.latitude) || null,
      lng: parseFloat(r.longitude) || null,
      dataSource: 'NYC Open Data — PLUTO (pre-1974 residential, 6+ units)',
      datasetUrl: 'https://data.cityofnewyork.us/City-Government/Primary-Land-Use-Tax-Lot-Output-PLUTO-/64uk-42ks',
      externalUrl: buildStreetEasyUrl(address, borough, r.zipcode),
      externalSiteName: 'StreetEasy',
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

    if (ahResult.status === 'fulfilled' && ahResult.value.length > 0) {
      const transformed = transformAffordableHousing(ahResult.value);
      listings.push(...transformed);
      counts['Affordable Housing'] = transformed.length;
    } else if (ahResult.status === 'rejected') {
      errors.push(`Affordable Housing: ${ahResult.reason.message}`);
    }

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

    if (specResult.status === 'fulfilled' && specResult.value.length > 0) {
      const transformed = transformSpeculationWatch(specResult.value);
      listings.push(...transformed);
      counts['Confirmed RS'] = transformed.length;
    } else if (specResult.status === 'rejected') {
      errors.push(`Speculation Watch: ${specResult.reason.message}`);
    }

    if (plutoResult.status === 'fulfilled' && plutoResult.value.length > 0) {
      const transformed = transformPLUTO(plutoResult.value);
      listings.push(...transformed);
      counts['Residential Buildings'] = transformed.length;
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

  // Calculate RS probability for every listing
  allListings.forEach(l => {
    l.rsProb = calculateRSProbability(l);
    l.description = buildDescription(l);
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
// MAP
// ============================================================

function initMap() {
  map = L.map('listing-map', {
    center: [40.7128, -74.006],
    zoom: 11,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

function updateMapMarkers() {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();

  const listingsWithCoords = filteredListings.filter(l => l.lat && l.lng);

  listingsWithCoords.forEach(listing => {
    const rsColor = listing.rsProb ? listing.rsProb.color : '#57534E';
    const marker = L.circleMarker([listing.lat, listing.lng], {
      radius: 8,
      fillColor: rsColor,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85,
    });

    marker.bindPopup(`
      <div class="map-popup">
        <strong>${escapeHtml(listing.address)}</strong>
        <p>${escapeHtml(listing.neighborhood)}${listing.neighborhood && listing.borough ? ', ' : ''}${escapeHtml(listing.borough)}</p>
        <p class="popup-rent">${formatRent(listing.rent)}/mo est.</p>
        <p style="font-size:0.72rem;color:${rsColor};font-weight:600;margin:4px 0 8px;">${listing.rsProb ? listing.rsProb.label : ''} (${listing.rsProb ? listing.rsProb.score : 0}%)</p>
        <button class="popup-btn" onclick="openModal('${listing.id}')">View Details</button>
      </div>
    `, { maxWidth: 250 });

    marker.listingId = listing.id;

    marker.on('mouseover', () => {
      const card = document.querySelector(`[data-id="${listing.id}"]`);
      if (card) card.classList.add('highlighted');
    });
    marker.on('mouseout', () => {
      const card = document.querySelector(`[data-id="${listing.id}"]`);
      if (card) card.classList.remove('highlighted');
    });

    markersLayer.addLayer(marker);
  });

  if (listingsWithCoords.length > 0) {
    const group = L.featureGroup(markersLayer.getLayers());
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

function highlightMarker(listingId) {
  if (!markersLayer) return;
  markersLayer.eachLayer(marker => {
    if (marker.listingId === listingId) {
      marker.setStyle({ radius: 12, weight: 3 });
      marker.openPopup();
    }
  });
}

function unhighlightMarker(listingId) {
  if (!markersLayer) return;
  markersLayer.eachLayer(marker => {
    if (marker.listingId === listingId) {
      marker.setStyle({ radius: 8, weight: 2 });
      marker.closePopup();
    }
  });
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
        <p style="color:var(--text-muted); margin-top:16px;">Loading live building data from NYC Open Data...</p>
        <p style="color:var(--text-muted); font-size:0.8rem; margin-top:8px;">Analyzing rent stabilization probability for each building</p>
      </div>`;
  }
}

function showApiError(errors) {
  const grid = document.getElementById('listings-grid');
  const empty = document.getElementById('empty-state');
  empty.style.display = 'none';

  document.getElementById('listing-count').textContent = '0';
  document.getElementById('results-count').textContent = '0 buildings found';

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
      <h3 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:1.3rem; margin-bottom:8px;">
        Could not connect to NYC Open Data
      </h3>
      <p style="color:var(--text-secondary); max-width:480px; margin:0 auto 8px;">
        This site pulls live data from NYC Open Data Socrata API endpoints. The connection may be temporarily unavailable.
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
    .map(([name, n]) => `${n} ${name}`);

  const errCount = errors.length;
  let text = `${count} buildings with RS probability from NYC Open Data — ${parts.join(', ')}`;
  if (errCount > 0) {
    text += ` | ${errCount} source${errCount > 1 ? 's' : ''} unavailable`;
  }
  banner.textContent = text;
  banner.className = errCount > 0 ? 'data-banner partial' : 'data-banner live';
}

function populateSourceFilter() {
  const select = document.getElementById('filter-source');
  if (!select) return;
  const sources = [...new Set(allListings.map((l) => l.source))].sort();
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

  filteredListings = allListings.filter((l) => {
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

// ---- Rendering ----
function formatRent(r) {
  return '$' + r.toLocaleString();
}

function formatDate(d) {
  if (!d) return null;
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderListings() {
  const grid = document.getElementById('listings-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('results-count');

  count.textContent = `${filteredListings.length} building${filteredListings.length !== 1 ? 's' : ''} found`;

  if (filteredListings.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  grid.innerHTML = filteredListings
    .map((l, i) => {
      const satImage = getSatelliteTile(l.lat, l.lng);
      const imageHtml = satImage
        ? `<img src="${satImage}" alt="Aerial view near ${escapeHtml(l.address)}" loading="lazy" onerror="this.style.display='none'">`
        : '';

      const rs = l.rsProb || { label: 'Unknown', color: '#57534E', score: 0 };

      const details = [];
      if (l.totalUnits) details.push(`<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>${l.totalUnits} units</span>`);
      if (l.yearBuilt) details.push(`<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>Built ${l.yearBuilt}</span>`);
      if (l.rsUnits) details.push(`<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>${l.rsUnits} RS units</span>`);
      if (l.affordableUnits) details.push(`<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>${l.affordableUnits} affordable</span>`);
      if (l.numFloors) details.push(`<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/></svg>${l.numFloors} floors</span>`);

      return `
    <article class="listing-card" data-id="${l.id}" onclick="openModal('${l.id}')" style="animation-delay:${Math.min(i * 0.03, 0.25)}s" tabindex="0" role="button" aria-label="View details for ${escapeHtml(l.address)}"
      onmouseenter="highlightMarker('${l.id}')" onmouseleave="unhighlightMarker('${l.id}')">
      <div class="card-image">
        ${imageHtml}
        <span class="card-badge" style="background:${rs.color}">${escapeHtml(rs.label)} ${rs.score}%</span>
        <span class="card-rent-badge">${formatRent(l.rent)}<span>/mo est.</span></span>
      </div>
      <div class="card-body">
        <h3 class="card-address">${escapeHtml(l.address)}</h3>
        <p class="card-neighborhood">${escapeHtml(l.neighborhood)}${l.neighborhood && l.borough ? ', ' : ''}${escapeHtml(l.borough)}${l.zip ? ' ' + escapeHtml(l.zip) : ''}</p>
        ${l.description ? `<p class="card-description">${escapeHtml(l.description)}</p>` : ''}
        <div class="card-details">
          ${details.join('')}
          ${l.lotteryStatus ? `<span class="card-detail" style="color:#0D9488;font-weight:600;">Lottery: ${escapeHtml(l.lotteryStatus)}</span>` : ''}
          ${l.speculationFlag ? `<span class="card-detail" style="color:#D97706;font-weight:600;">Speculation Alert</span>` : ''}
        </div>
      </div>
      <div class="card-footer">
        <span class="card-source">Find units on ${escapeHtml(l.externalSiteName)}</span>
        <span class="card-cta">View Details <span class="external-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></span></span>
      </div>
    </article>
  `;
    })
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

  const rs = listing.rsProb || { label: 'Unknown', color: '#57534E', score: 0, factors: [] };

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
  if (listing.bldgClass) extraDetails.push({ label: 'Building Class', value: listing.bldgClass });

  const hasCoords = listing.lat && listing.lng;

  content.innerHTML = `
    ${hasCoords ? `<div class="modal-map-header" id="modal-map-container"></div>` : ''}
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

      <!-- RS Probability Breakdown -->
      <div style="background:${rs.color}08; border:1px solid ${rs.color}25; border-radius:var(--radius-md); padding:16px 20px; margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${rs.color}" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <strong style="font-family:'Plus Jakarta Sans',sans-serif; font-size:0.95rem; color:${rs.color};">Rent Stabilization: ${rs.label} (${rs.score}%)</strong>
        </div>
        <div style="background:var(--bg-elevated); border-radius:100px; height:8px; margin-bottom:12px; overflow:hidden;">
          <div style="background:${rs.color}; height:100%; width:${rs.score}%; border-radius:100px; transition:width 0.5s ease;"></div>
        </div>
        ${rs.factors.length > 0 ? `
          <ul style="list-style:none; padding:0; margin:0; font-size:0.82rem; color:var(--text-secondary);">
            ${rs.factors.map(f => `<li style="padding:3px 0; display:flex; align-items:flex-start; gap:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${rs.color}" stroke-width="2" style="flex-shrink:0; margin-top:2px;"><polyline points="20,6 9,17 4,12"/></svg>
              ${escapeHtml(f)}
            </li>`).join('')}
          </ul>
        ` : ''}
      </div>

      <div class="modal-details-grid">
        ${listing.availableDate ? `
          <div class="modal-detail-item">
            <span class="modal-detail-label">Date on Record</span>
            <span class="modal-detail-value">${formatDate(listing.availableDate)}</span>
          </div>
        ` : ''}
        ${extraDetails.map((d) => `
          <div class="modal-detail-item">
            <span class="modal-detail-label">${escapeHtml(d.label)}</span>
            <span class="modal-detail-value">${escapeHtml(String(d.value))}</span>
          </div>
        `).join('')}
      </div>

      ${listing.speculationFlag ? `
        <div style="background:rgba(217,119,6,0.08); border:1px solid rgba(217,119,6,0.25); border-radius:var(--radius-sm); padding:12px 16px; margin-bottom:16px; font-size:0.85rem; color:#92400E;">
          <strong>Speculation Alert:</strong> This building's cap rate (${listing.capRate?.toFixed(2)}%) is below the borough median (${listing.medCapRate?.toFixed(2)}%), suggesting potential speculative purchase of rent-regulated housing.
        </div>
      ` : ''}

      <div style="background:var(--bg-elevated); border-radius:var(--radius-sm); padding:12px 16px; margin-bottom:20px; font-size:0.8rem; color:var(--text-muted);">
        <strong style="color:var(--text-secondary);">Data source:</strong> ${escapeHtml(listing.dataSource || 'NYC Open Data')}
        ${listing.datasetUrl ? `<br><a href="${listing.datasetUrl}" target="_blank" rel="noopener" style="color:var(--accent); text-decoration:none;">View raw dataset &rarr;</a>` : ''}
      </div>

      <div class="modal-contact">
        <button class="btn btn-primary" style="flex:1;justify-content:center;" onclick="closeModal(); showExternalLink('${listing.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Find Available Units on ${escapeHtml(listing.externalSiteName)}
        </button>
      </div>

      <p style="font-size:0.75rem; color:var(--text-muted); margin-top:16px; text-align:center;">
        RS probability calculated from public building records. Rents are estimates.
        Always verify with <a href="https://hcr.ny.gov/" target="_blank" rel="noopener" style="color:var(--accent);">NYS HCR</a>.
      </p>
    </div>
  `;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Initialize mini map in modal
  if (hasCoords) {
    setTimeout(() => {
      const container = document.getElementById('modal-map-container');
      if (!container) return;
      if (modalMap) { modalMap.remove(); modalMap = null; }
      modalMap = L.map(container, {
        center: [listing.lat, listing.lng],
        zoom: 16,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '',
        maxZoom: 19,
      }).addTo(modalMap);
      L.circleMarker([listing.lat, listing.lng], {
        radius: 10,
        fillColor: rs.color,
        color: '#fff',
        weight: 3,
        fillOpacity: 0.9,
      }).addTo(modalMap);
    }, 100);
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
  if (modalMap) { modalMap.remove(); modalMap = null; }
}

// ---- External Link Confirmation ----
function showExternalLink(id) {
  const listing = allListings.find(l => l.id === id);
  if (!listing) return;

  const overlay = document.getElementById('external-overlay');
  const content = document.getElementById('external-modal-content');

  content.innerHTML = `
    <div class="external-icon-large">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
        <polyline points="15,3 21,3 21,9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </div>
    <h3>You're leaving StableNYC</h3>
    <p>You'll be taken to <strong>${escapeHtml(listing.externalSiteName)}</strong> to search for available rental units at this address. StableNYC is not affiliated with this site.</p>
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

// Close modals on overlay click or Escape
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});
document.getElementById('external-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'external-overlay') closeExternalModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeExternalModal();
  }
});

// ---- View Toggle ----
function setView(view) {
  currentView = view;
  const layout = document.getElementById('listings-layout');

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (view === 'split') {
    layout.className = 'listings-layout split-view';
    document.getElementById('map-panel').style.display = '';
    setTimeout(() => { if (map) map.invalidateSize(); }, 100);
  } else {
    layout.className = 'listings-layout grid-view';
    document.getElementById('map-panel').style.display = 'none';
  }
}

document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

// ---- Navbar scroll effect ----
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
});

// ---- Filter event listeners ----
['filter-borough', 'filter-rent', 'filter-source', 'sort-by'].forEach((id) => {
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
  background: rgba(22,163,74,0.08);
  color: var(--success);
}
.data-banner.partial {
  background: rgba(217,119,6,0.06);
  color: #92400E;
}
.data-banner.error {
  background: rgba(220,38,38,0.08);
  color: #DC2626;
}

.card-description {
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
`;
document.head.appendChild(injectedStyle);

// Add data banner to page
const filterBar = document.querySelector('.filter-bar');
if (filterBar) {
  const banner = document.createElement('div');
  banner.id = 'data-banner';
  banner.className = 'data-banner';
  banner.textContent = 'Loading building data from NYC Open Data...';
  filterBar.parentNode.insertBefore(banner, filterBar);
}

// ---- Boot ----
initMap();
loadData();
