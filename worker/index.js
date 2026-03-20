// StableNYC Listing Proxy — Cloudflare Worker (free tier)
// Fetches rent-stabilized apartment listings from:
//   1. StreetEasy API via RapidAPI (primary)
//   2. Craigslist RSS feeds (fallback)
//   3. NYC Open Data — Affordable Housing Production (always available)
// Deploy: cd worker && npx wrangler deploy
// Set API key: npx wrangler secret put RAPIDAPI_KEY

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// RapidAPI StreetEasy host (realestator provider)
const RAPIDAPI_HOST = 'streeteasy-api.p.rapidapi.com';

// StreetEasy area codes for borough filtering
const SE_AREAS = {
  all: '',
  manhattan: 'Manhattan',
  brooklyn: 'Brooklyn',
  queens: 'Queens',
  bronx: 'Bronx',
  'staten island': 'Staten Island',
};

// Craigslist NYC area codes (fallback)
const CL_AREAS = {
  all: ['mnh', 'brk', 'que', 'brx', 'stn'],
  manhattan: ['mnh'],
  brooklyn: ['brk'],
  queens: ['que'],
  bronx: ['brx'],
  'staten island': ['stn'],
};

const CL_BOROUGH_NAMES = {
  mnh: 'Manhattan',
  brk: 'Brooklyn',
  que: 'Queens',
  brx: 'Bronx',
  stn: 'Staten Island',
};

const RS_KEYWORDS = [
  'rent stabilized', 'rent-stabilized', 'rent regulated', 'rent-regulated',
  'stabilized apartment', 'regulated apartment',
];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'listings';

    try {
      if (action === 'listings') {
        const borough = url.searchParams.get('borough') || 'all';
        const result = await fetchAllListings(borough, env);
        return jsonResponse({
          listings: result.listings,
          borough,
          errors: result.errors,
          count: result.listings.length,
        });
      }

      if (action === 'debug') {
        const debugInfo = await debugFetch(env);
        return jsonResponse(debugInfo);
      }

      return jsonResponse({ error: 'Unknown action' }, 400);
    } catch (err) {
      return jsonResponse({ error: err.message, listings: [] }, 500);
    }
  },
};

// ============================================================
// MAIN: Fetch from all sources and combine
// ============================================================

async function fetchAllListings(borough, env) {
  const allListings = [];
  const seenKeys = new Set();
  const errors = [];

  // Try StreetEasy API first (if API key is configured)
  if (env.RAPIDAPI_KEY) {
    try {
      const seListings = await fetchStreetEasyAPI(borough, env.RAPIDAPI_KEY);
      for (const l of seListings) {
        const key = `${l.address}|${l.price}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allListings.push(l);
        }
      }
    } catch (e) {
      errors.push({ source: 'streeteasy', error: e.message });
    }
  } else {
    errors.push({ source: 'streeteasy', error: 'No RAPIDAPI_KEY configured' });
  }

  // Also fetch from Craigslist RSS
  try {
    const clListings = await fetchCraigslistListings(borough);
    for (const l of clListings) {
      const key = `${l.address}|${l.price}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allListings.push(l);
      }
    }
  } catch (e) {
    errors.push({ source: 'craigslist', error: e.message });
  }

  // Also fetch from NYC Open Data (affordable housing buildings — always available)
  try {
    const nycListings = await fetchNYCOpenData(borough);
    for (const l of nycListings) {
      const key = `${l.address}|${l.price}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allListings.push(l);
      }
    }
  } catch (e) {
    errors.push({ source: 'nycopendata', error: e.message });
  }

  return { listings: allListings, errors };
}

// ============================================================
// SOURCE 1: StreetEasy API via RapidAPI
// ============================================================

async function fetchStreetEasyAPI(borough, apiKey) {
  const area = SE_AREAS[borough.toLowerCase()] || '';

  // Try multiple endpoint paths (StreetEasy API on RapidAPI by realestator)
  const endpoints = [
    `/rentals/active`,
    `/for-rent`,
    `/rentals/search`,
    `/rentals`,
    `/search`,
  ];

  let data = null;
  let lastError = '';

  for (const endpoint of endpoints) {
    const params = new URLSearchParams();
    if (area) params.set('areas', area);
    params.set('limit', '100');
    params.set('offset', '0');

    try {
      const resp = await fetch(`https://${RAPIDAPI_HOST}${endpoint}?${params}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      });

      if (resp.ok) {
        data = await resp.json();
        break;
      } else {
        lastError = `${endpoint}: HTTP ${resp.status}`;
      }
    } catch (e) {
      lastError = `${endpoint}: ${e.message}`;
    }
  }

  if (!data) {
    throw new Error(`All StreetEasy API endpoints failed. Last: ${lastError}`);
  }
  const listings = [];

  // Parse the API response — adapt to actual response structure
  const items = Array.isArray(data) ? data : (data.listings || data.results || data.data || []);

  for (const item of items) {
    // Check if listing mentions rent stabilization
    const combined = [
      item.description, item.title, item.name,
      item.amenities, item.details,
    ].filter(Boolean).join(' ').toLowerCase();

    const isRS = RS_KEYWORDS.some(kw => combined.includes(kw));
    if (!isRS) continue;

    listings.push({
      url: item.url || item.link || item.detailUrl || '',
      address: item.address || item.streetAddress || item.title || '',
      borough: item.borough || item.area || item.neighborhood || '',
      neighborhood: item.neighborhood || item.area || '',
      zip: item.zip || item.zipCode || item.postalCode || '',
      price: parsePrice(item.price || item.rent || item.monthlyRent),
      bedrooms: item.bedrooms || item.beds || 0,
      bathrooms: item.bathrooms || item.baths || null,
      description: item.description || '',
      title: item.title || item.name || '',
      lat: item.latitude || item.lat || null,
      lng: item.longitude || item.lng || item.lon || null,
      images: extractAPIImages(item),
      source: 'streeteasy',
      postedDate: item.listedDate || item.datePosted || null,
    });
  }

  return listings;
}

function parsePrice(val) {
  if (!val) return null;
  if (typeof val === 'number') return val;
  return parseInt(String(val).replace(/[$,\s]/g, ''), 10) || null;
}

function extractAPIImages(item) {
  if (item.photos && Array.isArray(item.photos)) return item.photos.slice(0, 5);
  if (item.images && Array.isArray(item.images)) return item.images.slice(0, 5);
  if (item.image) return [item.image];
  if (item.photo) return [item.photo];
  return [];
}

// ============================================================
// SOURCE 2: Craigslist RSS Feeds
// ============================================================

async function fetchCraigslistListings(borough) {
  const areas = CL_AREAS[borough.toLowerCase()] || CL_AREAS.all;
  const allListings = [];
  const seenUrls = new Set();

  const fetches = areas.map(area => fetchCraigslistArea(area));
  const results = await Promise.all(fetches);

  for (const areaListings of results) {
    for (const listing of areaListings) {
      if (!seenUrls.has(listing.url)) {
        seenUrls.add(listing.url);
        allListings.push(listing);
      }
    }
  }

  return allListings;
}

async function fetchCraigslistArea(area) {
  const rssUrl = `https://newyork.craigslist.org/search/${area}/apa?format=rss&query=%22rent+stabilized%22&availabilityMode=0`;

  try {
    const resp = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    if (!resp.ok) return [];
    const xml = await resp.text();
    return parseCraigslistRSS(xml, area);
  } catch (e) {
    return [];
  }
}

function parseCraigslistRSS(xml, area) {
  const listings = [];
  const borough = CL_BOROUGH_NAMES[area] || '';

  const items = xml.match(/<item\b[\s\S]*?<\/item>/g) || [];

  for (const item of items) {
    const title = extractTag(item, 'title');
    const link = extractTag(item, 'link');
    const description = extractTag(item, 'description');
    const dateStr = extractTag(item, 'dc:date') || extractTag(item, 'pubDate');

    if (!link) continue;

    const combined = `${title} ${description}`.toLowerCase();
    if (!RS_KEYWORDS.some(kw => combined.includes(kw))) continue;

    const priceMatch = title.match(/\$\s*([\d,]+)/);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : null;

    const brMatch = title.match(/(\d+)\s*br\b/i);
    const bedrooms = brMatch ? parseInt(brMatch[1]) : 0;

    const address = extractAddressFromCL(description, title);
    const neighborhood = extractNeighborhood(title);

    const latMatch = item.match(/<geo:lat>([^<]+)/);
    const lngMatch = item.match(/<geo:long>([^<]+)/);
    const lat = latMatch ? parseFloat(latMatch[1]) : null;
    const lng = lngMatch ? parseFloat(lngMatch[1]) : null;

    const images = extractImages(item, description);
    const cleanDesc = stripHtml(description);

    listings.push({
      url: link,
      address: address || '',
      borough,
      neighborhood: neighborhood || borough,
      price,
      bedrooms,
      bathrooms: null,
      description: cleanDesc.slice(0, 500),
      title: stripHtml(title),
      lat,
      lng,
      images,
      source: 'craigslist',
      postedDate: dateStr || null,
    });
  }

  return listings;
}

// ============================================================
// SOURCE 3: NYC Open Data — Affordable Housing Production
// Free SODA API, no key required, always available
// ============================================================

const NYC_BOROUGH_MAP = {
  all: '',
  manhattan: 'Manhattan',
  brooklyn: 'Brooklyn',
  queens: 'Queens',
  bronx: 'Bronx',
  'staten island': 'Staten Island',
};

async function fetchNYCOpenData(borough) {
  const boroughFilter = NYC_BOROUGH_MAP[borough.toLowerCase()] || '';
  const params = new URLSearchParams({
    $limit: '100',
    $order: 'project_completion_date DESC',
    $where: 'counted_rental_units > 0 AND latitude IS NOT NULL',
  });
  if (boroughFilter) {
    params.set('$where', `counted_rental_units > 0 AND latitude IS NOT NULL AND borough='${boroughFilter}'`);
  }

  const url = `https://data.cityofnewyork.us/resource/hg8x-zxpr.json?${params}`;
  const resp = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!resp.ok) throw new Error(`NYC Open Data: HTTP ${resp.status}`);
  const data = await resp.json();

  const listings = [];
  for (const item of data) {
    const addr = [item.number, item.street].filter(Boolean).join(' ');
    if (!addr) continue;

    const totalUnits = parseInt(item.all_counted_units) || 0;
    const bedrooms = parseInt(item._1_br_units) || parseInt(item.studio_units) || 0;

    listings.push({
      url: `https://www.nyc.gov/site/hpd/about/open-data.page`,
      address: addr,
      borough: item.borough || '',
      neighborhood: item.nta_neighborhood_tabulation_area || item.borough || '',
      zip: item.postcode || '',
      price: null,
      bedrooms,
      bathrooms: null,
      description: `Affordable housing building with ${totalUnits} counted units. ${item.reporting_construction_type || ''}. Project: ${item.project_name || 'N/A'}.`,
      title: `${addr} — ${totalUnits} Affordable Units`,
      lat: parseFloat(item.latitude) || null,
      lng: parseFloat(item.longitude) || null,
      images: [],
      source: 'nycopendata',
      postedDate: item.project_completion_date || null,
    });
  }

  return listings;
}

// ============================================================
// XML/HTML PARSING HELPERS
// ============================================================

function extractTag(xml, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tagName}>`, 'i');
  const match = xml.match(pattern);
  return match ? match[1].trim() : '';
}

function extractAddressFromCL(description, title) {
  const descText = stripHtml(description);
  const addrMatch = descText.match(/(\d+[\s-]*(?:\d+\s+)?(?:E(?:ast)?|W(?:est)?|N(?:orth)?|S(?:outh)?)?\s*\.?\s*\d*(?:st|nd|rd|th)?\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Place|Pl|Drive|Dr|Road|Rd|Lane|Ln|Court|Ct|Way|Parkway|Pkwy|Terrace|Ter|Broadway|Concourse)[^,\n]{0,30})/i);
  if (addrMatch) return addrMatch[1].trim();

  const titleParts = title.split(/\s*-\s*/);
  for (const part of titleParts) {
    if (part.match(/\d+\s+\w+\s+(?:st|ave|blvd|pl|dr|rd|ln|ct|way|broadway|concourse)/i)) {
      return part.trim();
    }
  }

  return '';
}

function extractNeighborhood(title) {
  const parts = title.split(/\s*-\s*/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim();
    if (!last.match(/^\$/) && !last.match(/^\d+\s*br/i) && last.length > 2 && last.length < 40) {
      return last;
    }
  }
  return '';
}

function extractImages(itemXml, description) {
  const images = [];

  const enclosures = itemXml.match(/<enc:enclosure[^>]*resource="([^"]+)"/g) || [];
  for (const enc of enclosures) {
    const urlMatch = enc.match(/resource="([^"]+)"/);
    if (urlMatch && urlMatch[1].match(/\.(jpg|jpeg|png|webp)/i)) {
      images.push(urlMatch[1]);
    }
  }

  const imgTags = description.match(/<img[^>]*src="([^"]+)"/g) || [];
  for (const img of imgTags) {
    const srcMatch = img.match(/src="([^"]+)"/);
    if (srcMatch && !images.includes(srcMatch[1])) {
      images.push(srcMatch[1]);
    }
  }

  return images.slice(0, 5);
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// DEBUG ENDPOINT
// ============================================================

async function debugFetch(env) {
  const results = { hasApiKey: !!env.RAPIDAPI_KEY, host: RAPIDAPI_HOST, sources: {} };

  // Test StreetEasy API — try multiple endpoints
  if (env.RAPIDAPI_KEY) {
    const endpoints = ['/rentals/active', '/for-rent', '/rentals/search', '/rentals', '/search'];
    results.sources.streeteasy = {};
    for (const endpoint of endpoints) {
      try {
        const params = new URLSearchParams({ limit: '5', offset: '0' });
        const resp = await fetch(`https://${RAPIDAPI_HOST}${endpoint}?${params}`, {
          headers: {
            'X-RapidAPI-Key': env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': RAPIDAPI_HOST,
          },
        });
        const body = await resp.text();
        results.sources.streeteasy[endpoint] = {
          status: resp.status,
          responseLength: body.length,
          preview: body.slice(0, 500),
        };
      } catch (e) {
        results.sources.streeteasy[endpoint] = { error: e.message };
      }
    }
  }

  // Test Craigslist RSS
  try {
    const rssUrl = 'https://newyork.craigslist.org/search/mnh/apa?format=rss&query=%22rent+stabilized%22&availabilityMode=0';
    const resp = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    const xml = await resp.text();
    const listings = parseCraigslistRSS(xml, 'mnh');
    results.sources.craigslist = {
      status: resp.status,
      xmlLength: xml.length,
      totalItems: (xml.match(/<item\b/g) || []).length,
      rsListings: listings.length,
      firstListing: listings[0] || null,
    };
  } catch (e) {
    results.sources.craigslist = { error: e.message };
  }

  // Test NYC Open Data
  try {
    const nycListings = await fetchNYCOpenData('all');
    results.sources.nycopendata = {
      status: 200,
      count: nycListings.length,
      firstListing: nycListings[0] || null,
    };
  } catch (e) {
    results.sources.nycopendata = { error: e.message };
  }

  return results;
}

// ============================================================
// RESPONSE HELPER
// ============================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}
