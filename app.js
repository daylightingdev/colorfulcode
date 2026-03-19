// ============================================================
// StableNYC — NYC Rent-Stabilized Listings Aggregator
// Cross-references rental listings with DHCR building registry
// ============================================================

// ---- Configuration ----
const WORKER_URL = ''; // Set to deployed Cloudflare Worker URL
const SODA_BASE = 'https://data.cityofnewyork.us/resource';

// ============================================================
// PART 1: DHCR RENT STABILIZED BUILDING REGISTRY (Sample Data)
// Source: NYS Homes & Community Renewal / NYC Rent Guidelines Board
// https://rentguidelinesboard.cityofnewyork.us/resources/rent-stabilized-building-lists/
//
// In production, this would be loaded from a pre-processed JSON
// file derived from the official DHCR Excel downloads.
// ============================================================

const RS_BUILDINGS = [
  // --- Manhattan ---
  { address: '101 AVENUE A', borough: 'Manhattan', zip: '10009', units: 24, block: '390', lot: '19', yearBuilt: 1920, lat: 40.7264, lng: -73.9842 },
  { address: '235 EAST 5TH STREET', borough: 'Manhattan', zip: '10003', units: 18, block: '460', lot: '12', yearBuilt: 1910, lat: 40.7286, lng: -73.9895 },
  { address: '52 EAST 7TH STREET', borough: 'Manhattan', zip: '10003', units: 30, block: '448', lot: '25', yearBuilt: 1915, lat: 40.7277, lng: -73.9878 },
  { address: '340 EAST 11TH STREET', borough: 'Manhattan', zip: '10003', units: 22, block: '393', lot: '7', yearBuilt: 1905, lat: 40.7303, lng: -73.9824 },
  { address: '512 EAST 12TH STREET', borough: 'Manhattan', zip: '10009', units: 16, block: '397', lot: '45', yearBuilt: 1925, lat: 40.7295, lng: -73.9815 },
  { address: '201 WEST 70TH STREET', borough: 'Manhattan', zip: '10023', units: 48, block: '1120', lot: '55', yearBuilt: 1928, lat: 40.7772, lng: -73.9799 },
  { address: '315 WEST 78TH STREET', borough: 'Manhattan', zip: '10024', units: 36, block: '1185', lot: '32', yearBuilt: 1922, lat: 40.7832, lng: -73.9775 },
  { address: '424 WEST 84TH STREET', borough: 'Manhattan', zip: '10024', units: 28, block: '1217', lot: '18', yearBuilt: 1930, lat: 40.7862, lng: -73.9751 },
  { address: '345 EAST 86TH STREET', borough: 'Manhattan', zip: '10028', units: 52, block: '1557', lot: '28', yearBuilt: 1935, lat: 40.7776, lng: -73.9515 },
  { address: '225 EAST 82ND STREET', borough: 'Manhattan', zip: '10028', units: 20, block: '1530', lot: '33', yearBuilt: 1940, lat: 40.7753, lng: -73.9534 },
  { address: '750 COLUMBUS AVENUE', borough: 'Manhattan', zip: '10025', units: 44, block: '1198', lot: '42', yearBuilt: 1926, lat: 40.7928, lng: -73.9672 },
  { address: '123 WEST 93RD STREET', borough: 'Manhattan', zip: '10025', units: 26, block: '1231', lot: '38', yearBuilt: 1918, lat: 40.7938, lng: -73.9710 },
  { address: '411 EAST 6TH STREET', borough: 'Manhattan', zip: '10009', units: 14, block: '452', lot: '8', yearBuilt: 1912, lat: 40.7260, lng: -73.9852 },
  { address: '1621 AMSTERDAM AVENUE', borough: 'Manhattan', zip: '10031', units: 32, block: '2080', lot: '22', yearBuilt: 1924, lat: 40.8248, lng: -73.9472 },
  { address: '510 WEST 136TH STREET', borough: 'Manhattan', zip: '10031', units: 40, block: '2068', lot: '15', yearBuilt: 1916, lat: 40.8215, lng: -73.9533 },

  // --- Brooklyn ---
  { address: '279 STERLING PLACE', borough: 'Brooklyn', zip: '11238', units: 20, block: '1159', lot: '32', yearBuilt: 1925, lat: 40.6784, lng: -73.9629 },
  { address: '485 SAINT JOHNS PLACE', borough: 'Brooklyn', zip: '11238', units: 16, block: '1175', lot: '22', yearBuilt: 1920, lat: 40.6740, lng: -73.9571 },
  { address: '1040 CARROLL STREET', borough: 'Brooklyn', zip: '11225', units: 24, block: '1215', lot: '45', yearBuilt: 1930, lat: 40.6695, lng: -73.9552 },
  { address: '178 PARK PLACE', borough: 'Brooklyn', zip: '11217', units: 30, block: '1110', lot: '18', yearBuilt: 1915, lat: 40.6793, lng: -73.9710 },
  { address: '540 FOURTH AVENUE', borough: 'Brooklyn', zip: '11215', units: 42, block: '988', lot: '55', yearBuilt: 1928, lat: 40.6728, lng: -73.9821 },
  { address: '312 SEVENTH AVENUE', borough: 'Brooklyn', zip: '11215', units: 18, block: '1015', lot: '12', yearBuilt: 1922, lat: 40.6689, lng: -73.9803 },
  { address: '2065 FLATBUSH AVENUE', borough: 'Brooklyn', zip: '11234', units: 36, block: '7868', lot: '28', yearBuilt: 1955, lat: 40.6265, lng: -73.9328 },
  { address: '1425 OCEAN AVENUE', borough: 'Brooklyn', zip: '11230', units: 48, block: '5250', lot: '15', yearBuilt: 1940, lat: 40.6378, lng: -73.9582 },
  { address: '95 BEDFORD AVENUE', borough: 'Brooklyn', zip: '11211', units: 22, block: '2300', lot: '38', yearBuilt: 1918, lat: 40.7135, lng: -73.9619 },
  { address: '247 SOUTH 2ND STREET', borough: 'Brooklyn', zip: '11211', units: 14, block: '2305', lot: '10', yearBuilt: 1910, lat: 40.7118, lng: -73.9595 },
  { address: '515 EASTERN PARKWAY', borough: 'Brooklyn', zip: '11225', units: 32, block: '1318', lot: '22', yearBuilt: 1935, lat: 40.6694, lng: -73.9479 },
  { address: '738 FRANKLIN AVENUE', borough: 'Brooklyn', zip: '11238', units: 26, block: '1175', lot: '35', yearBuilt: 1924, lat: 40.6738, lng: -73.9580 },
  { address: '1588 NOSTRAND AVENUE', borough: 'Brooklyn', zip: '11226', units: 28, block: '5045', lot: '18', yearBuilt: 1942, lat: 40.6492, lng: -73.9497 },
  { address: '440 LINDEN BOULEVARD', borough: 'Brooklyn', zip: '11203', units: 34, block: '4840', lot: '25', yearBuilt: 1948, lat: 40.6578, lng: -73.9385 },

  // --- Queens ---
  { address: '31-12 30TH AVENUE', borough: 'Queens', zip: '11102', units: 24, block: '550', lot: '42', yearBuilt: 1928, lat: 40.7693, lng: -73.9200 },
  { address: '25-14 BROADWAY', borough: 'Queens', zip: '11106', units: 18, block: '580', lot: '15', yearBuilt: 1935, lat: 40.7631, lng: -73.9232 },
  { address: '37-55 82ND STREET', borough: 'Queens', zip: '11372', units: 30, block: '1365', lot: '32', yearBuilt: 1940, lat: 40.7500, lng: -73.8835 },
  { address: '82-15 37TH AVENUE', borough: 'Queens', zip: '11372', units: 36, block: '1285', lot: '28', yearBuilt: 1945, lat: 40.7489, lng: -73.8835 },
  { address: '34-02 STEINWAY STREET', borough: 'Queens', zip: '11101', units: 22, block: '550', lot: '55', yearBuilt: 1932, lat: 40.7598, lng: -73.9158 },
  { address: '41-25 KISSENA BOULEVARD', borough: 'Queens', zip: '11355', units: 40, block: '5050', lot: '22', yearBuilt: 1950, lat: 40.7538, lng: -73.8272 },
  { address: '144-60 ROOSEVELT AVENUE', borough: 'Queens', zip: '11354', units: 28, block: '5020', lot: '35', yearBuilt: 1955, lat: 40.7600, lng: -73.8310 },
  { address: '107-40 QUEENS BOULEVARD', borough: 'Queens', zip: '11375', units: 56, block: '3190', lot: '42', yearBuilt: 1948, lat: 40.7209, lng: -73.8456 },
  { address: '65-10 99TH STREET', borough: 'Queens', zip: '11374', units: 18, block: '3270', lot: '15', yearBuilt: 1952, lat: 40.7152, lng: -73.8548 },
  { address: '72-12 AUSTIN STREET', borough: 'Queens', zip: '11375', units: 32, block: '3240', lot: '28', yearBuilt: 1938, lat: 40.7198, lng: -73.8488 },

  // --- Bronx ---
  { address: '1520 GRAND CONCOURSE', borough: 'Bronx', zip: '10457', units: 48, block: '2805', lot: '35', yearBuilt: 1930, lat: 40.8372, lng: -73.9090 },
  { address: '2155 UNIVERSITY AVENUE', borough: 'Bronx', zip: '10453', units: 36, block: '3210', lot: '22', yearBuilt: 1938, lat: 40.8530, lng: -73.9156 },
  { address: '3230 FAIRFIELD AVENUE', borough: 'Bronx', zip: '10463', units: 24, block: '3256', lot: '18', yearBuilt: 1942, lat: 40.8785, lng: -73.9045 },
  { address: '2575 PALISADE AVENUE', borough: 'Bronx', zip: '10463', units: 40, block: '5880', lot: '42', yearBuilt: 1950, lat: 40.8866, lng: -73.9108 },
  { address: '2415 SEDGWICK AVENUE', borough: 'Bronx', zip: '10468', units: 32, block: '3224', lot: '28', yearBuilt: 1935, lat: 40.8645, lng: -73.9052 },
  { address: '1800 EAST TREMONT AVENUE', borough: 'Bronx', zip: '10460', units: 28, block: '3984', lot: '15', yearBuilt: 1928, lat: 40.8422, lng: -73.8780 },
  { address: '820 EAST 178TH STREET', borough: 'Bronx', zip: '10460', units: 20, block: '3050', lot: '32', yearBuilt: 1920, lat: 40.8490, lng: -73.8860 },
  { address: '3400 WAYNE AVENUE', borough: 'Bronx', zip: '10467', units: 44, block: '4580', lot: '55', yearBuilt: 1952, lat: 40.8735, lng: -73.8672 },
  { address: '1975 HARRISON AVENUE', borough: 'Bronx', zip: '10453', units: 26, block: '2875', lot: '12', yearBuilt: 1925, lat: 40.8555, lng: -73.9118 },
  { address: '890 SHERIDAN AVENUE', borough: 'Bronx', zip: '10451', units: 18, block: '2425', lot: '38', yearBuilt: 1915, lat: 40.8285, lng: -73.9215 },

  // --- Staten Island ---
  { address: '35 HYLAN BOULEVARD', borough: 'Staten Island', zip: '10305', units: 16, block: '2880', lot: '22', yearBuilt: 1960, lat: 40.6152, lng: -74.0724 },
  { address: '135 FINGERBOARD ROAD', borough: 'Staten Island', zip: '10305', units: 20, block: '2740', lot: '35', yearBuilt: 1958, lat: 40.6095, lng: -74.0665 },
  { address: '1000 RICHMOND TERRACE', borough: 'Staten Island', zip: '10301', units: 24, block: '14', lot: '42', yearBuilt: 1955, lat: 40.6435, lng: -74.0765 },
  { address: '45 WANDEL AVENUE', borough: 'Staten Island', zip: '10304', units: 12, block: '365', lot: '15', yearBuilt: 1962, lat: 40.6210, lng: -74.0815 },
];

// ============================================================
// PART 2: ADDRESS NORMALIZATION ENGINE
// Handles NYC address quirks: abbreviations, ordinals,
// directions, hyphenated Queens addresses, etc.
// ============================================================

const STREET_TYPE_MAP = {
  STREET: 'ST', AVENUE: 'AVE', BOULEVARD: 'BLVD', PLACE: 'PL',
  DRIVE: 'DR', ROAD: 'RD', LANE: 'LN', COURT: 'CT', TERRACE: 'TER',
  PARKWAY: 'PKWY', EXPRESSWAY: 'EXPY', HIGHWAY: 'HWY', CIRCLE: 'CIR',
  SQUARE: 'SQ', TURNPIKE: 'TPKE', PLAZA: 'PLZ',
};

const DIRECTION_MAP = {
  EAST: 'E', WEST: 'W', NORTH: 'N', SOUTH: 'S',
};

function normalizeAddress(addr) {
  if (!addr) return '';
  let s = addr.toUpperCase().trim();

  // Remove apartment/unit suffixes: ", Apt 3B", "#4A", "Unit 2", etc.
  s = s.replace(/[,\s]+(APT|APARTMENT|UNIT|SUITE|STE|FL|FLOOR|RM|ROOM|#)\s*\.?\s*\S*$/i, '');
  s = s.replace(/\s*#\s*\S+$/, '');

  // Remove periods, commas, hashes
  s = s.replace(/[.,#]/g, '');

  // Normalize directions
  for (const [full, abbr] of Object.entries(DIRECTION_MAP)) {
    s = s.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  }

  // Normalize street types
  for (const [full, abbr] of Object.entries(STREET_TYPE_MAP)) {
    s = s.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  }

  // Normalize ordinal suffixes: 1ST→1, 2ND→2, 3RD→3, 4TH→4, etc.
  s = s.replace(/\b(\d+)(?:ST|ND|RD|TH)\b/g, '$1');

  // Normalize "SAINT" to "ST" (for St Johns, St Marks, etc.)
  s = s.replace(/\bSAINT\b/g, 'ST');

  // Normalize "FORT" to "FT"
  s = s.replace(/\bFORT\b/g, 'FT');

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

// Parse a normalized address into { number, street }
function parseAddress(normalized) {
  // Handle Queens-style hyphenated house numbers: "31-12 30 AVE"
  const hyphenMatch = normalized.match(/^(\d+-\d+)\s+(.+)$/);
  if (hyphenMatch) {
    return { number: hyphenMatch[1], street: hyphenMatch[2] };
  }

  // Standard: "101 AVE A", "235 E 5 ST"
  const stdMatch = normalized.match(/^(\d+)\s+(.+)$/);
  if (stdMatch) {
    return { number: stdMatch[1], street: stdMatch[2] };
  }

  return { number: '', street: normalized };
}

// ============================================================
// PART 3: RS BUILDING LOOKUP INDEX
// Build a fast lookup from normalized address → RS building record
// ============================================================

const BOROUGH_MAP = {
  MANHATTAN: 'Manhattan', BROOKLYN: 'Brooklyn', QUEENS: 'Queens',
  BRONX: 'Bronx', 'STATEN ISLAND': 'Staten Island',
  MN: 'Manhattan', BK: 'Brooklyn', QN: 'Queens', BX: 'Bronx', SI: 'Staten Island',
  'NEW YORK': 'Manhattan', 'KINGS': 'Brooklyn', 'RICHMOND': 'Staten Island',
};

function normBorough(raw) {
  if (!raw) return '';
  const key = String(raw).toUpperCase().trim();
  return BOROUGH_MAP[key] || raw;
}

// Build lookup keyed by "BOROUGH|NORMALIZED_ADDRESS"
let rsLookup = {};

function buildRSLookup(buildings) {
  rsLookup = {};
  for (const bldg of buildings) {
    const normAddr = normalizeAddress(bldg.address);
    const borough = normBorough(bldg.borough);
    const key = `${borough}|${normAddr}`;
    rsLookup[key] = bldg;

    // Also index without borough for fuzzy matching
    if (!rsLookup[`ANY|${normAddr}`]) {
      rsLookup[`ANY|${normAddr}`] = bldg;
    }
  }
}

// Check if a listing address matches an RS building
function findRSBuilding(listingAddress, listingBorough) {
  const normAddr = normalizeAddress(listingAddress);
  const parsed = parseAddress(normAddr);
  const borough = normBorough(listingBorough);

  // Try exact match with borough
  const exactKey = `${borough}|${normAddr}`;
  if (rsLookup[exactKey]) return rsLookup[exactKey];

  // Try without borough (for cases where borough is missing/different)
  const anyKey = `ANY|${normAddr}`;
  if (rsLookup[anyKey]) return rsLookup[anyKey];

  // Try matching just house number + street from parsed addresses
  if (parsed.number) {
    for (const bldg of RS_BUILDINGS) {
      const bldgNorm = normalizeAddress(bldg.address);
      const bldgParsed = parseAddress(bldgNorm);
      if (parsed.number === bldgParsed.number && parsed.street === bldgParsed.street) {
        // If boroughs are both known, they must match
        if (borough && bldg.borough && borough !== normBorough(bldg.borough)) continue;
        return bldg;
      }
    }
  }

  return null;
}

// Initialize the lookup
buildRSLookup(RS_BUILDINGS);

// ============================================================
// DIAGNOSTIC: Log matching test to verify engine works
// ============================================================
console.log('[StableNYC] RS Building lookup built:', Object.keys(rsLookup).length, 'keys');
console.log('[StableNYC] Address matching tests:');
console.log('  "101 Avenue A, Apt 3B" →', findRSBuilding('101 Avenue A, Apt 3B', 'Manhattan')?.address || 'NO MATCH');
console.log('  "235 E 5th St, #4A" →', findRSBuilding('235 E 5th St, #4A', 'Manhattan')?.address || 'NO MATCH');
console.log('  "315 W. 78th Street" →', findRSBuilding('315 W. 78th Street', 'Manhattan')?.address || 'NO MATCH');
console.log('  "82-15 37th Avenue" →', findRSBuilding('82-15 37th Avenue', 'Queens')?.address || 'NO MATCH');
console.log('  "485 Saint Johns Place" →', findRSBuilding('485 Saint Johns Place', 'Brooklyn')?.address || 'NO MATCH');
console.log('  "999 Fake Street" →', findRSBuilding('999 Fake Street', 'Manhattan')?.address || 'NO MATCH');

// ============================================================
// PLACEHOLDER: Parts 4-8 will be added next
// - Sample rental listings
// - State management
// - Map initialization
// - Filter/sort logic
// - Card rendering
// - Modal
// - Event listeners
// - Boot sequence
// ============================================================
