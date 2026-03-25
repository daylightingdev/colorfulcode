// ============================================================
// Transit Equity Gap Finder — NYC Walkshed Analysis
// ============================================================

// ---- Configuration ----
const MTA_SUBWAY_STOPS_URL = 'https://data.cityofnewyork.us/resource/kk4q-3rt2.json?$limit=1000';
const MTA_BUS_STOPS_URL = 'https://data.cityofnewyork.us/resource/qu8g-sxqf.json?$limit=5000';
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
  councilDistricts: null,
  censusData: [],
  analysisGrid: null,
  walkTimeMinutes: 10,
  selectedDistrict: null,
  showSubway: true,
  showBus: true,
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
  const [subway, bus, districts, census] = await Promise.all([
    fetchSubwayStops(),
    fetchBusStops(),
    fetchCouncilDistricts(),
    fetchCensusData(),
  ]);
  state.subwayStops = subway;
  state.busStops = bus;
  state.councilDistricts = districts;
  state.censusData = census;
  populateDistrictDropdown();
}

async function fetchSubwayStops() {
  showLoading('Loading subway stops...');
  try {
    const res = await fetch(MTA_SUBWAY_STOPS_URL);
    const data = await res.json();
    return data
      .filter(s => s.the_geom && s.the_geom.coordinates)
      .map(s => ({
        type: 'subway',
        name: s.stop_name || s.name || 'Unknown',
        lines: s.line || s.daytime_routes || '',
        lng: parseFloat(s.the_geom.coordinates[0]),
        lat: parseFloat(s.the_geom.coordinates[1]),
      }));
  } catch (e) {
    console.warn('Subway stops fetch failed, using fallback', e);
    return generateFallbackSubwayStops();
  }
}

async function fetchBusStops() {
  showLoading('Loading bus stops...');
  try {
    const res = await fetch(MTA_BUS_STOPS_URL);
    const data = await res.json();
    return data
      .filter(s => s.the_geom && s.the_geom.coordinates)
      .map(s => ({
        type: 'bus',
        name: s.stop_name || s.name || 'Bus Stop',
        routes: s.routes || '',
        lng: parseFloat(s.the_geom.coordinates[0]),
        lat: parseFloat(s.the_geom.coordinates[1]),
      }));
  } catch (e) {
    console.warn('Bus stops fetch failed, using fallback', e);
    return generateFallbackBusStops();
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

// ---- Fallback Data Generators ----

function generateFallbackSubwayStops() {
  // Core NYC subway stops for demo
  const stops = [
    { name: 'Times Sq-42 St', lines: '1/2/3/7/N/Q/R/W/S', lat: 40.7557, lng: -73.9870 },
    { name: 'Grand Central-42 St', lines: '4/5/6/7/S', lat: 40.7527, lng: -73.9772 },
    { name: 'Union Sq-14 St', lines: 'L/N/Q/R/W/4/5/6', lat: 40.7359, lng: -73.9906 },
    { name: '34 St-Penn Station', lines: '1/2/3/A/C/E', lat: 40.7506, lng: -73.9935 },
    { name: 'Fulton St', lines: '2/3/4/5/A/C/J/Z', lat: 40.7092, lng: -74.0065 },
    { name: '59 St-Columbus Circle', lines: '1/2/A/B/C/D', lat: 40.7681, lng: -73.9819 },
    { name: '125 St', lines: '4/5/6', lat: 40.8043, lng: -73.9375 },
    { name: 'Atlantic Av-Barclays', lines: '2/3/4/5/B/D/N/Q/R', lat: 40.6842, lng: -73.9778 },
    { name: 'Jay St-MetroTech', lines: 'A/C/F/R', lat: 40.6924, lng: -73.9871 },
    { name: 'Broadway Junction', lines: 'A/C/J/Z/L', lat: 40.6783, lng: -73.9053 },
    { name: 'Jackson Hts-Roosevelt', lines: '7/E/F/M/R', lat: 40.7466, lng: -73.8912 },
    { name: 'Flushing-Main St', lines: '7', lat: 40.7596, lng: -73.8300 },
    { name: 'Jamaica-179 St', lines: 'F', lat: 40.7113, lng: -73.7836 },
    { name: '161 St-Yankee Stadium', lines: '4/B/D', lat: 40.8276, lng: -73.9258 },
    { name: 'Fordham Rd', lines: '4', lat: 40.8621, lng: -73.8901 },
    { name: 'Pelham Bay Park', lines: '6', lat: 40.8527, lng: -73.8281 },
    { name: 'Coney Island-Stillwell', lines: 'D/F/N/Q', lat: 40.5771, lng: -73.9814 },
    { name: 'Bay Ridge-95 St', lines: 'R', lat: 40.6166, lng: -74.0310 },
    { name: '14 St-8 Av', lines: 'A/C/E/L', lat: 40.7408, lng: -74.0002 },
    { name: 'Herald Sq-34 St', lines: 'B/D/F/M/N/Q/R/W', lat: 40.7499, lng: -73.9878 },
    { name: 'Canal St', lines: 'J/N/Q/R/W/Z/6', lat: 40.7191, lng: -73.9999 },
    { name: 'Chambers St', lines: 'A/C/1/2/3', lat: 40.7154, lng: -74.0094 },
    { name: 'Court Sq', lines: 'E/G/M/7', lat: 40.7471, lng: -73.9456 },
    { name: 'Myrtle-Wyckoff', lines: 'L/M', lat: 40.6997, lng: -73.9120 },
    { name: 'Nostrand Av', lines: 'A/C', lat: 40.6804, lng: -73.9506 },
    { name: 'Church Av', lines: 'B/Q/2/5', lat: 40.6508, lng: -73.9629 },
    { name: 'Kings Hwy', lines: 'B/Q', lat: 40.6089, lng: -73.9583 },
    { name: 'Brighton Beach', lines: 'B/Q', lat: 40.5776, lng: -73.9614 },
    { name: 'Woodlawn', lines: '4', lat: 40.8860, lng: -73.8788 },
    { name: 'Astoria-Ditmars', lines: 'N/W', lat: 40.7751, lng: -73.9120 },
  ];
  return stops.map(s => ({ ...s, type: 'subway' }));
}

function generateFallbackBusStops() {
  // Generate grid of bus stops across NYC for demo
  const stops = [];
  const boroughs = [
    { name: 'Manhattan', latMin: 40.700, latMax: 40.880, lngMin: -74.020, lngMax: -73.930, density: 0.006 },
    { name: 'Brooklyn', latMin: 40.570, latMax: 40.700, lngMin: -74.040, lngMax: -73.890, density: 0.010 },
    { name: 'Queens', latMin: 40.680, latMax: 40.800, lngMin: -73.930, lngMax: -73.730, density: 0.012 },
    { name: 'Bronx', latMin: 40.800, latMax: 40.900, lngMin: -73.930, lngMax: -73.820, density: 0.010 },
    { name: 'Staten Island', latMin: 40.500, latMax: 40.650, lngMin: -74.250, lngMax: -74.060, density: 0.020 },
  ];
  let id = 0;
  for (const b of boroughs) {
    for (let lat = b.latMin; lat <= b.latMax; lat += b.density) {
      for (let lng = b.lngMin; lng <= b.lngMax; lng += b.density) {
        // Add jitter
        const jLat = lat + (Math.random() - 0.5) * b.density * 0.5;
        const jLng = lng + (Math.random() - 0.5) * b.density * 0.5;
        stops.push({
          type: 'bus',
          name: `${b.name} Bus Stop ${++id}`,
          routes: `B${Math.floor(Math.random() * 80) + 1}`,
          lat: jLat,
          lng: jLng,
        });
      }
    }
  }
  return stops;
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
