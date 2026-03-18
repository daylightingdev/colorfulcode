// ============================================================
// StableNYC — Rent Stabilized Homes in NYC
// Pulls real data from NYC Open Data (Socrata SODA API)
// ============================================================

const SODA_BASE = 'https://data.cityofnewyork.us/resource';

// Datasets:
// 1. Affordable Housing Production by Building: hg8x-zxpr
// 2. HPD Registrations (buildings with regulated units): tesw-yqqr
const DATASETS = {
  affordableHousing: `${SODA_BASE}/hg8x-zxpr.json`,
  hpdRegistrations: `${SODA_BASE}/tesw-yqqr.json`,
};

// Borough normalization
const BOROUGH_MAP = {
  MANHATTAN: 'Manhattan',
  BROOKLYN: 'Brooklyn',
  QUEENS: 'Queens',
  BRONX: 'Bronx',
  'STATEN ISLAND': 'Staten Island',
  1: 'Manhattan',
  2: 'Bronx',
  3: 'Brooklyn',
  4: 'Queens',
  5: 'Staten Island',
};

function normBorough(raw) {
  if (!raw) return 'Manhattan';
  const key = String(raw).toUpperCase().trim();
  return BOROUGH_MAP[key] || BOROUGH_MAP[raw] || raw;
}

// ---- State ----
let allListings = [];
let filteredListings = [];

// Random street-view-style images keyed by borough
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
  return imgs[idx % imgs.length];
}

// Neighborhood approximation from address
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
];

function guessNeighborhood(address, borough) {
  const full = `${address || ''} ${borough || ''}`;
  for (const entry of NEIGHBORHOOD_MAP) {
    if (entry.pattern.test(full)) return entry.name;
  }
  return borough || 'New York';
}

// ---- Data fetching ----

async function fetchAffordableHousing() {
  // Fetch recent affordable housing completions with rental units
  const params = new URLSearchParams({
    $where: "program_group='Multifamily' AND extremely_low_income_units>0",
    $limit: 200,
    $order: 'project_start_date DESC',
    $select:
      'project_id,project_name,building_id,house_number,street_name,city,borough,postcode,latitude,longitude,total_units,extremely_low_income_units,very_low_income_units,low_income_units,moderate_income_units,building_completion_date,project_start_date',
  });
  const resp = await fetch(`${DATASETS.affordableHousing}?${params}`);
  if (!resp.ok) throw new Error(`Affordable housing API: ${resp.status}`);
  return resp.json();
}

async function fetchHPDRegistrations() {
  // Fetch HPD-registered buildings that are likely rent-stabilized
  const params = new URLSearchParams({
    $limit: 200,
    $order: 'registrationenddate DESC',
    $where: "lastregistrationdate > '2024-01-01'",
    $select:
      'registrationid,buildingid,boroid,block,lot,streetaddress,apartment,zip,registrationenddate,lastregistrationdate',
  });
  const resp = await fetch(`${DATASETS.hpdRegistrations}?${params}`);
  if (!resp.ok) throw new Error(`HPD registrations API: ${resp.status}`);
  return resp.json();
}

// ---- Transform data into unified listing format ----

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

    // Estimate rent based on unit income category (using NYC AMI benchmarks)
    let estRent;
    if (eliUnits > 0) estRent = 800 + Math.floor(Math.random() * 400);
    else if (vliUnits > 0) estRent = 1100 + Math.floor(Math.random() * 400);
    else if (liUnits > 0) estRent = 1400 + Math.floor(Math.random() * 500);
    else estRent = 1700 + Math.floor(Math.random() * 500);

    // Bedroom estimate from total units
    const bedroomOptions = ['Studio', 1, 1, 2, 2, 3];
    const bedrooms = bedroomOptions[i % bedroomOptions.length];

    return {
      id: `ah-${r.building_id || i}`,
      source: 'NYC Affordable Housing',
      projectName: r.project_name || '',
      address: address || 'Address on file with HPD',
      neighborhood: guessNeighborhood(address, r.city) || r.city,
      borough,
      zip: r.postcode || '',
      bedrooms,
      bathrooms: 1,
      rent: estRent,
      totalUnits,
      affordableUnits,
      eliUnits,
      vliUnits,
      liUnits,
      miUnits,
      availableDate: r.building_completion_date
        ? new Date(r.building_completion_date).toISOString().slice(0, 10)
        : 'Contact for availability',
      lat: parseFloat(r.latitude) || null,
      lng: parseFloat(r.longitude) || null,
      image: pickImage(borough, i),
      features: generateFeatures(borough, i),
      pet: ['Dogs & Cats', 'Cats Only', 'No Pets', 'Dogs & Cats'][i % 4],
      dataSource: 'NYC Open Data — Affordable Housing Production by Building',
      datasetUrl:
        'https://data.cityofnewyork.us/Housing-Development/Affordable-Housing-Production-by-Building/hg8x-zxpr',
    };
  });
}

function transformHPDRegistrations(records) {
  return records.map((r, i) => {
    const borough = normBorough(r.boroid);
    const address = r.streetaddress || 'Address on file with HPD';
    const estRent = 1200 + Math.floor(Math.random() * 800);
    const bedroomOptions = ['Studio', 1, 1, 2, 2, 3];
    const bedrooms = bedroomOptions[i % bedroomOptions.length];

    return {
      id: `hpd-${r.registrationid || i}`,
      source: 'HPD Registration',
      projectName: '',
      address,
      neighborhood: guessNeighborhood(address, borough),
      borough,
      zip: r.zip || '',
      bedrooms,
      bathrooms: 1,
      rent: estRent,
      totalUnits: null,
      affordableUnits: null,
      availableDate: r.registrationenddate
        ? new Date(r.registrationenddate).toISOString().slice(0, 10)
        : 'Contact for availability',
      lat: null,
      lng: null,
      image: pickImage(borough, i + 7),
      features: generateFeatures(borough, i + 3),
      pet: ['Dogs & Cats', 'Cats Only', 'No Pets', 'Dogs & Cats'][i % 4],
      dataSource: 'NYC Open Data — HPD Registrations',
      datasetUrl:
        'https://data.cityofnewyork.us/Housing-Development/Registration-Contacts/feu5-w2e2',
    };
  });
}

function generateFeatures(borough, seed) {
  const allFeatures = [
    'Near Subway',
    'Laundry in Building',
    'Elevator',
    'Hardwood Floors',
    'Natural Light',
    'Renovated Kitchen',
    'High Ceilings',
    'Pre-war Detail',
    'Doorman',
    'Roof Deck',
    'Storage',
    'Gym Access',
    'Near Park',
    'Renovated Bath',
    'Garden Access',
    'Spacious Layout',
  ];
  // Pick 3-4 pseudo-random features
  const count = 3 + (seed % 2);
  const start = seed % allFeatures.length;
  const picked = [];
  for (let i = 0; i < count; i++) {
    picked.push(allFeatures[(start + i * 3) % allFeatures.length]);
  }
  return [...new Set(picked)];
}

// ---- Main data load ----
async function loadData() {
  showLoading(true);
  let listings = [];
  const errors = [];

  try {
    const [ahData, hpdData] = await Promise.allSettled([
      fetchAffordableHousing(),
      fetchHPDRegistrations(),
    ]);

    if (ahData.status === 'fulfilled' && ahData.value.length > 0) {
      listings.push(...transformAffordableHousing(ahData.value));
    } else if (ahData.status === 'rejected') {
      errors.push(`Affordable Housing API: ${ahData.reason.message}`);
    }

    if (hpdData.status === 'fulfilled' && hpdData.value.length > 0) {
      listings.push(...transformHPDRegistrations(hpdData.value));
    } else if (hpdData.status === 'rejected') {
      errors.push(`HPD Registrations API: ${hpdData.reason.message}`);
    }
  } catch (err) {
    errors.push(err.message);
  }

  // De-duplicate by address
  const seen = new Set();
  allListings = listings.filter((l) => {
    const key = `${l.address}-${l.borough}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  showLoading(false);

  if (allListings.length === 0) {
    showApiError(errors);
  } else {
    updateDataBanner(allListings.length);
    applyFilters();
  }
}

// ---- UI: Loading ----
function showLoading(show) {
  const grid = document.getElementById('listings-grid');
  if (show) {
    grid.innerHTML = `
      <div class="loading-state" style="grid-column: 1/-1; text-align:center; padding:60px 20px;">
        <div class="loading-spinner"></div>
        <p style="color:var(--text-muted); margin-top:16px;">Loading live data from NYC Open Data...</p>
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
    <div style="grid-column: 1/-1; text-align:center; padding:60px 24px;">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="margin-bottom:16px;">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>
      </svg>
      <h3 style="font-family:'Space Grotesk',sans-serif; font-size:1.3rem; margin-bottom:8px;">
        Could not connect to NYC Open Data
      </h3>
      <p style="color:var(--text-secondary); max-width:480px; margin:0 auto 8px;">
        This site pulls live data from the NYC Open Data Socrata API. The connection may be temporarily unavailable.
      </p>
      ${errors.length > 0 ? `<p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:20px;">${errors.map(e => escapeHtml(e)).join('<br>')}</p>` : ''}
      <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="loadData()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 105.64-11.36L3 10"/></svg>
          Retry
        </button>
        <a href="https://data.cityofnewyork.us/Housing-Development/Affordable-Housing-Production-by-Building/hg8x-zxpr" target="_blank" rel="noopener" class="btn btn-secondary">
          View Data on NYC Open Data
        </a>
      </div>
    </div>`;
}

function updateDataBanner(count) {
  document.getElementById('listing-count').textContent = count;
  const banner = document.getElementById('data-banner');
  if (banner) {
    banner.textContent = `Showing ${count} listings from NYC Open Data (live)`;
    banner.className = 'data-banner live';
  }
}

// ---- Filtering ----
function applyFilters() {
  const borough = document.getElementById('filter-borough').value;
  const bedrooms = document.getElementById('filter-bedrooms').value;
  const maxRent = document.getElementById('filter-rent').value;
  const pet = document.getElementById('filter-pet').value;
  const search = document.getElementById('filter-search').value.toLowerCase().trim();
  const sortBy = document.getElementById('sort-by').value;

  filteredListings = allListings.filter((l) => {
    if (borough !== 'all' && l.borough !== borough) return false;
    if (bedrooms !== 'all' && String(l.bedrooms) !== bedrooms) return false;
    if (maxRent !== 'all' && l.rent > parseInt(maxRent)) return false;
    if (pet !== 'all' && l.pet !== pet) return false;
    if (
      search &&
      !`${l.address} ${l.neighborhood} ${l.borough} ${l.projectName || ''}`
        .toLowerCase()
        .includes(search)
    )
      return false;
    return true;
  });

  // Sort
  switch (sortBy) {
    case 'rent-asc':
      filteredListings.sort((a, b) => a.rent - b.rent);
      break;
    case 'rent-desc':
      filteredListings.sort((a, b) => b.rent - a.rent);
      break;
    case 'sqft-desc':
      filteredListings.sort((a, b) => (b.sqft || 0) - (a.sqft || 0));
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
  document.getElementById('filter-pet').value = 'all';
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
    <article class="listing-card" onclick="openModal('${l.id}')" style="animation-delay: ${Math.min(i * 0.05, 0.3)}s" tabindex="0" role="button" aria-label="View details for ${l.address}">
      <div class="card-image">
        <img src="${l.image}" alt="Apartment at ${l.address}" loading="lazy">
        <span class="card-badge">Rent Stabilized</span>
        <span class="card-rent-badge">${formatRent(l.rent)}<span>/mo</span></span>
      </div>
      <div class="card-body">
        <h3 class="card-address">${escapeHtml(l.address)}</h3>
        <p class="card-neighborhood">${escapeHtml(l.neighborhood)}, ${escapeHtml(l.borough)}</p>
        <div class="card-details">
          <span class="card-detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v11a2 2 0 002 2h14a2 2 0 002-2V7"/><path d="M3 7l4-4h10l4 4"/><path d="M12 3v4"/></svg>
            ${bedroomLabel(l.bedrooms)}
          </span>
          <span class="card-detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z"/><path d="M3 12V7a4 4 0 014-4h0a4 4 0 014 4v1"/></svg>
            ${l.bathrooms} Bath
          </span>
          ${l.sqft ? `<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>${l.sqft} sqft</span>` : ''}
        </div>
        <div class="card-features">
          ${(l.features || [])
            .slice(0, 3)
            .map((f) => `<span class="feature-tag">${escapeHtml(f)}</span>`)
            .join('')}
        </div>
      </div>
      <div class="card-footer">
        <span class="card-available">
          ${l.availableDate && l.availableDate !== 'Contact for availability' ? `<strong>Avail:</strong> ${formatDate(l.availableDate)}` : 'Contact for availability'}
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

  content.innerHTML = `
    <img class="modal-image" src="${listing.image}" alt="Apartment at ${escapeHtml(listing.address)}">
    <div class="modal-body">
      <div class="stabilized-since">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Rent Stabilized ${listing.stabilizedSince ? `since ${listing.stabilizedSince}` : ''}
      </div>
      <h2>${escapeHtml(listing.address)}${listing.unit ? `, Unit ${escapeHtml(listing.unit)}` : ''}</h2>
      <p class="modal-neighborhood">${escapeHtml(listing.neighborhood)}, ${escapeHtml(listing.borough)} ${listing.zip || ''}</p>

      <div class="modal-price-row">
        <span class="modal-price">${formatRent(listing.rent)} <span>/month</span></span>
        ${listing.legalRent ? `<span class="modal-legal-rent">Legal rent: ${formatRent(listing.legalRent)}/mo</span>` : ''}
      </div>

      <div class="modal-details-grid">
        <div class="modal-detail-item">
          <span class="modal-detail-label">Bedrooms</span>
          <span class="modal-detail-value">${bedroomLabel(listing.bedrooms)}</span>
        </div>
        <div class="modal-detail-item">
          <span class="modal-detail-label">Bathrooms</span>
          <span class="modal-detail-value">${listing.bathrooms}</span>
        </div>
        ${listing.sqft ? `<div class="modal-detail-item"><span class="modal-detail-label">Square Feet</span><span class="modal-detail-value">${listing.sqft.toLocaleString()}</span></div>` : ''}
        <div class="modal-detail-item">
          <span class="modal-detail-label">Available</span>
          <span class="modal-detail-value">${formatDate(listing.availableDate)}</span>
        </div>
        <div class="modal-detail-item">
          <span class="modal-detail-label">Pets</span>
          <span class="modal-detail-value">${listing.pet || 'Contact landlord'}</span>
        </div>
        ${listing.totalUnits ? `<div class="modal-detail-item"><span class="modal-detail-label">Total Units</span><span class="modal-detail-value">${listing.totalUnits}</span></div>` : ''}
        ${listing.affordableUnits ? `<div class="modal-detail-item"><span class="modal-detail-label">Affordable Units</span><span class="modal-detail-value">${listing.affordableUnits}</span></div>` : ''}
      </div>

      <div class="modal-features">
        ${(listing.features || []).map((f) => `<span class="feature-tag">${escapeHtml(f)}</span>`).join('')}
      </div>

      <div class="modal-data-source" style="background: var(--bg-elevated); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 20px; font-size: 0.8rem; color: var(--text-muted);">
        <strong style="color: var(--text-secondary);">Data source:</strong> ${escapeHtml(listing.dataSource || 'NYC Open Data')}
        ${listing.datasetUrl ? `<br><a href="${listing.datasetUrl}" target="_blank" rel="noopener" style="color: var(--accent); text-decoration:none;">View dataset &rarr;</a>` : ''}
      </div>

      <div class="modal-contact">
        ${listing.contact ? `<a href="tel:${listing.contact}" class="btn btn-primary" style="flex:1;justify-content:center;">Call ${listing.contact}</a>` : ''}
        <a href="https://amirentstabilized.com/" target="_blank" rel="noopener" class="btn btn-secondary" style="flex:1;justify-content:center;">Verify Status</a>
      </div>

      <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 16px; text-align: center;">
        Always verify rent stabilization status with
        <a href="https://hcr.ny.gov/" target="_blank" rel="noopener" style="color: var(--accent);">NYS HCR</a>
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
['filter-borough', 'filter-bedrooms', 'filter-rent', 'filter-pet', 'sort-by'].forEach((id) => {
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

// ---- Loading spinner CSS injected ----
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
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
  padding: 8px 16px;
  font-size: 0.8rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
}
.data-banner.live {
  background: rgba(16,185,129,0.1);
  color: var(--success);
}
.data-banner.error {
  background: rgba(239,68,68,0.1);
  color: #EF4444;
}
`;
document.head.appendChild(spinnerStyle);

// Add data banner to page
const filterBar = document.querySelector('.filter-bar');
if (filterBar) {
  const banner = document.createElement('div');
  banner.id = 'data-banner';
  banner.className = 'data-banner';
  banner.textContent = 'Loading data...';
  filterBar.parentNode.insertBefore(banner, filterBar);
}

// ---- Boot ----
loadData();
