// ============================================================
// StableNYC — NYC Rent-Stabilized Listings Aggregator
// Cross-references rental listings with DHCR building registry
// ============================================================

// ---- Configuration ----
const WORKER_URL = 'https://stablenyc-photo-proxy.rsnyc.workers.dev';
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
  { address: '2183 3RD AVENUE', borough: 'Manhattan', zip: '10115', units: 58, block: '1750', lot: '45', yearBuilt: 2018, lat: 40.8020, lng: -73.9400 },
  { address: '75 EAST 111TH STREET', borough: 'Manhattan', zip: '10029', units: 324, block: '1617', lot: '20', yearBuilt: 2022, lat: 40.7955, lng: -73.9440 },
  { address: '209 EAST 110TH STREET', borough: 'Manhattan', zip: '10029', units: 16, block: '1616', lot: '35', yearBuilt: 1920, lat: 40.7950, lng: -73.9435 },
  { address: '266 WEST 96TH STREET', borough: 'Manhattan', zip: '10025', units: 171, block: '1243', lot: '55', yearBuilt: 2023, lat: 40.7945, lng: -73.9720 },
  { address: '150 WEST 225TH STREET', borough: 'Manhattan', zip: '10463', units: 352, block: '3260', lot: '10', yearBuilt: 2007, lat: 40.8742, lng: -73.9115 },
  { address: '107 EAST 102ND STREET', borough: 'Manhattan', zip: '10029', units: 20, block: '1610', lot: '18', yearBuilt: 1915, lat: 40.7920, lng: -73.9470 },

  // --- Brooklyn ---
  { address: '770 SAINT MARKS AVENUE', borough: 'Brooklyn', zip: '11216', units: 36, block: '1185', lot: '22', yearBuilt: 1930, lat: 40.6740, lng: -73.9520 },
  { address: '33 LINCOLN ROAD', borough: 'Brooklyn', zip: '11225', units: 24, block: '5070', lot: '15', yearBuilt: 1928, lat: 40.6615, lng: -73.9625 },
  { address: '937 ROGERS AVENUE', borough: 'Brooklyn', zip: '11226', units: 48, block: '5078', lot: '32', yearBuilt: 2020, lat: 40.6485, lng: -73.9530 },
  { address: '571 OVINGTON AVENUE', borough: 'Brooklyn', zip: '11209', units: 22, block: '6020', lot: '40', yearBuilt: 1940, lat: 40.6305, lng: -74.0245 },
  { address: '510 FLATBUSH AVENUE', borough: 'Brooklyn', zip: '11225', units: 30, block: '5068', lot: '18', yearBuilt: 2019, lat: 40.6610, lng: -73.9620 },
  { address: '189 SOUTH 9TH STREET', borough: 'Brooklyn', zip: '11211', units: 14, block: '2310', lot: '12', yearBuilt: 1915, lat: 40.7115, lng: -73.9590 },
  { address: '82 MARCY AVENUE', borough: 'Brooklyn', zip: '11211', units: 18, block: '2290', lot: '30', yearBuilt: 1925, lat: 40.7080, lng: -73.9570 },

  // --- Queens ---
  { address: '11-15 BROADWAY', borough: 'Queens', zip: '11106', units: 80, block: '540', lot: '15', yearBuilt: 2020, lat: 40.7680, lng: -73.9260 },
  { address: '1819 SUMMERFIELD STREET', borough: 'Queens', zip: '11385', units: 23, block: '3590', lot: '28', yearBuilt: 1927, lat: 40.6950, lng: -73.9060 },
  { address: '93-23 218TH STREET', borough: 'Queens', zip: '11428', units: 46, block: '10650', lot: '22', yearBuilt: 1928, lat: 40.7220, lng: -73.7405 },
  { address: '784 SENECA AVENUE', borough: 'Queens', zip: '11385', units: 12, block: '3580', lot: '18', yearBuilt: 1925, lat: 40.7048, lng: -73.9020 },

  // --- Bronx ---
  { address: '1459 TAYLOR AVENUE', borough: 'Bronx', zip: '10462', units: 20, block: '3930', lot: '28', yearBuilt: 1928, lat: 40.8350, lng: -73.8620 },
  { address: '950 BRONX PARK SOUTH', borough: 'Bronx', zip: '10460', units: 40, block: '3055', lot: '18', yearBuilt: 1935, lat: 40.8480, lng: -73.8810 },
  { address: '735 WALTON AVENUE', borough: 'Bronx', zip: '10451', units: 30, block: '2425', lot: '42', yearBuilt: 1925, lat: 40.8285, lng: -73.9215 },
  { address: '2718 MORRIS AVENUE', borough: 'Bronx', zip: '10468', units: 37, block: '3240', lot: '22', yearBuilt: 1921, lat: 40.8660, lng: -73.8990 },
  { address: '1149 MORRIS AVENUE', borough: 'Bronx', zip: '10456', units: 18, block: '2480', lot: '35', yearBuilt: 1915, lat: 40.8345, lng: -73.9160 },
  { address: '1777 GRAND CONCOURSE', borough: 'Bronx', zip: '10453', units: 28, block: '2835', lot: '40', yearBuilt: 1930, lat: 40.8460, lng: -73.9100 },
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
    url: 'https://streeteasy.com/building/2183-3-avenue-new_york/705',
    address: '2183 3rd Avenue, #705',
    borough: 'Manhattan', neighborhood: 'East Harlem', zip: '10115',
    price: 2800, bedrooms: 0, bathrooms: 1,
    description: 'Contemporary rent-stabilized studio on the 7th floor with south-facing exposure, floor-to-ceiling windows, and open skyline views including the Empire State Building. Central air, dishwasher, hardwood floors, doorman, elevator, laundry, gym, and roof deck.',
    availableDate: '2026-04-01',
    lat: 40.8020, lng: -73.9400,
  },
  {
    id: 'se-002', source: 'streeteasy',
    url: 'https://streeteasy.com/building/75-east-111-street-new_york/1b',
    address: '75 East 111th Street, #1B',
    borough: 'Manhattan', neighborhood: 'South Harlem', zip: '10029',
    price: 2200, bedrooms: 1, bathrooms: 1,
    description: 'Rent-stabilized 1BR in Sendero Verde Phase I, a newly constructed 324-unit building. Free amenities include outdoor terrace, fitness center, community room, computer room, bicycle storage, package lockers, and broadband internet.',
    availableDate: '2026-04-15',
    lat: 40.7955, lng: -73.9440,
  },
  {
    id: 'se-003', source: 'streeteasy',
    url: 'https://streeteasy.com/building/209-east-110-street-new_york/2',
    address: '209 East 110th Street, #2',
    borough: 'Manhattan', neighborhood: 'East Harlem', zip: '10029',
    price: 2100, bedrooms: 2, bathrooms: 1,
    description: 'Rent-stabilized 2BR with brand new renovations. No fee — just first month and security to move in. Only 1 block to the subway, get to Grand Central in 15 minutes.',
    availableDate: '2026-05-01',
    lat: 40.7950, lng: -73.9435,
  },
  {
    id: 'se-004', source: 'streeteasy',
    url: 'https://streeteasy.com/building/266-west-96th/2s',
    address: '266 West 96th Street, #2S',
    borough: 'Manhattan', neighborhood: 'Upper West Side', zip: '10025',
    price: 2400, bedrooms: 1, bathrooms: 1,
    description: 'Brand-new rent-stabilized apartment on the Upper West Side. Qualified applicants meeting criteria for household size and income can apply.',
    availableDate: '2026-04-01',
    lat: 40.7945, lng: -73.9720,
  },
  {
    id: 'se-005', source: 'streeteasy',
    url: 'https://streeteasy.com/building/150-west-225-street-bronx/29g',
    address: '150 West 225th Street, #29G',
    borough: 'Manhattan', neighborhood: 'Marble Hill', zip: '10463',
    price: 3200, bedrooms: 3, bathrooms: 2,
    description: 'Rent-stabilized 3BR/2BA in The Promenade, 29th floor. All brand-renovated, approximately 1200 sq ft with open east and south views to Midtown.',
    availableDate: '2026-05-15',
    lat: 40.8742, lng: -73.9115,
  },
  {
    id: 'se-006', source: 'streeteasy',
    url: 'https://streeteasy.com/building/107-east-102-street-new_york/5b',
    address: '107 East 102nd Street, #5B',
    borough: 'Manhattan', neighborhood: 'East Harlem', zip: '10029',
    price: 1750, bedrooms: 0, bathrooms: 1,
    description: 'Rent-stabilized studio in well-kept building. A few short blocks from Central Park and the Conservatory Gardens. Bright light, dishwasher, close to the 6 train.',
    availableDate: '2026-04-01',
    lat: 40.7920, lng: -73.9470,
  },

  // --- Brooklyn ---
  {
    id: 'se-007', source: 'streeteasy',
    url: 'https://streeteasy.com/building/770-st-marks-avenue-brooklyn/5h',
    address: '770 Saint Marks Avenue, #5H',
    borough: 'Brooklyn', neighborhood: 'Crown Heights', zip: '11216',
    price: 2500, bedrooms: 2, bathrooms: 1,
    description: 'Rent-stabilized massive 2BR in Crown Heights. King-sized bedrooms, large living room, ample closet space, hardwood floors, elevator, laundry in building, and live-in super.',
    availableDate: '2026-04-15',
    lat: 40.6740, lng: -73.9520,
  },
  {
    id: 'se-008', source: 'streeteasy',
    url: 'https://streeteasy.com/building/the-lincoln-apartments-33-lincoln-road-brooklyn/3g',
    address: '33 Lincoln Road, #3G',
    borough: 'Brooklyn', neighborhood: 'Prospect Lefferts Gardens', zip: '11225',
    price: 2808, bedrooms: 0, bathrooms: 1,
    description: 'Quiet rent-stabilized spacious studio with full stainless-steel kitchen and large bathroom. 1-year lease term.',
    availableDate: '2026-05-01',
    lat: 40.6615, lng: -73.9625,
  },
  {
    id: 'se-009', source: 'streeteasy',
    url: 'https://streeteasy.com/building/937-rogers-avenue-brooklyn/3f',
    address: '937 Rogers Avenue, #3F',
    borough: 'Brooklyn', neighborhood: 'Flatbush', zip: '11226',
    price: 2709, bedrooms: 2, bathrooms: 1,
    description: 'Rent-stabilized large layout 2BR with balcony near Prospect Park. Brand new luxury elevator building with gym, laundry, bike storage, and rooftop access.',
    availableDate: '2026-04-01',
    lat: 40.6485, lng: -73.9530,
  },
  {
    id: 'se-010', source: 'streeteasy',
    url: 'https://streeteasy.com/building/571-ovington-avenue-brooklyn/2c',
    address: '571 Ovington Avenue, #2C',
    borough: 'Brooklyn', neighborhood: 'Bay Ridge', zip: '11209',
    price: 1458, bedrooms: 0, bathrooms: 1,
    description: 'Rent-stabilized studio with kitchen and tub bath. Hardwood flooring, half block from R train. Laundry in building, heat and water included.',
    availableDate: '2026-04-15',
    lat: 40.6305, lng: -74.0245,
  },
  {
    id: 'se-011', source: 'streeteasy',
    url: 'https://streeteasy.com/building/the-lincoln-apartments-510-flatbush-avenue-brooklyn/3b',
    address: '510 Flatbush Avenue, #3B',
    borough: 'Brooklyn', neighborhood: 'Prospect Lefferts Gardens', zip: '11225',
    price: 2500, bedrooms: 0, bathrooms: 1,
    description: 'No-fee spacious west-facing rent-stabilized studio with central heat/AC, large bathroom, full-size kitchen, and 3 closets. Stunning city views, 150 feet from Prospect Park entrance.',
    availableDate: '2026-05-15',
    lat: 40.6610, lng: -73.9620,
  },
  {
    id: 'se-012', source: 'streeteasy',
    url: 'https://streeteasy.com/building/191-south-9-street-brooklyn/9',
    address: '189 South 9th Street, #9',
    borough: 'Brooklyn', neighborhood: 'Williamsburg', zip: '11211',
    price: 2200, bedrooms: 1, bathrooms: 1,
    description: 'Rent-stabilized 1BR, brand new renovated in South Williamsburg. Polished hardwood floors, windows in every room, brand new stainless steel appliances, and large bedrooms.',
    availableDate: '2026-06-01',
    lat: 40.7115, lng: -73.9590,
  },
  {
    id: 'se-013', source: 'streeteasy',
    url: 'https://streeteasy.com/building/82-marcy-avenue-brooklyn/2b',
    address: '82 Marcy Avenue, #2B',
    borough: 'Brooklyn', neighborhood: 'Williamsburg', zip: '11211',
    price: 2400, bedrooms: 1, bathrooms: 1,
    description: 'Rent-stabilized 1BR centrally located minutes from Marcy J/M/Z and Lorimer L/G train. High 10ft ceilings and oversized bright windows, right between the best parts of North and Southside Williamsburg.',
    availableDate: '2026-04-01',
    lat: 40.7080, lng: -73.9570,
  },

  // --- Queens ---
  {
    id: 'se-014', source: 'streeteasy',
    url: 'https://streeteasy.com/building/astoria-at-hallets-cove/2ee',
    address: '11-15 Broadway, #2EE',
    borough: 'Queens', neighborhood: 'Astoria', zip: '11106',
    price: 2800, bedrooms: 1, bathrooms: 1,
    description: 'Chic luxury doorman rent-stabilized 1BR in Astoria at Hallets Cove. Double-height windows, dark oak flooring, high ceilings, recessed lighting, private Bosch washer/dryer. Sweeping Manhattan views from rooftop terraces, fitness center, bike storage.',
    availableDate: '2026-04-15',
    lat: 40.7680, lng: -73.9260,
  },
  {
    id: 'se-015', source: 'streeteasy',
    url: 'https://streeteasy.com/building/1819-summerfield-street-ridgewood/b5',
    address: '1819 Summerfield Street, #B5',
    borough: 'Queens', neighborhood: 'Ridgewood', zip: '11385',
    price: 1600, bedrooms: 1, bathrooms: 1,
    description: 'Rent-stabilized first-floor apartment with hardwood floors, heat and hot water included, and beautiful kitchen cabinetry. Close to the L train (Halsey Street stop), shops, diners, and supermarkets.',
    availableDate: '2026-05-01',
    lat: 40.6950, lng: -73.9060,
  },
  {
    id: 'se-016', source: 'streeteasy',
    url: 'https://streeteasy.com/building/93_23-218-street-queens_village/b12',
    address: '93-23 218th Street, #B12',
    borough: 'Queens', neighborhood: 'Queens Village', zip: '11428',
    price: 1375, bedrooms: 0, bathrooms: 1,
    description: 'Rent-stabilized studio with minimum one-year lease. Heat and hot water included. Live-in super, pet-friendly.',
    availableDate: '2026-04-01',
    lat: 40.7220, lng: -73.7405,
  },
  {
    id: 'se-017', source: 'streeteasy',
    url: 'https://streeteasy.com/building/93_23-218-street-queens_village/c6',
    address: '93-23 218th Street, #C6',
    borough: 'Queens', neighborhood: 'Queens Village', zip: '11428',
    price: 1450, bedrooms: 1, bathrooms: 1,
    description: 'Rent-stabilized 1BR, approximately 550 sq ft. Heat and hot water included. Live-in super, pet-friendly. No broker fee, one month rent and one month security due upon lease signing.',
    availableDate: '2026-05-15',
    lat: 40.7220, lng: -73.7405,
  },
  {
    id: 'se-018', source: 'streeteasy',
    url: 'https://streeteasy.com/building/784-seneca-avenue-ridgewood/2r',
    address: '784 Seneca Avenue, #2R',
    borough: 'Queens', neighborhood: 'Ridgewood', zip: '11385',
    price: 2100, bedrooms: 2, bathrooms: 1,
    description: 'No-fee 2BR rent-stabilized apartment in the heart of Ridgewood. Pet-friendly for cats and small dogs under 15 lbs.',
    availableDate: '2026-04-01',
    lat: 40.7048, lng: -73.9020,
  },

  // --- Bronx ---
  {
    id: 'se-019', source: 'streeteasy',
    url: 'https://streeteasy.com/building/1459-taylor-avenue-bronx/12',
    address: '1459 Taylor Avenue, #12',
    borough: 'Bronx', neighborhood: 'Parkchester', zip: '10462',
    price: 1650, bedrooms: 1, bathrooms: 1,
    description: 'Beautifully renovated rent-stabilized 1BR on the third floor of a well-maintained walk-up building.',
    availableDate: '2026-04-15',
    lat: 40.8350, lng: -73.8620,
  },
  {
    id: 'se-020', source: 'streeteasy',
    url: 'https://streeteasy.com/building/944-bronx-park-south-bronx/4e',
    address: '950 Bronx Park South, #4E',
    borough: 'Bronx', neighborhood: 'West Farms', zip: '10460',
    price: 1950, bedrooms: 2, bathrooms: 1,
    description: 'Rent-stabilized 2BR with stainless steel appliances, hardwood floors, separate kitchen and living room. 4th floor unit in elevator building with heat and water included.',
    availableDate: '2026-05-01',
    lat: 40.8480, lng: -73.8810,
  },
  {
    id: 'se-021', source: 'streeteasy',
    url: 'https://streeteasy.com/building/735-walton-avenue-bronx/d8',
    address: '735 Walton Avenue, #D8',
    borough: 'Bronx', neighborhood: 'Concourse', zip: '10451',
    price: 1800, bedrooms: 1, bathrooms: 1,
    description: 'Beautifully renovated 1BR in well-maintained rent-stabilized elevator building. Renovated kitchen with brand new appliances, queen-sized bedroom, and ample closet space.',
    availableDate: '2026-04-01',
    lat: 40.8285, lng: -73.9215,
  },
  {
    id: 'se-022', source: 'streeteasy',
    url: 'https://streeteasy.com/building/2718-morris-avenue-bronx/4a',
    address: '2718 Morris Avenue, #4A',
    borough: 'Bronx', neighborhood: 'Fordham', zip: '10468',
    price: 1900, bedrooms: 2, bathrooms: 1,
    description: 'Beautiful large 2BR on the fifth floor in well-maintained rent-stabilized walk-up building.',
    availableDate: '2026-05-15',
    lat: 40.8660, lng: -73.8990,
  },
  {
    id: 'se-023', source: 'streeteasy',
    url: 'https://streeteasy.com/building/1149-morris-avenue-bronx/4e',
    address: '1149 Morris Avenue, #4E',
    borough: 'Bronx', neighborhood: 'Concourse', zip: '10456',
    price: 1500, bedrooms: 1, bathrooms: 1,
    description: 'Rent-stabilized apartment, lease directly from owner with no broker fee. Renovated with pass-through kitchen, hardwood floors. Heat, hot water, and cooking gas included.',
    availableDate: '2026-06-01',
    lat: 40.8345, lng: -73.9160,
  },
  {
    id: 'se-024', source: 'streeteasy',
    url: 'https://streeteasy.com/building/1777-grand-concourse-bronx/4d',
    address: '1777 Grand Concourse, #4D',
    borough: 'Bronx', neighborhood: 'Mt. Hope', zip: '10453',
    price: 1194, bedrooms: 0, bathrooms: 1,
    description: 'Rent-stabilized studio on the Grand Concourse in Mt. Hope.',
    availableDate: '2026-04-01',
    lat: 40.8460, lng: -73.9100,
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
      const resp = await fetch(`${WORKER_URL}?action=listings&borough=all`);
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
