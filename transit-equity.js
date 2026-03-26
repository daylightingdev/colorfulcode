// ============================================================
// Transit Equity Gap Finder — NYC Walkshed Analysis
// ============================================================

// ---- Configuration ----
// NYC Open Data: Subway Stations (kk4q-3rt2) + NY State: MTA Subway Stations (39hk-dx4f)
const MTA_SUBWAY_STOPS_URLS = [
  'https://data.cityofnewyork.us/resource/kk4q-3rt2.json?$limit=1000',
  'https://data.ny.gov/resource/39hk-dx4f.json?$limit=1000',
];
// NYC Open Data: Transportation Sites for bus stops
const MTA_BUS_STOPS_URLS = [
  'https://data.cityofnewyork.us/resource/hg3c-2jsy.json?$limit=10000',
];
// NYC Open Data: Bus Stop Shelters (separate layer)
const BUS_SHELTERS_URL = 'https://data.cityofnewyork.us/resource/qu8g-sxqf.json?$limit=10000';
const COUNCIL_DISTRICTS_URL = 'https://data.cityofnewyork.us/resource/yusd-j4xi.geojson?$limit=100';
const CENSUS_TRACTS_URL = 'https://data.cityofnewyork.us/resource/i69b-3rdj.json?$limit=5000';

const NYC_CENTER = [-73.935242, 40.730610];
const NYC_BOUNDS = [[-74.27, 40.48], [-73.68, 40.92]];
const WALK_SPEED_MPH = 3.1; // average walking speed

// ---- Application State ----
const state = {
  map: null,
  mapLoaded: false,
  subwayStops: [],
  busStops: [],
  busShelters: [],
  councilDistricts: null,
  censusData: [],
  analysisGrid: null,
  walkTimeMinutes: 10,
  selectedDistrict: null,
  showSubway: true,
  showBus: true,
  showShelters: true,
  showWalkshed: false,
};

// ---- DOM References ----
const dom = {
  tokenPrompt: document.getElementById('token-prompt'),
  tokenInput: document.getElementById('mapbox-token'),
  tokenSubmit: document.getElementById('token-submit'),
  controls: document.getElementById('controls'),
  districtSelect: document.getElementById('district-select'),
  walkTime: document.getElementById('walk-time'),
  walkTimeVal: document.getElementById('walk-time-val'),
  showSubway: document.getElementById('show-subway'),
  showBus: document.getElementById('show-bus'),
  showShelters: document.getElementById('show-shelters'),
  showWalkshed: document.getElementById('show-walkshed'),
  statZones: document.getElementById('stat-zones'),
  statGaps: document.getElementById('stat-gaps'),
  statPop: document.getElementById('stat-pop'),
  statScore: document.getElementById('stat-score'),
  detailsPanel: document.getElementById('details-panel'),
  detailsContent: document.getElementById('details-content'),
  loading: document.getElementById('loading'),
  loadingText: document.getElementById('loading-text'),
};

// ============================================================
// INITIALIZATION
// ============================================================

(function init() {
  // Check for saved token
  const savedToken = localStorage.getItem('mapbox_token');
  if (savedToken) {
    startApp(savedToken);
  }

  dom.tokenSubmit.addEventListener('click', () => {
    const token = dom.tokenInput.value.trim();
    if (token) {
      localStorage.setItem('mapbox_token', token);
      startApp(token);
    }
  });

  dom.tokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') dom.tokenSubmit.click();
  });
})();

async function startApp(token) {
  dom.tokenPrompt.classList.add('hidden');
  showLoading('Initializing map...');

  mapboxgl.accessToken = token;

  state.map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: NYC_CENTER,
    zoom: 11,
    maxBounds: NYC_BOUNDS,
  });

  state.map.addControl(new mapboxgl.NavigationControl(), 'top-right');

  state.map.on('load', async () => {
    state.mapLoaded = true;
    try {
      await loadAllData();
      setupMapLayers();
      setupEventListeners();
      runAnalysis();
      dom.controls.classList.remove('hidden');
    } catch (err) {
      console.error('Failed to load data:', err);
      dom.loadingText.textContent = 'Error loading data. Check console.';
      return;
    }
    hideLoading();
  });
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadAllData() {
  showLoading('Fetching transit & census data...');
  const [subway, bus, shelters, districts, census] = await Promise.all([
    fetchSubwayStops(),
    fetchBusStops(),
    fetchBusShelters(),
    fetchCouncilDistricts(),
    fetchCensusData(),
  ]);
  state.subwayStops = subway;
  state.busStops = bus;
  state.busShelters = shelters;
  state.councilDistricts = districts;
  state.censusData = census;
  populateDistrictDropdown();
}

async function fetchSubwayStops() {
  showLoading('Loading subway stops...');

  // Try multiple data sources, merge results, deduplicate
  const allStops = [];
  for (const url of MTA_SUBWAY_STOPS_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const s of data) {
        // Handle varying field structures across datasets
        let lat, lng;
        if (s.the_geom && s.the_geom.coordinates) {
          lng = parseFloat(s.the_geom.coordinates[0]);
          lat = parseFloat(s.the_geom.coordinates[1]);
        } else if (s.georeference && s.georeference.coordinates) {
          lng = parseFloat(s.georeference.coordinates[0]);
          lat = parseFloat(s.georeference.coordinates[1]);
        } else if (s.latitude && s.longitude) {
          lat = parseFloat(s.latitude);
          lng = parseFloat(s.longitude);
        } else {
          continue;
        }
        if (isNaN(lat) || isNaN(lng)) continue;
        allStops.push({
          type: 'subway',
          name: s.stop_name || s.name || s.station_name || s.complex_name || 'Unknown',
          lines: s.line || s.daytime_routes || s.routes || '',
          lat,
          lng,
        });
      }
    } catch (e) {
      console.warn(`Subway fetch failed for ${url}:`, e);
    }
  }

  if (allStops.length > 0) {
    // Deduplicate by proximity (within ~50m)
    return deduplicateStops(allStops);
  }

  console.warn('All subway APIs failed, using fallback');
  return generateFallbackSubwayStops();
}

async function fetchBusStops() {
  showLoading('Loading bus stops...');

  const allStops = [];
  for (const url of MTA_BUS_STOPS_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const s of data) {
        let lat, lng;
        if (s.the_geom && s.the_geom.coordinates) {
          lng = parseFloat(s.the_geom.coordinates[0]);
          lat = parseFloat(s.the_geom.coordinates[1]);
        } else if (s.latitude && s.longitude) {
          lat = parseFloat(s.latitude);
          lng = parseFloat(s.longitude);
        } else {
          continue;
        }
        if (isNaN(lat) || isNaN(lng)) continue;
        allStops.push({
          type: 'bus',
          name: s.stop_name || s.name || s.facname || 'Bus Stop',
          routes: s.routes || s.route || '',
          lat,
          lng,
        });
      }
    } catch (e) {
      console.warn(`Bus fetch failed for ${url}:`, e);
    }
  }

  if (allStops.length > 0) {
    return deduplicateStops(allStops);
  }

  console.warn('All bus APIs failed, using fallback');
  return generateFallbackBusStops();
}

async function fetchBusShelters() {
  showLoading('Loading bus shelters...');
  try {
    const res = await fetch(BUS_SHELTERS_URL);
    if (!res.ok) return [];
    const data = await res.json();
    return data
      .filter(s => {
        if (s.the_geom && s.the_geom.coordinates) return true;
        if (s.latitude && s.longitude) return true;
        return false;
      })
      .map(s => {
        let lat, lng;
        if (s.the_geom && s.the_geom.coordinates) {
          lng = parseFloat(s.the_geom.coordinates[0]);
          lat = parseFloat(s.the_geom.coordinates[1]);
        } else {
          lat = parseFloat(s.latitude);
          lng = parseFloat(s.longitude);
        }
        return {
          type: 'shelter',
          name: s.shelter_id || s.stop_name || s.name || 'Bus Shelter',
          routes: s.routes || s.route || '',
          lat,
          lng,
        };
      })
      .filter(s => !isNaN(s.lat) && !isNaN(s.lng));
  } catch (e) {
    console.warn('Bus shelters fetch failed', e);
    return [];
  }
}

async function fetchCouncilDistricts() {
  showLoading('Loading council districts...');
  try {
    const res = await fetch(COUNCIL_DISTRICTS_URL);
    const data = await res.json();
    if (data.type === 'FeatureCollection' && data.features) return data;
    return buildFallbackDistricts();
  } catch (e) {
    console.warn('Council districts fetch failed, using fallback', e);
    return buildFallbackDistricts();
  }
}

async function fetchCensusData() {
  showLoading('Loading census data...');
  try {
    const res = await fetch(CENSUS_TRACTS_URL);
    const data = await res.json();
    return data
      .filter(d => d.the_geom)
      .map(d => ({
        geoid: d.geoid || d.geo_id || '',
        population: parseInt(d.pop_100 || d.population || d.p001001 || 0, 10),
        medianIncome: parseInt(d.median_income || d.b19013001 || 50000, 10),
        geometry: d.the_geom,
      }));
  } catch (e) {
    console.warn('Census data fetch failed', e);
    return [];
  }
}

// ---- Deduplication ----

function deduplicateStops(stops) {
  const unique = [];
  for (const s of stops) {
    const isDupe = unique.some(u =>
      Math.abs(u.lat - s.lat) < 0.0004 && Math.abs(u.lng - s.lng) < 0.0004
    );
    if (!isDupe) unique.push(s);
  }
  return unique;
}

// ---- Fallback Data Generators ----

function generateFallbackSubwayStops() {
  const stops = [
    // === MANHATTAN — Lower ===
    { name: 'South Ferry', lines: '1', lat: 40.7019, lng: -74.0130 },
    { name: 'Whitehall St', lines: 'R/W', lat: 40.7032, lng: -74.0129 },
    { name: 'Bowling Green', lines: '4/5', lat: 40.7043, lng: -74.0142 },
    { name: 'Wall St', lines: '2/3', lat: 40.7069, lng: -74.0098 },
    { name: 'Broad St', lines: 'J/Z', lat: 40.7065, lng: -74.0110 },
    { name: 'Fulton St', lines: '2/3/4/5/A/C/J/Z', lat: 40.7092, lng: -74.0065 },
    { name: 'Park Place', lines: '2/3', lat: 40.7131, lng: -74.0087 },
    { name: 'Chambers St', lines: 'A/C/1/2/3', lat: 40.7154, lng: -74.0094 },
    { name: 'City Hall', lines: 'R/W', lat: 40.7138, lng: -74.0070 },
    { name: 'Brooklyn Bridge-City Hall', lines: '4/5/6', lat: 40.7133, lng: -74.0040 },
    { name: 'Canal St (ACE)', lines: 'A/C/E', lat: 40.7209, lng: -74.0050 },
    { name: 'Canal St (NQRW)', lines: 'N/Q/R/W', lat: 40.7191, lng: -73.9999 },
    { name: 'Canal St (JZ)', lines: 'J/Z', lat: 40.7180, lng: -73.9998 },
    { name: 'Spring St (6)', lines: '6', lat: 40.7224, lng: -73.9971 },
    { name: 'Houston St', lines: '1', lat: 40.7283, lng: -74.0053 },
    { name: 'Bleecker St', lines: '6', lat: 40.7260, lng: -73.9947 },
    { name: 'Broadway-Lafayette', lines: 'B/D/F/M', lat: 40.7254, lng: -73.9962 },
    { name: 'Astor Pl', lines: '6', lat: 40.7305, lng: -73.9910 },
    { name: 'W 4 St-Washington Sq', lines: 'A/B/C/D/E/F/M', lat: 40.7322, lng: -74.0003 },
    { name: '8 St-NYU', lines: 'R/W', lat: 40.7305, lng: -73.9925 },
    // === MANHATTAN — Midtown ===
    { name: '14 St-Union Sq', lines: '4/5/6/L/N/Q/R/W', lat: 40.7359, lng: -73.9906 },
    { name: '14 St (ACE)', lines: 'A/C/E', lat: 40.7408, lng: -74.0002 },
    { name: '14 St (123)', lines: '1/2/3', lat: 40.7377, lng: -74.0000 },
    { name: '23 St (6)', lines: '6', lat: 40.7396, lng: -73.9862 },
    { name: '23 St (CE)', lines: 'C/E', lat: 40.7460, lng: -74.0018 },
    { name: '23 St (1)', lines: '1', lat: 40.7419, lng: -73.9953 },
    { name: '28 St (6)', lines: '6', lat: 40.7431, lng: -73.9844 },
    { name: '33 St (6)', lines: '6', lat: 40.7462, lng: -73.9824 },
    { name: '34 St-Herald Sq', lines: 'B/D/F/M/N/Q/R/W', lat: 40.7499, lng: -73.9878 },
    { name: '34 St-Penn Station (123)', lines: '1/2/3', lat: 40.7506, lng: -73.9935 },
    { name: '34 St-Penn Station (ACE)', lines: 'A/C/E', lat: 40.7523, lng: -73.9932 },
    { name: 'Times Sq-42 St', lines: '1/2/3/7/N/Q/R/W/S', lat: 40.7557, lng: -73.9870 },
    { name: '42 St-Bryant Park', lines: 'B/D/F/M', lat: 40.7544, lng: -73.9845 },
    { name: 'Grand Central-42 St', lines: '4/5/6/7/S', lat: 40.7527, lng: -73.9772 },
    { name: '42 St-Port Authority', lines: 'A/C/E', lat: 40.7575, lng: -73.9901 },
    { name: '47-50 Sts-Rockefeller', lines: 'B/D/F/M', lat: 40.7586, lng: -73.9814 },
    { name: '49 St', lines: 'N/R/W', lat: 40.7600, lng: -73.9843 },
    { name: '50 St (1)', lines: '1', lat: 40.7618, lng: -73.9839 },
    { name: '51 St', lines: '6', lat: 40.7571, lng: -73.9719 },
    { name: '53 St (EM)', lines: 'E/M', lat: 40.7602, lng: -73.9762 },
    { name: '57 St (NQR)', lines: 'N/Q/R/W', lat: 40.7643, lng: -73.9806 },
    { name: '57 St-7 Av', lines: 'F', lat: 40.7646, lng: -73.9770 },
    // === MANHATTAN — Upper West / Upper East ===
    { name: '59 St-Columbus Circle', lines: '1/A/B/C/D', lat: 40.7681, lng: -73.9819 },
    { name: '59 St (456)', lines: '4/5/6', lat: 40.7629, lng: -73.9681 },
    { name: '66 St-Lincoln Ctr', lines: '1', lat: 40.7735, lng: -73.9822 },
    { name: '68 St-Hunter College', lines: '6', lat: 40.7687, lng: -73.9640 },
    { name: '72 St (123)', lines: '1/2/3', lat: 40.7784, lng: -73.9817 },
    { name: '77 St', lines: '6', lat: 40.7738, lng: -73.9598 },
    { name: '79 St', lines: '1', lat: 40.7839, lng: -73.9799 },
    { name: '81 St-Museum of Nat Hist', lines: 'B/C', lat: 40.7814, lng: -73.9729 },
    { name: '86 St (456)', lines: '4/5/6', lat: 40.7794, lng: -73.9557 },
    { name: '86 St (1)', lines: '1', lat: 40.7880, lng: -73.9768 },
    { name: '86 St (Q)', lines: 'Q', lat: 40.7779, lng: -73.9515 },
    { name: '96 St (123)', lines: '1/2/3', lat: 40.7936, lng: -73.9724 },
    { name: '96 St (6)', lines: '6', lat: 40.7854, lng: -73.9510 },
    { name: '96 St (Q)', lines: 'Q', lat: 40.7842, lng: -73.9472 },
    { name: '103 St (1)', lines: '1', lat: 40.7996, lng: -73.9683 },
    { name: '110 St-Cathedral Pkwy', lines: '1', lat: 40.8037, lng: -73.9668 },
    { name: '110 St (6)', lines: '6', lat: 40.7953, lng: -73.9443 },
    // === MANHATTAN — Harlem / Washington Hts / Inwood ===
    { name: '116 St-Columbia', lines: '1', lat: 40.8072, lng: -73.9641 },
    { name: '116 St (23)', lines: '2/3', lat: 40.8025, lng: -73.9547 },
    { name: '125 St (123)', lines: '1', lat: 40.8158, lng: -73.9585 },
    { name: '125 St (456)', lines: '4/5/6', lat: 40.8043, lng: -73.9375 },
    { name: '125 St (ACD)', lines: 'A/B/C/D', lat: 40.8111, lng: -73.9583 },
    { name: '135 St', lines: '2/3', lat: 40.8142, lng: -73.9409 },
    { name: '137 St-City College', lines: '1', lat: 40.8221, lng: -73.9537 },
    { name: '145 St (1)', lines: '1', lat: 40.8269, lng: -73.9502 },
    { name: '145 St (ACD)', lines: 'A/B/C/D', lat: 40.8246, lng: -73.9441 },
    { name: '155 St', lines: 'C', lat: 40.8302, lng: -73.9416 },
    { name: '157 St', lines: '1', lat: 40.8340, lng: -73.9448 },
    { name: '163 St-Amsterdam', lines: 'C', lat: 40.8360, lng: -73.9399 },
    { name: '168 St', lines: '1/A/C', lat: 40.8407, lng: -73.9395 },
    { name: '175 St', lines: 'A', lat: 40.8473, lng: -73.9397 },
    { name: '181 St (1)', lines: '1', lat: 40.8495, lng: -73.9336 },
    { name: '181 St (A)', lines: 'A', lat: 40.8512, lng: -73.9381 },
    { name: '190 St', lines: 'A', lat: 40.8590, lng: -73.9342 },
    { name: '191 St', lines: '1', lat: 40.8553, lng: -73.9298 },
    { name: 'Dyckman St (1)', lines: '1', lat: 40.8606, lng: -73.9255 },
    { name: 'Dyckman St (A)', lines: 'A', lat: 40.8653, lng: -73.9273 },
    { name: '207 St', lines: '1', lat: 40.8644, lng: -73.9189 },
    { name: 'Inwood-207 St', lines: 'A', lat: 40.8681, lng: -73.9199 },
    { name: '215 St', lines: '1', lat: 40.8694, lng: -73.9152 },
    { name: 'Marble Hill-225 St', lines: '1', lat: 40.8745, lng: -73.9098 },
    // === BROOKLYN — Downtown / Heights ===
    { name: 'Atlantic Av-Barclays', lines: '2/3/4/5/B/D/N/Q/R', lat: 40.6842, lng: -73.9778 },
    { name: 'Jay St-MetroTech', lines: 'A/C/F/R', lat: 40.6924, lng: -73.9871 },
    { name: 'DeKalb Av', lines: 'B/D/N/Q/R', lat: 40.6906, lng: -73.9818 },
    { name: 'Hoyt-Schermerhorn', lines: 'A/C/G', lat: 40.6886, lng: -73.9851 },
    { name: 'Borough Hall', lines: '2/3/4/5', lat: 40.6932, lng: -73.9901 },
    { name: 'Court St', lines: 'R', lat: 40.6941, lng: -73.9917 },
    { name: 'Bergen St', lines: '2/3', lat: 40.6809, lng: -73.9757 },
    { name: 'Clark St', lines: '2/3', lat: 40.6975, lng: -73.9928 },
    { name: 'High St', lines: 'A/C', lat: 40.6994, lng: -73.9909 },
    // === BROOKLYN — Williamsburg / Bushwick / Bed-Stuy ===
    { name: 'Bedford Av', lines: 'L', lat: 40.7174, lng: -73.9567 },
    { name: 'Lorimer St (L)', lines: 'L', lat: 40.7140, lng: -73.9502 },
    { name: 'Graham Av', lines: 'L', lat: 40.7141, lng: -73.9440 },
    { name: 'Grand St (L)', lines: 'L', lat: 40.7119, lng: -73.9406 },
    { name: 'Montrose Av', lines: 'L', lat: 40.7075, lng: -73.9359 },
    { name: 'Morgan Av', lines: 'L', lat: 40.7063, lng: -73.9321 },
    { name: 'Jefferson St', lines: 'L', lat: 40.7066, lng: -73.9229 },
    { name: 'DeKalb Av (L)', lines: 'L', lat: 40.7035, lng: -73.9184 },
    { name: 'Halsey St', lines: 'L', lat: 40.6953, lng: -73.9166 },
    { name: 'Canarsie-Rockaway Pkwy', lines: 'L', lat: 40.6462, lng: -73.9022 },
    { name: 'Marcy Av', lines: 'J/M/Z', lat: 40.7083, lng: -73.9578 },
    { name: 'Hewes St', lines: 'J/M', lat: 40.7068, lng: -73.9534 },
    { name: 'Myrtle-Wyckoff', lines: 'L/M', lat: 40.6997, lng: -73.9120 },
    { name: 'Broadway Junction', lines: 'A/C/J/Z/L', lat: 40.6783, lng: -73.9053 },
    { name: 'Nostrand Av (AC)', lines: 'A/C', lat: 40.6804, lng: -73.9506 },
    { name: 'Kingston-Throop', lines: 'A/C', lat: 40.6797, lng: -73.9409 },
    { name: 'Utica Av (AC)', lines: 'A/C', lat: 40.6791, lng: -73.9309 },
    // === BROOKLYN — Crown Hts / Flatbush / South Brooklyn ===
    { name: 'Franklin Av (CS)', lines: '2/3/4/5/S', lat: 40.6708, lng: -73.9580 },
    { name: 'Prospect Park', lines: 'B/Q/S', lat: 40.6616, lng: -73.9622 },
    { name: 'Church Av (BQ)', lines: 'B/Q', lat: 40.6508, lng: -73.9629 },
    { name: 'Church Av (25)', lines: '2/5', lat: 40.6508, lng: -73.9493 },
    { name: 'Newkirk Av', lines: 'B/Q', lat: 40.6400, lng: -73.9626 },
    { name: 'Beverly Rd', lines: '2/5', lat: 40.6450, lng: -73.9487 },
    { name: 'Flatbush Av-Brooklyn College', lines: '2/5', lat: 40.6328, lng: -73.9476 },
    { name: 'Kings Hwy (BQ)', lines: 'B/Q', lat: 40.6089, lng: -73.9583 },
    { name: 'Sheepshead Bay', lines: 'B/Q', lat: 40.5869, lng: -73.9543 },
    { name: 'Brighton Beach', lines: 'B/Q', lat: 40.5776, lng: -73.9614 },
    { name: 'Coney Island-Stillwell', lines: 'D/F/N/Q', lat: 40.5771, lng: -73.9814 },
    { name: 'West 8 St-Aquarium', lines: 'F/Q', lat: 40.5761, lng: -73.9759 },
    // === BROOKLYN — Bay Ridge / Sunset Park / Bensonhurst ===
    { name: '36 St', lines: 'D/N/R', lat: 40.6551, lng: -74.0033 },
    { name: '59 St (NR)', lines: 'N/R', lat: 40.6413, lng: -74.0174 },
    { name: '86 St (R)', lines: 'R', lat: 40.6226, lng: -74.0283 },
    { name: 'Bay Ridge-95 St', lines: 'R', lat: 40.6166, lng: -74.0310 },
    { name: '8 Av (N)', lines: 'N', lat: 40.6349, lng: -74.0115 },
    { name: 'Ft Hamilton Pkwy (D)', lines: 'D', lat: 40.6406, lng: -73.9944 },
    { name: '18 Av (D)', lines: 'D', lat: 40.6297, lng: -73.9904 },
    { name: '20 Av', lines: 'D', lat: 40.6173, lng: -73.9852 },
    { name: '25 Av', lines: 'D', lat: 40.5977, lng: -73.9868 },
    { name: '62 St', lines: 'D/N', lat: 40.6264, lng: -74.0099 },
    // === QUEENS — Astoria ===
    { name: 'Astoria-Ditmars', lines: 'N/W', lat: 40.7751, lng: -73.9120 },
    { name: 'Astoria Blvd', lines: 'N/W', lat: 40.7702, lng: -73.9179 },
    { name: '30 Av', lines: 'N/W', lat: 40.7668, lng: -73.9214 },
    { name: 'Broadway (NW)', lines: 'N/W', lat: 40.7613, lng: -73.9253 },
    { name: '36 Av', lines: 'N/W', lat: 40.7565, lng: -73.9299 },
    { name: '39 Av-Dutch Kills', lines: 'N/W', lat: 40.7527, lng: -73.9329 },
    // === QUEENS — 7 Line ===
    { name: 'Queensboro Plaza', lines: '7/N/W', lat: 40.7509, lng: -73.9403 },
    { name: 'Court Sq', lines: 'E/G/M/7', lat: 40.7471, lng: -73.9456 },
    { name: 'Hunters Point Av', lines: '7', lat: 40.7424, lng: -73.9488 },
    { name: '33 St-Rawson', lines: '7', lat: 40.7448, lng: -73.9309 },
    { name: '40 St-Lowery', lines: '7', lat: 40.7436, lng: -73.9240 },
    { name: '46 St-Bliss', lines: '7', lat: 40.7434, lng: -73.9183 },
    { name: '52 St', lines: '7', lat: 40.7441, lng: -73.9128 },
    { name: '61 St-Woodside', lines: '7', lat: 40.7455, lng: -73.9028 },
    { name: '69 St', lines: '7', lat: 40.7464, lng: -73.8963 },
    { name: '74 St-Broadway', lines: '7', lat: 40.7469, lng: -73.8912 },
    { name: '82 St-Jackson Hts', lines: '7', lat: 40.7474, lng: -73.8838 },
    { name: '90 St-Elmhurst', lines: '7', lat: 40.7484, lng: -73.8762 },
    { name: 'Junction Blvd', lines: '7', lat: 40.7493, lng: -73.8695 },
    { name: '103 St-Corona', lines: '7', lat: 40.7497, lng: -73.8627 },
    { name: '111 St', lines: '7', lat: 40.7517, lng: -73.8553 },
    { name: 'Mets-Willets Pt', lines: '7', lat: 40.7547, lng: -73.8456 },
    { name: 'Flushing-Main St', lines: '7', lat: 40.7596, lng: -73.8300 },
    // === QUEENS — E/F/M/R ===
    { name: 'Jackson Hts-Roosevelt', lines: '7/E/F/M/R', lat: 40.7466, lng: -73.8912 },
    { name: 'Forest Hills-71 Av', lines: 'E/F/M/R', lat: 40.7215, lng: -73.8445 },
    { name: 'Kew Gardens-Union Tpke', lines: 'E/F', lat: 40.7140, lng: -73.8310 },
    { name: 'Briarwood', lines: 'E/F', lat: 40.7090, lng: -73.8204 },
    { name: 'Sutphin Blvd-Archer', lines: 'E/J/Z', lat: 40.7003, lng: -73.8078 },
    { name: 'Jamaica Center', lines: 'E/J/Z', lat: 40.7025, lng: -73.8010 },
    { name: 'Parsons Blvd', lines: 'F', lat: 40.7075, lng: -73.8035 },
    { name: '169 St', lines: 'F', lat: 40.7106, lng: -73.7936 },
    { name: 'Jamaica-179 St', lines: 'F', lat: 40.7113, lng: -73.7836 },
    { name: 'Woodhaven Blvd', lines: 'J/Z', lat: 40.6933, lng: -73.8514 },
    // === QUEENS — G Line ===
    { name: 'Long Island City-Court Sq', lines: 'G', lat: 40.7427, lng: -73.9468 },
    { name: 'Greenpoint Av', lines: 'G', lat: 40.7313, lng: -73.9543 },
    { name: 'Nassau Av', lines: 'G', lat: 40.7244, lng: -73.9513 },
    // === QUEENS — Far Rockaway ===
    { name: 'Howard Beach', lines: 'A', lat: 40.6602, lng: -73.8302 },
    { name: 'Broad Channel', lines: 'A/S', lat: 40.6084, lng: -73.8160 },
    { name: 'Beach 67 St', lines: 'A', lat: 40.5924, lng: -73.7973 },
    { name: 'Far Rockaway-Mott Av', lines: 'A', lat: 40.6033, lng: -73.7553 },
    { name: 'Rockaway Park-Beach 116', lines: 'A/S', lat: 40.5761, lng: -73.8355 },
    // === BRONX — Jerome Av / 4 Line ===
    { name: '149 St-Grand Concourse', lines: '2/4/5', lat: 40.8185, lng: -73.9273 },
    { name: '161 St-Yankee Stadium', lines: '4/B/D', lat: 40.8276, lng: -73.9258 },
    { name: '167 St (4)', lines: '4', lat: 40.8359, lng: -73.9217 },
    { name: '170 St', lines: '4', lat: 40.8403, lng: -73.9178 },
    { name: '176 St', lines: '4', lat: 40.8485, lng: -73.9118 },
    { name: 'Burnside Av', lines: '4', lat: 40.8533, lng: -73.9073 },
    { name: '183 St', lines: '4', lat: 40.8585, lng: -73.9007 },
    { name: 'Fordham Rd (4)', lines: '4', lat: 40.8621, lng: -73.8901 },
    { name: 'Kingsbridge Rd (4)', lines: '4', lat: 40.8677, lng: -73.8972 },
    { name: 'Bedford Park Blvd (4)', lines: '4', lat: 40.8731, lng: -73.8901 },
    { name: 'Mosholu Pkwy', lines: '4', lat: 40.8793, lng: -73.8847 },
    { name: 'Woodlawn', lines: '4', lat: 40.8860, lng: -73.8788 },
    // === BRONX — Pelham Line / 6 ===
    { name: '138 St-Grand Concourse', lines: '4/5', lat: 40.8133, lng: -73.9296 },
    { name: '3 Av-149 St', lines: '2/5', lat: 40.8162, lng: -73.9179 },
    { name: 'Jackson Av', lines: '2/5', lat: 40.8165, lng: -73.9080 },
    { name: 'Hunts Point Av', lines: '6', lat: 40.8206, lng: -73.8907 },
    { name: 'Whitlock Av', lines: '6', lat: 40.8266, lng: -73.8863 },
    { name: 'Elder Av', lines: '6', lat: 40.8286, lng: -73.8791 },
    { name: 'Morrison-Soundview', lines: '6', lat: 40.8293, lng: -73.8746 },
    { name: 'St Lawrence Av', lines: '6', lat: 40.8316, lng: -73.8675 },
    { name: 'Parkchester', lines: '6', lat: 40.8332, lng: -73.8609 },
    { name: 'Castle Hill Av', lines: '6', lat: 40.8343, lng: -73.8513 },
    { name: 'Zerega Av', lines: '6', lat: 40.8365, lng: -73.8470 },
    { name: 'Westchester Sq', lines: '6', lat: 40.8396, lng: -73.8431 },
    { name: 'Middletown Rd', lines: '6', lat: 40.8443, lng: -73.8363 },
    { name: 'Buhre Av', lines: '6', lat: 40.8468, lng: -73.8324 },
    { name: 'Pelham Bay Park', lines: '6', lat: 40.8527, lng: -73.8281 },
    // === BRONX — Concourse / B/D ===
    { name: '167 St (BD)', lines: 'B/D', lat: 40.8337, lng: -73.9216 },
    { name: '170 St (BD)', lines: 'B/D', lat: 40.8393, lng: -73.9177 },
    { name: '174-175 Sts', lines: 'B/D', lat: 40.8459, lng: -73.9103 },
    { name: 'Tremont Av (BD)', lines: 'B/D', lat: 40.8501, lng: -73.9056 },
    { name: '182-183 Sts', lines: 'B/D', lat: 40.8563, lng: -73.9005 },
    { name: 'Fordham Rd (BD)', lines: 'B/D', lat: 40.8612, lng: -73.8976 },
    { name: 'Kingsbridge Rd (BD)', lines: 'B/D', lat: 40.8672, lng: -73.8934 },
    { name: 'Bedford Park Blvd (BD)', lines: 'B/D', lat: 40.8732, lng: -73.8870 },
    { name: 'Norwood-205 St', lines: 'D', lat: 40.8749, lng: -73.8791 },
    // === STATEN ISLAND RAILWAY ===
    { name: 'St George', lines: 'SIR', lat: 40.6435, lng: -74.0764 },
    { name: 'Tompkinsville', lines: 'SIR', lat: 40.6361, lng: -74.0773 },
    { name: 'Stapleton', lines: 'SIR', lat: 40.6268, lng: -74.0762 },
    { name: 'Clifton', lines: 'SIR', lat: 40.6212, lng: -74.0718 },
    { name: 'Grasmere', lines: 'SIR', lat: 40.6035, lng: -74.0846 },
    { name: 'New Dorp', lines: 'SIR', lat: 40.5734, lng: -74.1165 },
    { name: 'Great Kills', lines: 'SIR', lat: 40.5514, lng: -74.1516 },
    { name: 'Eltingville', lines: 'SIR', lat: 40.5448, lng: -74.1644 },
    { name: 'Huguenot', lines: 'SIR', lat: 40.5339, lng: -74.1791 },
    { name: 'Tottenville', lines: 'SIR', lat: 40.5127, lng: -74.2519 },
  ];
  return stops.map(s => ({ ...s, type: 'subway' }));
}

function generateFallbackBusStops() {
  // Generate bus stops along major NYC bus corridors for realistic placement.
  // Each corridor is a line segment with start/end coordinates; stops are
  // placed at ~250m intervals (~0.0023 degrees) along each segment.
  const STOP_INTERVAL = 0.0023; // ~250m in degrees latitude

  // Cross-street names repeat along corridors for realistic stop naming
  const manhattanNSStreets = [
    'Houston St', '14th St', '23rd St', '34th St', '42nd St', '50th St',
    '57th St', '66th St', '72nd St', '79th St', '86th St', '96th St',
    '106th St', '110th St', '116th St', '125th St', '135th St', '145th St',
    '155th St', '165th St', '175th St', '181st St', '191st St', 'Dyckman St',
    '207th St', '215th St',
  ];
  const manhattanEWStreets = [
    '1st Ave', '2nd Ave', '3rd Ave', 'Lexington Ave', 'Park Ave',
    'Madison Ave', '5th Ave', '6th Ave', '7th Ave', '8th Ave',
    'Broadway', 'Amsterdam Ave', 'Columbus Ave', 'Riverside Dr',
  ];
  const brooklynStreets = [
    'Atlantic Ave', 'Fulton St', 'DeKalb Ave', 'Myrtle Ave', 'Flushing Ave',
    'Broadway', 'Gates Ave', 'Halsey St', 'Nostrand Ave', 'Utica Ave',
    'Ralph Ave', 'Pennsylvania Ave', 'Flatbush Ave', 'Church Ave',
    'Kings Hwy', 'Avenue U', 'Bay Pkwy', 'Ocean Pkwy', '86th St',
    'Bay Ridge Ave', '4th Ave', '5th Ave', 'Smith St', 'Court St',
  ];
  const queensStreets = [
    'Queens Blvd', 'Roosevelt Ave', 'Northern Blvd', 'Astoria Blvd',
    'Jamaica Ave', 'Hillside Ave', 'Union Tpke', 'Kissena Blvd',
    'Main St', 'Parsons Blvd', 'Francis Lewis Blvd', 'Springfield Blvd',
    'Cross Bay Blvd', 'Rockaway Blvd', 'Linden Blvd', 'Liberty Ave',
    'Sutphin Blvd', 'Merrick Blvd', 'Guy Brewer Blvd',
  ];
  const bronxStreets = [
    'Grand Concourse', 'Fordham Rd', 'Tremont Ave', 'Burnside Ave',
    'Kingsbridge Rd', 'Gun Hill Rd', 'Pelham Pkwy', 'E 233rd St',
    'White Plains Rd', 'Westchester Ave', 'Southern Blvd', 'Third Ave',
    'Jerome Ave', 'Broadway', 'Riverdale Ave', 'University Ave',
    'Webster Ave', 'E 149th St', 'E 161st St', 'E 174th St',
  ];
  const siStreets = [
    'Victory Blvd', 'Richmond Ave', 'Hylan Blvd', 'Forest Ave',
    'Castleton Ave', 'Bay St', 'Targee St', 'Richmond Rd',
    'Arthur Kill Rd', 'Amboy Rd', 'Arden Ave', 'Drumgoole Rd',
  ];

  function getCrossStreet(streets, index) {
    return streets[index % streets.length];
  }

  function generateStopsAlongCorridor(startLat, startLng, endLat, endLng, route, crossStreets) {
    const stops = [];
    const dLat = endLat - startLat;
    const dLng = endLng - startLng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    const numStops = Math.max(2, Math.floor(dist / STOP_INTERVAL));
    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      const lat = startLat + dLat * t;
      const lng = startLng + dLng * t;
      const crossSt = getCrossStreet(crossStreets, i);
      stops.push({
        type: 'bus',
        name: `${route} at ${crossSt}`,
        routes: route,
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6)),
      });
    }
    return stops;
  }

  // Define major corridors: [startLat, startLng, endLat, endLng, routeName]
  // ---- MANHATTAN (north-south avenues and crosstown routes) ----
  const manhattanCorridors = [
    // North-south routes
    [40.7010, -74.0132, 40.8735, -73.9107, 'M1'],    // 5th/Madison Ave
    [40.7020, -74.0110, 40.8460, -73.9360, 'M3'],    // Amsterdam/St Nicholas Ave
    [40.7030, -74.0050, 40.8770, -73.9060, 'M4'],    // Madison/5th Ave (upper)
    [40.7013, -74.0125, 40.8420, -73.9425, 'M5'],    // Broadway/Riverside Dr
    [40.7044, -74.0090, 40.8100, -73.9600, 'M7'],    // Columbus/Amsterdam Ave
    [40.7080, -73.9975, 40.7960, -73.9490, 'M10'],   // 7th/8th Ave
    [40.7026, -74.0133, 40.8500, -73.9360, 'M11'],   // 9th/10th Ave
    [40.7090, -73.9900, 40.8770, -73.9065, 'M15'],   // 1st/2nd Ave
    [40.7188, -73.9860, 40.7610, -73.9714, 'M101'],  // 3rd/Lexington (midtown)
    [40.8100, -73.9600, 40.8700, -73.9200, 'M100'],  // Broadway (Harlem)
    // Crosstown routes
    [40.7200, -74.0000, 40.7200, -73.9720, 'M14A'],  // 14th St crosstown
    [40.7340, -73.9980, 40.7340, -73.9740, 'M23'],   // 23rd St crosstown
    [40.7488, -74.0020, 40.7488, -73.9680, 'M34'],   // 34th St crosstown
    [40.7544, -73.9990, 40.7544, -73.9640, 'M42'],   // 42nd St crosstown
    [40.7720, -73.9810, 40.7720, -73.9580, 'M57'],   // 57th St crosstown
    [40.7760, -73.9810, 40.7760, -73.9530, 'M66'],   // 66th St crosstown
    [40.7810, -73.9770, 40.7810, -73.9510, 'M72'],   // 72nd St crosstown
    [40.7860, -73.9750, 40.7860, -73.9490, 'M79'],   // 79th St crosstown
    [40.7900, -73.9720, 40.7900, -73.9490, 'M86'],   // 86th St crosstown
    [40.7950, -73.9700, 40.7950, -73.9420, 'M96'],   // 96th St crosstown
  ];

  // ---- BROOKLYN (major routes) ----
  const brooklynCorridors = [
    [40.6870, -73.9800, 40.5740, -73.9610, 'B1'],    // Flatbush Ave south
    [40.6920, -73.9900, 40.6410, -74.0280, 'B2'],    // Church Ave/Bay Ridge
    [40.6890, -73.9810, 40.6350, -73.9480, 'B3'],    // Nostrand Ave south
    [40.6865, -73.9770, 40.6170, -73.9560, 'B8'],    // Ocean Pkwy
    [40.6580, -73.9800, 40.6580, -73.9070, 'B9'],    // Kings Hwy crosstown
    [40.6890, -73.9840, 40.5810, -73.9740, 'B11'],   // Flatbush Ave (full)
    [40.6960, -73.9940, 40.6960, -73.9290, 'B15'],   // Atlantic Ave crosstown
    [40.6950, -73.9940, 40.6950, -73.9120, 'B25'],   // Fulton St full
    [40.6905, -73.9870, 40.6560, -73.8920, 'B35'],   // Church Ave east
    [40.6400, -74.0290, 40.6170, -74.0320, 'B37'],   // 3rd/4th Ave Bay Ridge
    [40.6890, -73.9830, 40.6400, -73.9780, 'B41'],   // Flatbush Ave central
    [40.6870, -73.9770, 40.6020, -73.9510, 'B44'],   // Nostrand Ave full
    [40.6850, -73.9740, 40.6130, -73.9360, 'B46'],   // Utica Ave
    [40.6870, -73.9900, 40.6510, -74.0030, 'B51'],   // 4th Ave
    [40.6910, -73.9950, 40.6080, -73.9900, 'B60'],   // Smith/Coney Island
    [40.6790, -73.9710, 40.6220, -73.8940, 'B63'],   // East Brooklyn
    [40.6740, -73.9640, 40.5830, -73.9520, 'B68'],   // Coney Island Ave
    [40.6280, -73.9250, 40.5920, -73.8880, 'B82'],   // Flatlands east
    [40.6940, -73.9930, 40.6940, -73.9340, 'B103'],  // Myrtle Ave
  ];

  // ---- QUEENS (major routes) ----
  const queensCorridors = [
    [40.7430, -73.9230, 40.7100, -73.8200, 'Q1'],    // Queens Blvd
    [40.7570, -73.9240, 40.7570, -73.8490, 'Q2'],    // Northern Blvd east
    [40.7680, -73.9170, 40.7680, -73.8460, 'Q4'],    // Northern Blvd far
    [40.7420, -73.9150, 40.6970, -73.8530, 'Q5'],    // Jamaica Ave south
    [40.7380, -73.9100, 40.6940, -73.7920, 'Q6'],    // Jamaica Ave east
    [40.7280, -73.9000, 40.6990, -73.7870, 'Q9'],    // Union Tpke
    [40.7430, -73.9200, 40.7430, -73.8100, 'Q10'],   // Roosevelt Ave
    [40.7160, -73.8360, 40.6750, -73.8360, 'Q11'],   // Springfield Blvd
    [40.6680, -73.8640, 40.6680, -73.7600, 'Q13'],   // Rockaway south
    [40.6900, -73.8150, 40.6520, -73.7560, 'Q27'],   // SE Queens
    [40.7460, -73.8740, 40.7120, -73.7960, 'Q30'],   // Main St/Kissena
    [40.7530, -73.9220, 40.7530, -73.8600, 'Q33'],   // Astoria south
    [40.7500, -73.9170, 40.7120, -73.8300, 'Q44'],   // Flushing local
    [40.6700, -73.8100, 40.6310, -73.7600, 'Q54'],   // Far Rockaway
    [40.6960, -73.8460, 40.6600, -73.7780, 'Q65'],   // SE Queens local
    [40.6720, -73.8340, 40.6350, -73.7730, 'Q113'],  // Rockaway east
    // Major N-S routes
    [40.7700, -73.9200, 40.7100, -73.8500, 'Q18'],   // Steinway/Parsons
    [40.7600, -73.8700, 40.7100, -73.8300, 'Q20'],   // Main St Flushing south
    [40.7400, -73.8600, 40.6800, -73.8300, 'Q36'],   // Francis Lewis Blvd
  ];

  // ---- BRONX (major routes) ----
  const bronxCorridors = [
    [40.8100, -73.9290, 40.8790, -73.8780, 'Bx1'],   // Grand Concourse south
    [40.8240, -73.9140, 40.8790, -73.8790, 'Bx2'],   // Grand Concourse north
    [40.8100, -73.9300, 40.8100, -73.8520, 'Bx4'],   // E 149th St crosstown
    [40.8150, -73.9200, 40.8560, -73.8290, 'Bx5'],   // Westchester Ave
    [40.8180, -73.9270, 40.8930, -73.8890, 'Bx7'],   // Broadway/Riverdale
    [40.8420, -73.9130, 40.8420, -73.8540, 'Bx11'],  // Pelham Pkwy crosstown
    [40.8530, -73.9080, 40.8530, -73.8440, 'Bx12'],  // Fordham Rd crosstown
    [40.8280, -73.9170, 40.8280, -73.8550, 'Bx15'],  // Tremont Ave crosstown
    [40.8200, -73.9240, 40.8870, -73.8970, 'Bx19'],  // Jerome Ave
    [40.8190, -73.9210, 40.8740, -73.8610, 'Bx21'],  // White Plains Rd
    [40.8160, -73.9250, 40.8720, -73.8700, 'Bx22'],  // Southern Blvd
    [40.8200, -73.9260, 40.8910, -73.8950, 'Bx32'],  // Grand Concourse full
    [40.8700, -73.9020, 40.8700, -73.8430, 'Bx39'],  // Gun Hill Rd crosstown
    [40.8800, -73.9000, 40.8800, -73.8500, 'Bx41'],  // E 233rd crosstown
    [40.8150, -73.9270, 40.8590, -73.8310, 'Bx46'],  // Soundview
    [40.8600, -73.9100, 40.8890, -73.8960, 'Bx55'],  // Riverdale north
  ];

  // ---- STATEN ISLAND (major routes, sparser coverage) ----
  const siCorridors = [
    [40.6430, -74.0770, 40.5600, -74.1380, 'S40'],   // Bay St/Hylan north
    [40.6370, -74.0830, 40.5700, -74.1500, 'S42'],   // Victory Blvd
    [40.6340, -74.0890, 40.5880, -74.1410, 'S44'],   // Richmond Ave north
    [40.6300, -74.0780, 40.5200, -74.2280, 'S46'],   // Hylan Blvd full
    [40.6310, -74.0930, 40.5650, -74.1520, 'S48'],   // Forest Ave
    [40.6250, -74.0830, 40.5300, -74.2100, 'S51'],   // Amboy Rd
    [40.6050, -74.0700, 40.5600, -74.1100, 'S54'],   // Hylan Blvd east
    [40.6000, -74.1100, 40.5400, -74.1850, 'S62'],   // Arthur Kill Rd
    [40.6280, -74.0880, 40.5500, -74.2000, 'S78'],   // Hylan/Arthur Kill
  ];

  // Pick the right cross-street list for each corridor set and generate all stops
  const allStops = [];
  const corridorSets = [
    { corridors: manhattanCorridors, nsStreets: manhattanNSStreets, ewStreets: manhattanEWStreets },
    { corridors: brooklynCorridors, streets: brooklynStreets },
    { corridors: queensCorridors, streets: queensStreets },
    { corridors: bronxCorridors, streets: bronxStreets },
    { corridors: siCorridors, streets: siStreets },
  ];

  for (const set of corridorSets) {
    for (const c of set.corridors) {
      const [startLat, startLng, endLat, endLng, route] = c;
      // For Manhattan, pick NS or EW cross-street list based on corridor orientation
      let crossStreets;
      if (set.nsStreets) {
        const isNorthSouth = Math.abs(endLat - startLat) > Math.abs(endLng - startLng);
        crossStreets = isNorthSouth ? set.nsStreets : set.ewStreets;
      } else {
        crossStreets = set.streets;
      }
      const corridorStops = generateStopsAlongCorridor(
        startLat, startLng, endLat, endLng, route, crossStreets
      );
      allStops.push(...corridorStops);
    }
  }

  return allStops;
}

function buildFallbackDistricts() {
  // Simple bounding-box approach for 51 NYC council districts
  const features = [];
  const districtCenters = [
    [40.7128, -74.0060], [40.7282, -73.7949], [40.7580, -73.9855],
    [40.8448, -73.8648], [40.6782, -73.9442], [40.7489, -73.9680],
    [40.5834, -73.9495], [40.6892, -73.9857], [40.8005, -73.9298],
  ];
  for (let i = 1; i <= 51; i++) {
    const center = districtCenters[i % districtCenters.length];
    const offset = i * 0.003;
    features.push({
      type: 'Feature',
      properties: { coun_dist: i, shape_area: 50000000 },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [center[1] - 0.01 + offset, center[0] - 0.008],
          [center[1] + 0.01 + offset, center[0] - 0.008],
          [center[1] + 0.01 + offset, center[0] + 0.008],
          [center[1] - 0.01 + offset, center[0] + 0.008],
          [center[1] - 0.01 + offset, center[0] - 0.008],
        ]],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function populateDistrictDropdown() {
  if (!state.councilDistricts || !state.councilDistricts.features) return;
  const sorted = state.councilDistricts.features
    .map(f => f.properties.coun_dist || f.properties.council_district || f.properties.COUN_DIST)
    .filter(Boolean)
    .sort((a, b) => parseInt(a) - parseInt(b));
  for (const d of sorted) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `District ${d}`;
    dom.districtSelect.appendChild(opt);
  }
}

// ============================================================
// WALKSHED & EQUITY ANALYSIS
// ============================================================

function getWalkRadiusMiles(minutes) {
  return (WALK_SPEED_MPH * minutes) / 60;
}

function buildWalksheds(stops, radiusMiles) {
  // Build union of circular walksheds around transit stops
  if (!stops.length) return null;
  const circles = stops.map(s =>
    turf.circle([s.lng, s.lat], radiusMiles, { units: 'miles', steps: 32 })
  );
  // Union in batches to avoid stack overflow
  let merged = circles[0];
  for (let i = 1; i < circles.length; i++) {
    try {
      merged = turf.union(turf.featureCollection([merged, circles[i]]));
    } catch (e) {
      // Skip problematic geometries
    }
  }
  return merged;
}

function generateAnalysisGrid(bounds, cellSizeKm) {
  // Create hex grid for analysis
  const bbox = [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]];
  return turf.hexGrid(bbox, cellSizeKm, { units: 'kilometers' });
}

function runAnalysis() {
  showLoading('Running equity analysis...');

  const activeStops = [];
  if (state.showSubway) activeStops.push(...state.subwayStops);
  if (state.showBus) activeStops.push(...state.busStops);

  let stopsToAnalyze = activeStops;
  let analysisBounds = [[-74.27, 40.48], [-73.68, 40.92]];

  // Filter to selected district
  if (state.selectedDistrict && state.councilDistricts) {
    const distFeature = state.councilDistricts.features.find(f => {
      const d = f.properties.coun_dist || f.properties.council_district || f.properties.COUN_DIST;
      return String(d) === String(state.selectedDistrict);
    });
    if (distFeature) {
      const bbox = turf.bbox(distFeature);
      analysisBounds = [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
      // Filter stops within district (with buffer)
      const buffered = turf.buffer(distFeature, 0.3, { units: 'miles' });
      stopsToAnalyze = activeStops.filter(s => {
        const pt = turf.point([s.lng, s.lat]);
        return turf.booleanPointInPolygon(pt, buffered);
      });
      // Fit map to district
      state.map.fitBounds(analysisBounds, { padding: 50 });
    }
  }

  const radiusMiles = getWalkRadiusMiles(state.walkTimeMinutes);

  // Generate hex grid for analysis
  const cellSize = state.selectedDistrict ? 0.15 : 0.5;
  const grid = generateAnalysisGrid(analysisBounds, cellSize);

  // Calculate equity gap score for each cell
  grid.features = grid.features.map(cell => {
    const center = turf.center(cell);
    const [cLng, cLat] = center.geometry.coordinates;

    // Count nearby transit stops
    const nearbyStops = stopsToAnalyze.filter(s => {
      const dist = turf.distance(turf.point([s.lng, s.lat]), center, { units: 'miles' });
      return dist <= radiusMiles;
    });

    const subwayCount = nearbyStops.filter(s => s.type === 'subway').length;
    const busCount = nearbyStops.filter(s => s.type === 'bus').length;

    // Nearest transit stop distance
    let nearestDist = Infinity;
    for (const s of stopsToAnalyze) {
      const d = turf.distance(turf.point([s.lng, s.lat]), center, { units: 'miles' });
      if (d < nearestDist) nearestDist = d;
    }

    // Estimate population density (from census data or heuristic)
    let estPopulation = estimatePopulation(cLat, cLng);

    // Equity gap score: higher = more underserved
    // Factors: lack of transit + population density
    const transitScore = Math.max(0, 1 - (subwayCount * 0.3 + busCount * 0.1));
    const distanceScore = Math.min(1, nearestDist / radiusMiles);
    const popFactor = Math.min(1, estPopulation / 5000);

    const gapScore = Math.round(((transitScore * 0.4 + distanceScore * 0.4 + popFactor * 0.2) * 100)) / 100;

    cell.properties = {
      gapScore,
      subwayCount,
      busCount,
      nearestDist: Math.round(nearestDist * 100) / 100,
      estPopulation,
      transitScore: Math.round(transitScore * 100) / 100,
    };

    return cell;
  });

  // Filter out cells outside NYC land area (rough filter)
  if (state.selectedDistrict && state.councilDistricts) {
    const distFeature = state.councilDistricts.features.find(f => {
      const d = f.properties.coun_dist || f.properties.council_district || f.properties.COUN_DIST;
      return String(d) === String(state.selectedDistrict);
    });
    if (distFeature) {
      grid.features = grid.features.filter(cell => {
        const center = turf.center(cell);
        return turf.booleanPointInPolygon(center, distFeature);
      });
    }
  }

  state.analysisGrid = grid;

  // Build walkshed polygon
  if (stopsToAnalyze.length > 0 && stopsToAnalyze.length < 500) {
    updateWalkshedLayer(stopsToAnalyze, radiusMiles);
  }

  updateGridLayer(grid);
  updateStats(grid);
  hideLoading();
}

function estimatePopulation(lat, lng) {
  // Heuristic population density by area
  // Manhattan core: very dense
  if (lat > 40.71 && lat < 40.80 && lng > -74.01 && lng < -73.93) return 4000 + Math.random() * 3000;
  // Upper Manhattan
  if (lat > 40.80 && lat < 40.88 && lng > -73.96 && lng < -73.92) return 3000 + Math.random() * 2000;
  // Downtown Brooklyn / Williamsburg
  if (lat > 40.67 && lat < 40.72 && lng > -73.99 && lng < -73.94) return 3000 + Math.random() * 2000;
  // South Bronx
  if (lat > 40.80 && lat < 40.86 && lng > -73.93 && lng < -73.86) return 2500 + Math.random() * 2000;
  // Central Queens
  if (lat > 40.72 && lat < 40.77 && lng > -73.92 && lng < -73.82) return 2000 + Math.random() * 1500;
  // Outer areas
  return 500 + Math.random() * 1500;
}

// ============================================================
// MAP LAYERS
// ============================================================

function setupMapLayers() {
  const map = state.map;

  // Subway stops source & layer
  map.addSource('subway-stops', {
    type: 'geojson',
    data: stopsToGeoJSON(state.subwayStops),
  });

  map.addLayer({
    id: 'subway-stops-layer',
    type: 'circle',
    source: 'subway-stops',
    paint: {
      'circle-radius': 5,
      'circle-color': '#3B82F6',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.9,
    },
  });

  // Bus stops source & layer
  map.addSource('bus-stops', {
    type: 'geojson',
    data: stopsToGeoJSON(state.busStops),
  });

  map.addLayer({
    id: 'bus-stops-layer',
    type: 'circle',
    source: 'bus-stops',
    paint: {
      'circle-radius': 3,
      'circle-color': '#F59E0B',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 0.8,
      'circle-opacity': 0.7,
    },
  });

  // Bus shelters source & layer
  map.addSource('bus-shelters', {
    type: 'geojson',
    data: stopsToGeoJSON(state.busShelters),
  });

  map.addLayer({
    id: 'bus-shelters-layer',
    type: 'circle',
    source: 'bus-shelters',
    paint: {
      'circle-radius': 4,
      'circle-color': '#8B5CF6',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1,
      'circle-opacity': 0.85,
    },
  });

  // Analysis grid source & layer
  map.addSource('analysis-grid', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: 'analysis-grid-fill',
    type: 'fill',
    source: 'analysis-grid',
    paint: {
      'fill-color': [
        'interpolate', ['linear'], ['get', 'gapScore'],
        0, '#10B981',
        0.35, '#F59E0B',
        0.7, '#EF4444',
      ],
      'fill-opacity': 0.45,
    },
  });

  map.addLayer({
    id: 'analysis-grid-line',
    type: 'line',
    source: 'analysis-grid',
    paint: {
      'line-color': 'rgba(255,255,255,0.15)',
      'line-width': 0.5,
    },
  });

  // Walkshed overlay source & layer
  map.addSource('walkshed', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: 'walkshed-fill',
    type: 'fill',
    source: 'walkshed',
    paint: {
      'fill-color': '#0D9488',
      'fill-opacity': 0.12,
    },
    layout: { visibility: 'none' },
  });

  map.addLayer({
    id: 'walkshed-line',
    type: 'line',
    source: 'walkshed',
    paint: {
      'line-color': '#2DD4BF',
      'line-width': 1.5,
      'line-opacity': 0.5,
    },
    layout: { visibility: 'none' },
  });

  // Council districts source & layer
  if (state.councilDistricts) {
    map.addSource('council-districts', {
      type: 'geojson',
      data: state.councilDistricts,
    });

    map.addLayer({
      id: 'council-districts-line',
      type: 'line',
      source: 'council-districts',
      paint: {
        'line-color': 'rgba(255,255,255,0.25)',
        'line-width': 1,
      },
    });
  }

  // Click handler for grid cells
  map.on('click', 'analysis-grid-fill', (e) => {
    if (!e.features.length) return;
    const props = e.features[0].properties;
    showZoneDetails(props, e.lngLat);
  });

  // Hover cursor for grid
  map.on('mouseenter', 'analysis-grid-fill', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'analysis-grid-fill', () => {
    map.getCanvas().style.cursor = '';
  });

  // Click handlers for stops
  map.on('click', 'subway-stops-layer', (e) => {
    if (!e.features.length) return;
    const p = e.features[0].properties;
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<div class="popup-title">${p.name}</div>
        <div class="popup-row"><span class="popup-label">Lines</span><span class="popup-value">${p.lines}</span></div>
        <div class="popup-row"><span class="popup-label">Type</span><span class="popup-value">Subway</span></div>`)
      .addTo(map);
  });

  map.on('click', 'bus-stops-layer', (e) => {
    if (!e.features.length) return;
    const p = e.features[0].properties;
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<div class="popup-title">${p.name}</div>
        <div class="popup-row"><span class="popup-label">Routes</span><span class="popup-value">${p.routes || '—'}</span></div>
        <div class="popup-row"><span class="popup-label">Type</span><span class="popup-value">Bus</span></div>`)
      .addTo(map);
  });

  map.on('click', 'bus-shelters-layer', (e) => {
    if (!e.features.length) return;
    const p = e.features[0].properties;
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<div class="popup-title">${p.name}</div>
        <div class="popup-row"><span class="popup-label">Routes</span><span class="popup-value">${p.routes || '—'}</span></div>
        <div class="popup-row"><span class="popup-label">Type</span><span class="popup-value">Bus Shelter</span></div>`)
      .addTo(map);
  });
}

function stopsToGeoJSON(stops) {
  return {
    type: 'FeatureCollection',
    features: stops.map(s => ({
      type: 'Feature',
      properties: { name: s.name, lines: s.lines || '', routes: s.routes || '' },
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    })),
  };
}

function updateGridLayer(grid) {
  const src = state.map.getSource('analysis-grid');
  if (src) src.setData(grid);
}

function updateWalkshedLayer(stops, radiusMiles) {
  // Build individual circles and merge (limited set for performance)
  const sample = stops.length > 200 ? stops.slice(0, 200) : stops;
  const circles = sample.map(s =>
    turf.circle([s.lng, s.lat], radiusMiles, { units: 'miles', steps: 24 })
  );

  let walkshed;
  try {
    walkshed = circles[0];
    for (let i = 1; i < circles.length; i++) {
      walkshed = turf.union(turf.featureCollection([walkshed, circles[i]]));
    }
  } catch (e) {
    walkshed = turf.featureCollection(circles);
  }

  const src = state.map.getSource('walkshed');
  if (src) {
    const data = walkshed.type === 'FeatureCollection' ? walkshed : turf.featureCollection([walkshed]);
    src.setData(data);
  }
}

// ============================================================
// UI & EVENT HANDLERS
// ============================================================

function setupEventListeners() {
  // District select
  dom.districtSelect.addEventListener('change', (e) => {
    state.selectedDistrict = e.target.value || null;
    runAnalysis();
  });

  // Walk time slider
  dom.walkTime.addEventListener('input', (e) => {
    state.walkTimeMinutes = parseInt(e.target.value, 10);
    dom.walkTimeVal.textContent = state.walkTimeMinutes;
  });

  dom.walkTime.addEventListener('change', () => {
    runAnalysis();
  });

  // Transit layer toggles
  dom.showSubway.addEventListener('change', (e) => {
    state.showSubway = e.target.checked;
    state.map.setLayoutProperty('subway-stops-layer', 'visibility', state.showSubway ? 'visible' : 'none');
    runAnalysis();
  });

  dom.showBus.addEventListener('change', (e) => {
    state.showBus = e.target.checked;
    state.map.setLayoutProperty('bus-stops-layer', 'visibility', state.showBus ? 'visible' : 'none');
    runAnalysis();
  });

  dom.showShelters.addEventListener('change', (e) => {
    state.showShelters = e.target.checked;
    state.map.setLayoutProperty('bus-shelters-layer', 'visibility', state.showShelters ? 'visible' : 'none');
  });

  dom.showWalkshed.addEventListener('change', (e) => {
    state.showWalkshed = e.target.checked;
    const vis = state.showWalkshed ? 'visible' : 'none';
    state.map.setLayoutProperty('walkshed-fill', 'visibility', vis);
    state.map.setLayoutProperty('walkshed-line', 'visibility', vis);
  });
}

function updateStats(grid) {
  const cells = grid.features;
  const totalZones = cells.length;
  const gapZones = cells.filter(c => c.properties.gapScore >= 0.5).length;
  const totalPop = cells.reduce((sum, c) => sum + (c.properties.estPopulation || 0), 0);
  const avgScore = totalZones > 0
    ? cells.reduce((sum, c) => sum + c.properties.gapScore, 0) / totalZones
    : 0;

  dom.statZones.textContent = totalZones.toLocaleString();
  dom.statGaps.textContent = gapZones.toLocaleString();
  dom.statPop.textContent = totalPop >= 1000 ? `${Math.round(totalPop / 1000)}K` : totalPop.toLocaleString();
  dom.statScore.textContent = avgScore.toFixed(2);
}

function showZoneDetails(props, lngLat) {
  const scoreClass = props.gapScore >= 0.5 ? 'score-high' : props.gapScore >= 0.3 ? 'score-mid' : 'score-low';

  dom.detailsContent.innerHTML = `
    <div class="detail-row">
      <span class="detail-label">Gap Score</span>
      <span class="detail-value ${scoreClass}">${props.gapScore}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Subway Stops Nearby</span>
      <span class="detail-value">${props.subwayCount}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Bus Stops Nearby</span>
      <span class="detail-value">${props.busCount}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Nearest Transit</span>
      <span class="detail-value">${props.nearestDist} mi</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Est. Population</span>
      <span class="detail-value">${Math.round(props.estPopulation).toLocaleString()}</span>
    </div>
  `;
  dom.detailsPanel.classList.remove('hidden');

  // Show popup on map too
  new mapboxgl.Popup()
    .setLngLat(lngLat)
    .setHTML(`<div class="popup-title">Equity Gap Zone</div>
      <div class="popup-row"><span class="popup-label">Score</span><span class="popup-value ${scoreClass}">${props.gapScore}</span></div>
      <div class="popup-row"><span class="popup-label">Subway</span><span class="popup-value">${props.subwayCount} stops</span></div>
      <div class="popup-row"><span class="popup-label">Bus</span><span class="popup-value">${props.busCount} stops</span></div>`)
    .addTo(state.map);
}

// ---- Loading Helpers ----

function showLoading(text) {
  dom.loadingText.textContent = text || 'Loading...';
  dom.loading.classList.remove('hidden');
}

function hideLoading() {
  dom.loading.classList.add('hidden');
}
