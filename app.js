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

  // Remove apartment/unit suffixes: ", Apt 3B", "#4A", "Unit 2", ", 5C", etc.
  s = s.replace(/[,\s]+(APT|APARTMENT|UNIT|SUITE|STE|FL|FLOOR|RM|ROOM|#)\s*\.?\s*\S*$/i, '');
  s = s.replace(/\s*#\s*\S+$/, '');
  // Catch trailing ", 5C" or ", 2A" patterns (unit without label)
  s = s.replace(/,\s*\d*[A-Z]+\s*$/, '');
  s = s.replace(/,\s*\d+\s*$/, '');

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

  // Normalize spelled-out ordinals: FIRST→1, SECOND→2, etc.
  const WORD_ORDINALS = {
    FIRST: '1', SECOND: '2', THIRD: '3', FOURTH: '4', FIFTH: '5',
    SIXTH: '6', SEVENTH: '7', EIGHTH: '8', NINTH: '9', TENTH: '10',
    ELEVENTH: '11', TWELFTH: '12',
  };
  for (const [word, num] of Object.entries(WORD_ORDINALS)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, 'g'), num);
  }

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
// PART 4: SAMPLE RENTAL LISTINGS
// In production these come from the Cloudflare Worker
// (StreetEasy, Craigslist RSS, etc). For development we use
// sample listings at addresses that match RS buildings above.
// ============================================================

const SAMPLE_LISTINGS = [
  // --- Manhattan ---
  {
    id: 'se-001', source: 'streeteasy',
    url: 'https://streeteasy.com/building/101-avenue-a-new_york',
    address: '101 Avenue A, Apt 3B',
    borough: 'Manhattan', neighborhood: 'East Village', zip: '10009',
    price: 2450, bedrooms: 1, bathrooms: 1,
    description: 'Bright 1BR in classic pre-war building. High ceilings, hardwood floors, updated kitchen. Heat and hot water included.',
    availableDate: '2026-04-01',
    lat: 40.7264, lng: -73.9842,
  },
  {
    id: 'se-002', source: 'streeteasy',
    url: 'https://streeteasy.com/building/235-east-5th-street-new_york',
    address: '235 E 5th St, #4A',
    borough: 'Manhattan', neighborhood: 'East Village', zip: '10003',
    price: 2100, bedrooms: 0, bathrooms: 1,
    description: 'Cozy studio in well-maintained elevator building. Laundry in basement, close to Tompkins Square Park.',
    availableDate: '2026-04-15',
    lat: 40.7286, lng: -73.9895,
  },
  {
    id: 'cl-003', source: 'craigslist',
    url: 'https://newyork.craigslist.org/search/mnh/apa?query=340+East+11th+Street',
    address: '340 East 11th Street, #2R',
    borough: 'Manhattan', neighborhood: 'East Village', zip: '10003',
    price: 2800, bedrooms: 2, bathrooms: 1,
    description: 'Spacious 2BR railroad-style apartment. Exposed brick, tons of natural light. Steps from St. Marks.',
    availableDate: '2026-05-01',
    lat: 40.7303, lng: -73.9824,
  },
  {
    id: 'se-004', source: 'streeteasy',
    url: 'https://streeteasy.com/building/201-west-70th-street-new_york',
    address: '201 West 70th St, 5C',
    borough: 'Manhattan', neighborhood: 'Upper West Side', zip: '10023',
    price: 3200, bedrooms: 2, bathrooms: 1,
    description: 'Classic UWS 2BR near Central Park and Lincoln Center. Doorman building with roof deck.',
    availableDate: '2026-04-01',
    lat: 40.7772, lng: -73.9799,
  },
  {
    id: 'se-005', source: 'streeteasy',
    url: 'https://streeteasy.com/building/315-west-78th-street-new_york',
    address: '315 W. 78th Street, 6A',
    borough: 'Manhattan', neighborhood: 'Upper West Side', zip: '10024',
    price: 2650, bedrooms: 1, bathrooms: 1,
    description: 'Sunny 1BR with river views. Pre-war details, renovated bathroom. Walk to Riverside Park.',
    availableDate: '2026-05-15',
    lat: 40.7832, lng: -73.9775,
  },
  {
    id: 'se-006', source: 'streeteasy',
    url: 'https://streeteasy.com/building/345-east-86th-street-new_york',
    address: '345 E 86th St #12F',
    borough: 'Manhattan', neighborhood: 'Upper East Side', zip: '10028',
    price: 3450, bedrooms: 2, bathrooms: 2,
    description: 'Large 2BR/2BA in full-service building. Gym, laundry, 24hr doorman. Near Q train.',
    availableDate: '2026-04-15',
    lat: 40.7776, lng: -73.9515,
  },
  {
    id: 'se-007', source: 'streeteasy',
    url: 'https://streeteasy.com/building/512-east-12th-street-new_york',
    address: '512 E 12th St, #4F',
    borough: 'Manhattan', neighborhood: 'East Village', zip: '10009',
    price: 2900, bedrooms: 2, bathrooms: 1,
    description: 'Renovated 2BR with in-unit washer/dryer. Dishwasher, great closets. Pet friendly.',
    availableDate: '2026-06-01',
    lat: 40.7295, lng: -73.9815,
  },
  {
    id: 'cl-008', source: 'craigslist',
    url: 'https://newyork.craigslist.org/search/mnh/apa?query=424+W+84th+St',
    address: '424 W 84th St, 2A',
    borough: 'Manhattan', neighborhood: 'Upper West Side', zip: '10024',
    price: 1950, bedrooms: 0, bathrooms: 1,
    description: 'Charming studio on tree-lined block. Original moldings, quiet rear-facing. Cats OK.',
    availableDate: '2026-04-01',
    lat: 40.7862, lng: -73.9751,
  },

  // --- Brooklyn ---
  {
    id: 'se-009', source: 'streeteasy',
    url: 'https://streeteasy.com/building/279-sterling-place-brooklyn',
    address: '279 Sterling Pl, Apt 2',
    borough: 'Brooklyn', neighborhood: 'Crown Heights', zip: '11238',
    price: 1800, bedrooms: 1, bathrooms: 1,
    description: '1BR in brownstone building on quiet block. Near Prospect Park and Brooklyn Museum.',
    availableDate: '2026-04-15',
    lat: 40.6784, lng: -73.9629,
  },
  {
    id: 'se-010', source: 'streeteasy',
    url: 'https://streeteasy.com/building/485-saint-johns-place-brooklyn',
    address: '485 Saint Johns Place #3R',
    borough: 'Brooklyn', neighborhood: 'Crown Heights', zip: '11238',
    price: 2100, bedrooms: 1, bathrooms: 1,
    description: 'Bright 1BR with original details. Close to Franklin Ave C/S trains. Laundry on-site.',
    availableDate: '2026-05-01',
    lat: 40.6740, lng: -73.9571,
  },
  {
    id: 'se-011', source: 'streeteasy',
    url: 'https://streeteasy.com/building/540-4th-avenue-brooklyn',
    address: '540 4th Avenue, 7B',
    borough: 'Brooklyn', neighborhood: 'Park Slope', zip: '11215',
    price: 2400, bedrooms: 2, bathrooms: 1,
    description: 'Corner 2BR with open layout. Updated kitchen, near R train and Prospect Park.',
    availableDate: '2026-04-01',
    lat: 40.6728, lng: -73.9821,
  },
  {
    id: 'cl-012', source: 'craigslist',
    url: 'https://newyork.craigslist.org/search/brk/apa?query=95+Bedford+Ave',
    address: '95 Bedford Ave, 4L',
    borough: 'Brooklyn', neighborhood: 'Williamsburg', zip: '11211',
    price: 2750, bedrooms: 1, bathrooms: 1,
    description: 'Williamsburg 1BR near L train. Roof access, bike storage. No fee.',
    availableDate: '2026-05-15',
    lat: 40.7135, lng: -73.9619,
  },
  {
    id: 'se-013', source: 'streeteasy',
    url: 'https://streeteasy.com/building/738-franklin-avenue-brooklyn',
    address: '738 Franklin Ave, 2B',
    borough: 'Brooklyn', neighborhood: 'Crown Heights', zip: '11238',
    price: 2350, bedrooms: 2, bathrooms: 1,
    description: 'Spacious 2BR near Botanic Garden. Hardwood floors, large living room. Heat included.',
    availableDate: '2026-06-01',
    lat: 40.6738, lng: -73.9580,
  },

  // --- Queens ---
  {
    id: 'se-014', source: 'streeteasy',
    url: 'https://streeteasy.com/building/31--12-30th-avenue-queens',
    address: '31-12 30th Ave, Apt 5C',
    borough: 'Queens', neighborhood: 'Astoria', zip: '11102',
    price: 1950, bedrooms: 1, bathrooms: 1,
    description: 'Astoria 1BR near N/W trains. Tons of restaurants, close to Astoria Park.',
    availableDate: '2026-04-15',
    lat: 40.7693, lng: -73.9200,
  },
  {
    id: 'cl-015', source: 'craigslist',
    url: 'https://newyork.craigslist.org/search/que/apa?query=82-15+37th+Avenue',
    address: '82-15 37th Avenue #4D',
    borough: 'Queens', neighborhood: 'Jackson Heights', zip: '11372',
    price: 1650, bedrooms: 0, bathrooms: 1,
    description: 'Affordable studio in Jackson Heights. Diverse neighborhood, near 7 train. All utilities included.',
    availableDate: '2026-04-01',
    lat: 40.7489, lng: -73.8835,
  },
  {
    id: 'se-016', source: 'streeteasy',
    url: 'https://streeteasy.com/building/107--40-queens-boulevard-queens',
    address: '107-40 Queens Blvd, 8A',
    borough: 'Queens', neighborhood: 'Forest Hills', zip: '11375',
    price: 2500, bedrooms: 2, bathrooms: 1,
    description: 'Forest Hills 2BR in doorman building. Near Austin Street shops and E/F/M/R trains.',
    availableDate: '2026-05-01',
    lat: 40.7209, lng: -73.8456,
  },

  // --- Bronx ---
  {
    id: 'se-017', source: 'streeteasy',
    url: 'https://streeteasy.com/building/1520-grand-concourse-bronx',
    address: '1520 Grand Concourse, 8E',
    borough: 'Bronx', neighborhood: 'Concourse', zip: '10457',
    price: 1500, bedrooms: 0, bathrooms: 1,
    description: 'Art Deco studio on the Grand Concourse. High ceilings, original details. Near B/D trains.',
    availableDate: '2026-04-01',
    lat: 40.8372, lng: -73.9090,
  },
  {
    id: 'cl-018', source: 'craigslist',
    url: 'https://newyork.craigslist.org/search/brx/apa?query=2575+Palisade+Ave',
    address: '2575 Palisade Ave, 3A',
    borough: 'Bronx', neighborhood: 'Riverdale', zip: '10463',
    price: 2200, bedrooms: 2, bathrooms: 1,
    description: 'Riverdale 2BR with Hudson River views. Quiet, tree-lined neighborhood. Near express bus.',
    availableDate: '2026-05-15',
    lat: 40.8866, lng: -73.9108,
  },
  {
    id: 'se-019', source: 'streeteasy',
    url: 'https://streeteasy.com/building/2155-university-avenue-bronx',
    address: '2155 University Ave, 6C',
    borough: 'Bronx', neighborhood: 'University Heights', zip: '10453',
    price: 1400, bedrooms: 0, bathrooms: 1,
    description: 'Affordable studio near Bronx Community College. Elevator building, laundry on-site.',
    availableDate: '2026-04-15',
    lat: 40.8530, lng: -73.9156,
  },

  // --- Staten Island ---
  {
    id: 'se-020', source: 'streeteasy',
    url: 'https://streeteasy.com/building/1000-richmond-terrace-staten_island',
    address: '1000 Richmond Terrace, 2B',
    borough: 'Staten Island', neighborhood: 'St. George', zip: '10301',
    price: 1750, bedrooms: 1, bathrooms: 1,
    description: '1BR near Staten Island Ferry terminal. Waterfront views, easy Manhattan commute.',
    availableDate: '2026-04-01',
    lat: 40.6435, lng: -74.0765,
  },
];

// ============================================================
// PART 5: MATCH LISTINGS TO RS BUILDINGS
// Run each listing through findRSBuilding() and annotate it
// ============================================================

function matchListingsToRS(listings) {
  return listings.map(listing => {
    const rsBuilding = findRSBuilding(listing.address, listing.borough);
    return {
      ...listing,
      rsMatch: rsBuilding ? true : false,
      rsBuilding: rsBuilding || null,
      // Individual unit RS status is almost never verifiable from DHCR data
      rsUnitVerified: false,
    };
  });
}

// ============================================================
// PART 6: STATE MANAGEMENT + DATA LOADING
// ============================================================

let allListings = [];
let filteredListings = [];
let map;
let markersLayer;
let modalMap;
let currentView = 'split';
let currentPage = 1;
const LISTINGS_PER_PAGE = 6;

// Load listings: try worker first, fall back to sample data
async function loadListings() {
  // If a worker URL is configured, try fetching live listings
  if (WORKER_URL) {
    try {
      const resp = await fetch(`${WORKER_URL}/api/listings`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.listings && data.listings.length > 0) {
          return data.listings;
        }
      }
    } catch (err) {
      console.warn('[StableNYC] Worker unavailable, using sample data:', err.message);
    }
  }
  // Fall back to sample data
  return SAMPLE_LISTINGS;
}

async function loadData() {
  showLoading(true);

  try {
    const rawListings = await loadListings();

    // Match every listing against the RS building registry
    const matched = matchListingsToRS(rawListings);

    // Only keep listings that matched an RS building
    allListings = matched.filter(l => l.rsMatch);

    console.log(`[StableNYC] ${rawListings.length} raw listings → ${allListings.length} matched to RS buildings`);
  } catch (err) {
    console.error('[StableNYC] Failed to load listings:', err);
    allListings = [];
  }

  showLoading(false);
  updateStats();
  applyFilters();
}

// ============================================================
// PART 7: FILTER + SORT LOGIC
// ============================================================

function applyFilters() {
  const borough = document.getElementById('filter-borough').value;
  const price = document.getElementById('filter-price').value;
  const bedrooms = document.getElementById('filter-bedrooms').value;
  const search = document.getElementById('filter-search').value.toLowerCase().trim();
  const sortBy = document.getElementById('sort-by').value;

  filteredListings = allListings.filter(l => {
    // Borough
    if (borough !== 'all' && l.borough !== borough) return false;

    // Price range
    if (price !== 'all') {
      const p = l.price || 0;
      if (price === 'under1500' && p >= 1500) return false;
      if (price === '1500-2000' && (p < 1500 || p >= 2000)) return false;
      if (price === '2000-2500' && (p < 2000 || p >= 2500)) return false;
      if (price === '2500-3000' && (p < 2500 || p >= 3000)) return false;
      if (price === '3000plus' && p < 3000) return false;
    }

    // Bedrooms
    if (bedrooms !== 'all') {
      if (bedrooms === 'studio' && l.bedrooms !== 0) return false;
      if (bedrooms === '1' && l.bedrooms !== 1) return false;
      if (bedrooms === '2' && l.bedrooms !== 2) return false;
      if (bedrooms === '3plus' && l.bedrooms < 3) return false;
    }

    // Text search
    if (search) {
      const haystack = `${l.address} ${l.borough} ${l.neighborhood || ''} ${l.zip || ''} ${l.description || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  // Sort
  switch (sortBy) {
    case 'price-asc': filteredListings.sort((a, b) => (a.price || 0) - (b.price || 0)); break;
    case 'price-desc': filteredListings.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
    case 'date-asc': filteredListings.sort((a, b) => new Date(a.availableDate || '2099') - new Date(b.availableDate || '2099')); break;
    case 'newest': filteredListings.sort((a, b) => new Date(b.availableDate || '1900') - new Date(a.availableDate || '1900')); break;
    case 'borough': filteredListings.sort((a, b) => a.borough.localeCompare(b.borough)); break;
  }

  currentPage = 1;
  renderListings();
  updateMapMarkers();
}

function resetFilters() {
  document.getElementById('filter-borough').value = 'all';
  document.getElementById('filter-price').value = 'all';
  document.getElementById('filter-bedrooms').value = 'all';
  document.getElementById('filter-search').value = '';
  document.getElementById('sort-by').value = 'price-asc';
  applyFilters();
}

// ============================================================
// PART 8: MAP INITIALIZATION + MARKERS
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

function updateMapMarkers() {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();

  const withCoords = filteredListings.filter(l => l.lat && l.lng);

  withCoords.forEach(listing => {
    const priceLabel = listing.price ? `$${listing.price.toLocaleString()}` : 'RS';

    const icon = L.divIcon({
      className: 'price-marker-wrapper',
      html: `<div class="price-pill" data-listing-id="${listing.id}">
        ${escapeHtml(priceLabel)}
      </div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const bedroomLabel = listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms}BR`;

    const marker = L.marker([listing.lat, listing.lng], { icon });

    marker.bindPopup(`
      <div class="map-popup">
        <div style="padding:12px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span class="rs-badge-small">RS Building</span>
          </div>
          <strong>${escapeHtml(listing.address)}</strong>
          <p>${escapeHtml(listing.neighborhood || listing.borough)}</p>
          <p style="font-size:0.95rem;font-weight:700;color:var(--accent);margin:4px 0;">
            $${(listing.price || 0).toLocaleString()}/mo &middot; ${bedroomLabel}
          </p>
          <button class="popup-btn" onclick="openModal('${listing.id}')">View Details</button>
        </div>
      </div>
    `, { maxWidth: 260, minWidth: 200 });

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
// UI HELPERS
// ============================================================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatPrice(price) {
  if (!price) return 'Contact for price';
  return `$${price.toLocaleString()}`;
}

function formatBedrooms(br) {
  if (br === 0) return 'Studio';
  if (br === 1) return '1 Bed';
  return `${br} Beds`;
}

function formatDate(d) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function sourceLabel(source) {
  if (source === 'streeteasy') return 'StreetEasy';
  if (source === 'craigslist') return 'Craigslist';
  if (source === 'facebook') return 'Facebook';
  return source || 'Listing';
}

function showLoading(show) {
  const grid = document.getElementById('listings-grid');
  if (show) {
    grid.innerHTML = `
      <div class="loading-state" style="grid-column:1/-1; text-align:center; padding:60px 20px;">
        <div class="loading-spinner"></div>
        <p style="color:var(--text-muted); margin-top:16px;">Matching listings to DHCR rent stabilization registry...</p>
      </div>`;
  }
}

function updateStats() {
  document.getElementById('listing-count').textContent = allListings.length;
  const boroughs = new Set(allListings.map(l => l.borough).filter(Boolean));
  const boroughCountEl = document.getElementById('borough-count');
  if (boroughCountEl) boroughCountEl.textContent = boroughs.size;
  const bldgCountEl = document.getElementById('building-count');
  if (bldgCountEl) bldgCountEl.textContent = RS_BUILDINGS.length;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ============================================================
// PART 9: CARD RENDERING + PAGINATION
// ============================================================

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

function renderListings() {
  const grid = document.getElementById('listings-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('results-count');

  count.textContent = `${filteredListings.length} listing${filteredListings.length !== 1 ? 's' : ''} found`;

  if (filteredListings.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    document.getElementById('pagination-container').innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  const pageListings = getPageListings();

  grid.innerHTML = pageListings.map((l, i) => {
    const bedroomLabel = formatBedrooms(l.bedrooms);
    const rsBuilding = l.rsBuilding;
    const mapThumb = l.lat && l.lng
      ? `https://a.basemaps.cartocdn.com/light_all/15/${Math.floor((l.lng + 180) / 360 * Math.pow(2, 15))}/${Math.floor((1 - Math.log(Math.tan(l.lat * Math.PI / 180) + 1 / Math.cos(l.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, 15))}.png`
      : '';

    return `
    <article class="listing-card" data-id="${l.id}" onclick="openModal('${l.id}')" style="animation-delay:${Math.min(i * 0.03, 0.15)}s" tabindex="0" role="button" aria-label="View ${escapeHtml(l.address)}"
      onmouseenter="highlightMarker('${l.id}')" onmouseleave="unhighlightMarker('${l.id}')">
      <div class="card-image" ${mapThumb ? `style="background-image:url('${mapThumb}')"` : ''}>
        <div class="card-badges">
          <span class="rs-badge">Rent Stabilized</span>
          <span class="source-badge">${escapeHtml(sourceLabel(l.source))}</span>
        </div>
        <div class="card-price">${formatPrice(l.price)}<span>/mo</span></div>
      </div>
      <div class="card-body">
        <h3 class="card-address">${escapeHtml(l.address)}</h3>
        <p class="card-neighborhood">${escapeHtml(l.neighborhood || l.borough)}${l.zip ? ', ' + l.zip : ''}</p>
        <div class="card-details">
          <span class="card-detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
            ${bedroomLabel}${l.bathrooms ? ` / ${l.bathrooms} Bath` : ''}
          </span>
          ${l.availableDate ? `<span class="card-detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Avail ${formatDate(l.availableDate)}
          </span>` : ''}
        </div>
        ${rsBuilding ? `<div class="card-rs-info">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          DHCR Registry &middot; ${rsBuilding.units} units &middot; Built ${rsBuilding.yearBuilt}
        </div>` : ''}
      </div>
      <div class="card-footer">
        <span class="card-rs-note">Unit RS status unverified</span>
        <a href="${l.url}" target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">
          View on ${escapeHtml(sourceLabel(l.source))}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    </article>`;
  }).join('');

  const paginationContainer = document.getElementById('pagination-container');
  if (paginationContainer) {
    paginationContainer.innerHTML = renderPagination();
  }
}

// ============================================================
// PART 10: DETAIL MODAL
// ============================================================

function openModal(id) {
  const listing = allListings.find(l => l.id === id);
  if (!listing) return;

  const modal = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  const hasCoords = listing.lat && listing.lng;
  const rsBuilding = listing.rsBuilding;
  const bedroomLabel = formatBedrooms(listing.bedrooms);

  content.innerHTML = `
    ${hasCoords ? `<div class="modal-map-full" id="modal-map-container"></div>` : ''}
    <div class="modal-body">
      <div class="modal-badges">
        <span class="rs-badge">Rent Stabilized Building</span>
        <span class="source-badge">${escapeHtml(sourceLabel(listing.source))}</span>
      </div>

      <div class="modal-price-row">
        <span class="modal-price">${formatPrice(listing.price)}<span class="modal-price-period">/mo</span></span>
        <span class="modal-bedrooms">${bedroomLabel}${listing.bathrooms ? ` / ${listing.bathrooms} Bath` : ''}</span>
      </div>

      <h2>${escapeHtml(listing.address)}</h2>
      <p class="modal-neighborhood">${escapeHtml(listing.neighborhood || listing.borough)}${listing.zip ? ', ' + listing.zip : ''}</p>

      ${listing.availableDate ? `<p class="modal-available">Available ${formatDate(listing.availableDate)}</p>` : ''}

      ${listing.description ? `<div class="modal-description"><p>${escapeHtml(listing.description)}</p></div>` : ''}

      ${rsBuilding ? `
      <div class="modal-rs-section">
        <h3>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          DHCR Rent Stabilization Record
        </h3>
        <div class="modal-details-grid">
          <div class="modal-detail-item">
            <span class="modal-detail-label">Building Address</span>
            <span class="modal-detail-value">${escapeHtml(rsBuilding.address)}</span>
          </div>
          <div class="modal-detail-item">
            <span class="modal-detail-label">Borough</span>
            <span class="modal-detail-value">${escapeHtml(rsBuilding.borough)}</span>
          </div>
          <div class="modal-detail-item">
            <span class="modal-detail-label">ZIP Code</span>
            <span class="modal-detail-value">${escapeHtml(rsBuilding.zip)}</span>
          </div>
          <div class="modal-detail-item">
            <span class="modal-detail-label">RS Units in Building</span>
            <span class="modal-detail-value">${rsBuilding.units}</span>
          </div>
          <div class="modal-detail-item">
            <span class="modal-detail-label">Year Built</span>
            <span class="modal-detail-value">${rsBuilding.yearBuilt}</span>
          </div>
          <div class="modal-detail-item">
            <span class="modal-detail-label">Block / Lot</span>
            <span class="modal-detail-value">${escapeHtml(rsBuilding.block)} / ${escapeHtml(rsBuilding.lot)}</span>
          </div>
        </div>
        <div class="modal-rs-disclaimer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          <span>This building is on the DHCR rent stabilization registry. However, the stabilization status of this specific unit is <strong>unverified</strong>. Ask the landlord to confirm and check your lease for an RS rider.</span>
        </div>
      </div>
      ` : ''}

      <div class="modal-actions">
        <a href="${listing.url}" target="_blank" rel="noopener" class="btn btn-primary" style="flex:1;justify-content:center;text-decoration:none;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          View on ${escapeHtml(sourceLabel(listing.source))}
        </a>
        ${rsBuilding ? `<a href="https://apps.hcr.ny.gov/BuildingSearch/" target="_blank" rel="noopener" class="btn btn-secondary" style="flex:1;justify-content:center;text-decoration:none;">
          DHCR Building Search
        </a>` : ''}
      </div>

      <p style="font-size:0.75rem; color:var(--text-muted); margin-top:16px; text-align:center;">
        Listing from ${escapeHtml(sourceLabel(listing.source))}. RS building data from
        <a href="https://rentguidelinesboard.cityofnewyork.us/resources/rent-stabilized-building-lists/" target="_blank" rel="noopener" style="color:var(--accent);">NYC Rent Guidelines Board</a>.
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
        dragging: true,
        scrollWheelZoom: false,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '', subdomains: 'abcd', maxZoom: 20,
      }).addTo(modalMap);
      L.circleMarker([listing.lat, listing.lng], {
        radius: 10, fillColor: 'var(--accent, #0D9488)', color: '#fff', weight: 3, fillOpacity: 0.9,
      }).addTo(modalMap);
    }, 150);
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
  if (modalMap) { modalMap.remove(); modalMap = null; }
}

// ============================================================
// PART 11: EVENT LISTENERS
// ============================================================

// Modal close
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// View toggle
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

// Navbar scroll
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
});

// Filter change events
['filter-borough', 'filter-price', 'filter-bedrooms', 'sort-by'].forEach(id => {
  document.getElementById(id).addEventListener('change', applyFilters);
});
document.getElementById('filter-search').addEventListener('input', debounce(applyFilters, 300));

// ============================================================
// PART 12: INJECTED STYLES (for dynamic elements)
// ============================================================

const injectedStyle = document.createElement('style');
injectedStyle.textContent = `
.loading-spinner {
  width: 40px; height: 40px; margin: 0 auto;
  border: 3px solid var(--border); border-top-color: var(--accent);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Map markers */
.price-marker-wrapper { background:none !important; border:none !important; }
.price-pill {
  position:absolute; transform:translate(-50%, -100%);
  background:var(--accent, #0D9488); color:white;
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
  border-top:5px solid var(--accent, #0D9488);
}
.price-pill:hover, .price-pill.active {
  z-index:100 !important; transform:translate(-50%, -100%) scale(1.1);
  filter:brightness(1.15);
}

/* RS badge in popups */
.rs-badge-small {
  display:inline-block; background:rgba(22,163,74,0.12); color:#16A34A;
  font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:10px;
  letter-spacing:0.3px;
}

/* Modal map */
.modal-map-full { width:100%; height:200px; }
.modal-map-full .leaflet-container { width:100%; height:100%; }

/* Modal RS section */
.modal-rs-section {
  background:var(--surface, #f8f9fa); border:1px solid var(--border);
  border-radius:var(--radius-md, 12px); padding:20px; margin:20px 0;
}
.modal-rs-section h3 {
  display:flex; align-items:center; gap:8px;
  font-size:0.95rem; color:var(--accent); margin-bottom:16px;
}
.modal-rs-disclaimer {
  display:flex; align-items:flex-start; gap:10px;
  background:rgba(217,119,6,0.08); border:1px solid rgba(217,119,6,0.2);
  border-radius:var(--radius-sm, 8px); padding:12px 16px;
  font-size:0.8rem; color:#92400E; line-height:1.5; margin-top:16px;
}
.modal-rs-disclaimer svg { color:#D97706; margin-top:1px; flex-shrink:0; }

/* Modal price */
.modal-price-row {
  display:flex; align-items:baseline; gap:12px; margin-bottom:8px;
}
.modal-price {
  font-family:'Bricolage Grotesque',sans-serif;
  font-size:1.8rem; font-weight:800; color:var(--text-primary);
}
.modal-price-period { font-size:1rem; font-weight:400; color:var(--text-secondary); }
.modal-bedrooms { font-size:0.95rem; color:var(--text-secondary); }
.modal-available { font-size:0.85rem; color:var(--text-secondary); margin:4px 0 12px; }
.modal-description {
  background:var(--surface, #f8f9fa); border-radius:var(--radius-sm, 8px);
  padding:14px 16px; margin:12px 0; font-size:0.88rem; line-height:1.6;
  color:var(--text-secondary);
}
.modal-badges { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
.modal-actions { display:flex; gap:12px; margin-top:20px; flex-wrap:wrap; }
`;
document.head.appendChild(injectedStyle);

// ============================================================
// PART 13: BOOT
// ============================================================

initMap();
loadData();
