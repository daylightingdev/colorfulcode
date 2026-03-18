// ============================================================
// StableNYC — Rent Stabilized Homes in NYC
// Only shows real Housing Connect lottery listings
// Every data point comes from NYC Open Data — nothing fabricated
// ============================================================

const SODA_BASE = 'https://data.cityofnewyork.us/resource';

const DATASETS = {
  lotteries: `${SODA_BASE}/vy5i-a666.json`,
  lotteriesBuilding: `${SODA_BASE}/nibs-na6y.json`,
};

// Deep link to a specific lottery on Housing Connect
function housingConnectUrl(lotteryId) {
  if (lotteryId) return `https://housingconnect.nyc.gov/PublicWeb/details/${lotteryId}`;
  return 'https://housingconnect.nyc.gov/PublicWeb/search-lotteries';
}

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
let map;
let markersLayer;
let modalMap;
let currentView = 'split';
let currentPage = 1;
const LISTINGS_PER_PAGE = 6;

// No neighborhood guessing — we only use data from the API.
// Borough is the only location context available from the SODA dataset.

// ============================================================
// DATA FETCHERS — Housing Connect lotteries only
// ============================================================

async function fetchLotteries() {
  const params = new URLSearchParams({
    $limit: 500,
    $order: 'lottery_start_date DESC',
    $select: 'lottery_id,lottery_name,lottery_start_date,lottery_end_date,lottery_status,unit_count,building_count',
  });
  const resp = await fetch(`${DATASETS.lotteries}?${params}`);
  if (!resp.ok) throw new Error(`Housing Connect Lotteries API: ${resp.status}`);
  return resp.json();
}

async function fetchLotteriesBuilding() {
  const params = new URLSearchParams({
    $limit: 1000,
    $order: 'lottery_id DESC',
    $select: 'lottery_id,lottery_name,house_number,street_name,borough,address_zipcode,address_bbl,address_buildingidentificationnumber,unit_count,address_latitude,address_longitude',
  });
  const resp = await fetch(`${DATASETS.lotteriesBuilding}?${params}`);
  if (!resp.ok) throw new Error(`Housing Connect Buildings API: ${resp.status}`);
  return resp.json();
}

// ============================================================
// TRANSFORMER — real data only, nothing fabricated
// ============================================================

function transformLotteriesBuilding(lotteryLookup, buildingRecords) {
  return buildingRecords
    .map((r, i) => {
      const borough = normBorough(r.borough);
      const address = `${r.house_number || ''} ${r.street_name || ''}`.trim();
      const bbl = r.address_bbl || null;
      const bin = r.address_buildingidentificationnumber || null;
      const totalUnits = parseInt(r.unit_count) || 0;

      const lottery = lotteryLookup[r.lottery_id] || {};
      const status = lottery.lottery_status || '';
      const lotteryStart = lottery.lottery_start_date || '';
      const lotteryEnd = lottery.lottery_end_date || '';
      const lotteryId = r.lottery_id || '';

      return {
        id: `hc-${lotteryId}-${bbl || bin || i}`,
        lotteryId,
        projectName: r.lottery_name || lottery.lottery_name || '',
        address: address || 'Address on file with HPD',
        neighborhood: '', // Not available from API
        borough,
        zip: r.address_zipcode || '',
        bbl,
        totalUnits,
        lotteryStatus: status,
        lotteryStart: lotteryStart ? new Date(lotteryStart).toISOString().slice(0, 10) : '',
        lotteryEnd: lotteryEnd ? new Date(lotteryEnd).toISOString().slice(0, 10) : '',
        lat: parseFloat(r.address_latitude) || null,
        lng: parseFloat(r.address_longitude) || null,
        externalUrl: housingConnectUrl(lotteryId),
      };
    })
    .filter(l => l.address !== 'Address on file with HPD' && l.borough);
}

// ============================================================
// MAIN DATA LOAD
// ============================================================

async function loadData() {
  showLoading(true);
  const errors = [];

  try {
    const [lotteriesResult, lotBldgResult] = await Promise.allSettled([
      fetchLotteries(),
      fetchLotteriesBuilding(),
    ]);

    const lotteryLookup = {};
    if (lotteriesResult.status === 'fulfilled') {
      for (const l of lotteriesResult.value) {
        lotteryLookup[l.lottery_id] = l;
      }
    } else {
      errors.push(`Lotteries: ${lotteriesResult.reason.message}`);
    }

    if (lotBldgResult.status === 'fulfilled' && lotBldgResult.value.length > 0) {
      const transformed = transformLotteriesBuilding(lotteryLookup, lotBldgResult.value);

      // De-duplicate by address + lottery
      const seen = new Set();
      allListings = transformed.filter(l => {
        const key = `${l.lotteryId}-${l.address.toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } else if (lotBldgResult.status === 'rejected') {
      errors.push(`Buildings: ${lotBldgResult.reason.message}`);
    }
  } catch (err) {
    errors.push(err.message);
  }

  showLoading(false);

  if (allListings.length === 0) {
    showApiError(errors);
  } else {
    updateDataBanner(allListings.length, errors);
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
    const label = listing.totalUnits ? `${listing.totalUnits} units` : listing.projectName || 'Lottery';
    const statusColor = getStatusColor(listing.lotteryStatus);

    const icon = L.divIcon({
      className: 'price-marker-wrapper',
      html: `<div class="price-pill" data-listing-id="${listing.id}" style="background:${statusColor}">
        ${escapeHtml(label)}
      </div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const marker = L.marker([listing.lat, listing.lng], { icon });

    marker.bindPopup(`
      <div class="map-popup">
        <div style="padding:12px;">
          <strong>${escapeHtml(listing.address)}</strong>
          <p>${escapeHtml(listing.borough)}</p>
          ${listing.projectName ? `<p style="font-size:0.8rem; color:var(--accent); font-weight:600; margin:4px 0 0;">${escapeHtml(listing.projectName)}</p>` : ''}
          ${listing.totalUnits ? `<p style="font-size:0.8rem; color:var(--text-secondary); margin:4px 0 0;">${listing.totalUnits} units</p>` : ''}
          <p style="font-size:0.78rem; color:${statusColor}; font-weight:600; margin:4px 0 0;">${escapeHtml(listing.lotteryStatus || 'Status on Housing Connect')}</p>
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

function getStatusColor(status) {
  if (!status) return '#78716C';
  const s = status.toLowerCase();
  if (s.includes('open') || s.includes('accepting')) return '#16A34A';
  if (s.includes('upcoming')) return '#2563EB';
  if (s.includes('closed') || s.includes('filled')) return '#DC2626';
  return '#D97706';
}

function getStatusLabel(status) {
  if (!status) return 'See Housing Connect';
  return status;
}

function formatDate(d) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function showLoading(show) {
  const grid = document.getElementById('listings-grid');
  if (show) {
    grid.innerHTML = `
      <div class="loading-state" style="grid-column:1/-1; text-align:center; padding:60px 20px;">
        <div class="loading-spinner"></div>
        <p style="color:var(--text-muted); margin-top:16px;">Loading Housing Connect lotteries from NYC Open Data...</p>
      </div>`;
  }
}

function showApiError(errors) {
  const grid = document.getElementById('listings-grid');
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('listing-count').textContent = '0';
  document.getElementById('results-count').textContent = '0 listings found';

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
        <a href="https://housingconnect.nyc.gov/PublicWeb/search-lotteries" target="_blank" rel="noopener" class="btn btn-secondary">Browse Housing Connect</a>
      </div>
    </div>`;
}

function updateDataBanner(count, errors) {
  document.getElementById('listing-count').textContent = count;

  // Count boroughs from actual data
  const boroughs = new Set(allListings.map(l => l.borough).filter(Boolean));
  const boroughCountEl = document.getElementById('borough-count');
  if (boroughCountEl) boroughCountEl.textContent = boroughs.size;

  const banner = document.getElementById('data-banner');
  if (!banner) return;

  const errCount = errors.length;
  let text = `${count} Housing Connect lottery listings — data from NYC Open Data`;
  if (errCount > 0) text += ` | ${errCount} source${errCount > 1 ? 's' : ''} unavailable`;
  banner.textContent = text;
  banner.className = errCount > 0 ? 'data-banner partial' : 'data-banner live';
}

// ---- Filtering ----
function applyFilters() {
  const borough = document.getElementById('filter-borough').value;
  const status = document.getElementById('filter-status').value;
  const search = document.getElementById('filter-search').value.toLowerCase().trim();
  const sortBy = document.getElementById('sort-by').value;

  filteredListings = allListings.filter(l => {
    if (borough !== 'all' && l.borough !== borough) return false;
    if (status !== 'all') {
      const s = (l.lotteryStatus || '').toLowerCase();
      if (status === 'open' && !s.includes('open') && !s.includes('accepting')) return false;
      if (status === 'upcoming' && !s.includes('upcoming')) return false;
      if (status === 'closed' && !s.includes('closed') && !s.includes('filled')) return false;
    }
    if (search && !`${l.address} ${l.borough} ${l.projectName || ''}`.toLowerCase().includes(search)) return false;
    return true;
  });

  switch (sortBy) {
    case 'date-asc': filteredListings.sort((a, b) => new Date(a.lotteryEnd || '2099') - new Date(b.lotteryEnd || '2099')); break;
    case 'date-desc': filteredListings.sort((a, b) => new Date(b.lotteryStart || '1900') - new Date(a.lotteryStart || '1900')); break;
    case 'units-desc': filteredListings.sort((a, b) => (b.totalUnits || 0) - (a.totalUnits || 0)); break;
    case 'borough': filteredListings.sort((a, b) => a.borough.localeCompare(b.borough)); break;
  }

  currentPage = 1;
  renderListings();
  updateMapMarkers();
}

function resetFilters() {
  document.getElementById('filter-borough').value = 'all';
  document.getElementById('filter-status').value = 'all';
  document.getElementById('filter-search').value = '';
  document.getElementById('sort-by').value = 'date-desc';
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

// ============================================================
// RENDER LISTING CARDS — no photos, no fake rents, data only
// ============================================================

function renderListings() {
  const grid = document.getElementById('listings-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('results-count');

  count.textContent = `${filteredListings.length} lottery listing${filteredListings.length !== 1 ? 's' : ''} found`;

  if (filteredListings.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    document.getElementById('pagination-container').innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  const pageListings = getPageListings();

  grid.innerHTML = pageListings.map((l, i) => {
    const statusColor = getStatusColor(l.lotteryStatus);
    const statusLabel = getStatusLabel(l.lotteryStatus);

    return `
    <article class="listing-card" data-id="${l.id}" onclick="openModal('${l.id}')" style="animation-delay:${Math.min(i * 0.03, 0.15)}s" tabindex="0" role="button" aria-label="View ${escapeHtml(l.address)}"
      onmouseenter="highlightMarker('${l.id}')" onmouseleave="unhighlightMarker('${l.id}')">
      <div class="card-status-header" style="background:${statusColor};">
        <span class="status-dot"></span>
        ${escapeHtml(statusLabel)}
      </div>
      <div class="card-body">
        ${l.projectName ? `<p class="card-project">${escapeHtml(l.projectName)}</p>` : ''}
        <h3 class="card-address">${escapeHtml(l.address)}</h3>
        <p class="card-neighborhood">${escapeHtml(l.borough)}${l.zip ? ' ' + l.zip : ''}</p>
        <div class="card-details">
          ${l.totalUnits ? `<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>${l.totalUnits} units</span>` : ''}
          ${l.lotteryEnd ? `<span class="card-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Deadline: ${formatDate(l.lotteryEnd)}</span>` : ''}
        </div>
      </div>
      <div class="card-footer">
        <a href="${l.externalUrl}" target="_blank" rel="noopener" class="card-apply-link" onclick="event.stopPropagation()">
          View on Housing Connect
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
// DETAIL MODAL — shows only real data, links to actual listing
// ============================================================

function openModal(id) {
  const listing = allListings.find(l => l.id === id);
  if (!listing) return;

  const modal = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  const statusColor = getStatusColor(listing.lotteryStatus);
  const hasCoords = listing.lat && listing.lng;

  content.innerHTML = `
    <div class="modal-header-status" style="background:${statusColor};">
      <span class="status-dot"></span>
      ${escapeHtml(getStatusLabel(listing.lotteryStatus))}
    </div>
    ${hasCoords ? `<div class="modal-map-full" id="modal-map-container"></div>` : ''}
    <div class="modal-body">
      ${listing.projectName ? `<p style="font-size:0.9rem; color:var(--accent); font-weight:600; margin-bottom:4px;">${escapeHtml(listing.projectName)}</p>` : ''}
      <h2>${escapeHtml(listing.address)}</h2>
      <p class="modal-neighborhood">${escapeHtml(listing.borough)} ${listing.zip || ''}</p>

      <div class="modal-info-callout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <span>Rent amounts, photos, bedroom details, and income requirements are available on the Housing Connect listing page.</span>
      </div>

      <div class="modal-details-grid">
        ${listing.totalUnits ? `<div class="modal-detail-item"><span class="modal-detail-label">Units</span><span class="modal-detail-value">${listing.totalUnits}</span></div>` : ''}
        ${listing.lotteryStatus ? `<div class="modal-detail-item"><span class="modal-detail-label">Lottery Status</span><span class="modal-detail-value" style="color:${statusColor}; font-weight:600;">${escapeHtml(listing.lotteryStatus)}</span></div>` : ''}
        ${listing.lotteryStart ? `<div class="modal-detail-item"><span class="modal-detail-label">Lottery Opened</span><span class="modal-detail-value">${formatDate(listing.lotteryStart)}</span></div>` : ''}
        ${listing.lotteryEnd ? `<div class="modal-detail-item"><span class="modal-detail-label">Application Deadline</span><span class="modal-detail-value">${formatDate(listing.lotteryEnd)}</span></div>` : ''}
        <div class="modal-detail-item"><span class="modal-detail-label">Borough</span><span class="modal-detail-value">${escapeHtml(listing.borough)}</span></div>
        ${listing.zip ? `<div class="modal-detail-item"><span class="modal-detail-label">ZIP Code</span><span class="modal-detail-value">${escapeHtml(listing.zip)}</span></div>` : ''}
      </div>

      <div class="modal-contact">
        <a href="${listing.externalUrl}" target="_blank" rel="noopener" class="btn btn-primary" style="flex:1;justify-content:center;text-decoration:none;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          View Full Listing on Housing Connect
        </a>
      </div>

      <p style="font-size:0.75rem; color:var(--text-muted); margin-top:16px; text-align:center;">
        Data from <a href="https://data.cityofnewyork.us/Housing-Development/Advertised-Lotteries-on-Housing-Connect-By-Buildin/nibs-na6y" target="_blank" rel="noopener" style="color:var(--accent);">NYC Open Data</a>. See Housing Connect for complete listing details.
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
        radius: 10, fillColor: statusColor, color: '#fff', weight: 3, fillOpacity: 0.9,
      }).addTo(modalMap);
    }, 150);
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
  if (modalMap) { modalMap.remove(); modalMap = null; }
}

// ---- Event Listeners ----
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

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

['filter-borough', 'filter-status', 'sort-by'].forEach(id => {
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

/* Map markers */
.price-marker-wrapper { background:none !important; border:none !important; }
.price-pill {
  position:absolute; transform:translate(-50%, -100%);
  color:white;
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
  border-top:5px solid currentColor; transition:border-top-color 0.15s ease;
}
.price-pill:hover, .price-pill.active {
  z-index:100 !important; transform:translate(-50%, -100%) scale(1.1);
  filter:brightness(1.15);
}

/* Modal map */
.modal-map-full {
  width:100%; height:200px;
}
.modal-map-full .leaflet-container { width:100%; height:100%; }

/* Info callout */
.modal-info-callout {
  display:flex; align-items:flex-start; gap:10px;
  background:var(--accent-bg); border:1px solid rgba(13,148,136,0.2);
  border-radius:var(--radius-sm); padding:12px 16px;
  font-size:0.82rem; color:var(--text-secondary); line-height:1.5;
  margin-bottom:20px;
}
.modal-info-callout svg { color:var(--accent); margin-top:1px; }

/* Card status header */
.card-status-header {
  display:flex; align-items:center; gap:6px;
  padding:8px 16px;
  color:white; font-size:0.78rem; font-weight:600;
  border-radius:var(--radius-md) var(--radius-md) 0 0;
}
.modal-header-status {
  display:flex; align-items:center; gap:6px;
  padding:10px 20px;
  color:white; font-size:0.85rem; font-weight:600;
  border-radius:var(--radius-md) var(--radius-md) 0 0;
}
.status-dot {
  width:8px; height:8px; border-radius:50%;
  background:rgba(255,255,255,0.6);
  flex-shrink:0;
}

/* Card project name */
.card-project {
  font-size:0.82rem; color:var(--accent); font-weight:600;
  margin-bottom:2px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}

/* Apply link in card footer */
.card-apply-link {
  display:flex; align-items:center; gap:6px;
  color:var(--accent); font-size:0.82rem; font-weight:600;
  text-decoration:none; transition:color 0.15s;
}
.card-apply-link:hover { color:var(--accent-dark); }
`;
document.head.appendChild(injectedStyle);

// Add data banner
const filterBar = document.querySelector('.filter-bar');
if (filterBar) {
  const banner = document.createElement('div');
  banner.id = 'data-banner';
  banner.className = 'data-banner';
  banner.textContent = 'Loading Housing Connect lotteries...';
  filterBar.parentNode.insertBefore(banner, filterBar);
}

// ---- Boot ----
initMap();
loadData();
