// StableNYC Listing Proxy — Cloudflare Worker (free tier)
// Searches StreetEasy for rent-stabilized apartments currently on the market.
// Only returns listings that explicitly mention "rent stabilized" or "rent regulated".
// Deploy: cd worker && npx wrangler deploy

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const BOROUGH_SLUGS = {
  manhattan: 'manhattan',
  brooklyn: 'brooklyn',
  queens: 'queens',
  bronx: 'bronx',
  'staten island': 'staten-island',
  all: 'nyc',
};

const RS_KEYWORDS = [
  'rent stabilized', 'rent-stabilized', 'rent regulated', 'rent-regulated',
  'stabilized apartment', 'regulated apartment', 'rs apartment',
];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'listings';

    try {
      if (action === 'debug') {
        // Debug endpoint: show what StreetEasy returns
        const debugInfo = await debugStreetEasyFetch();
        return jsonResponse(debugInfo);
      }

      if (action === 'listings') {
        const borough = url.searchParams.get('borough') || 'all';
        const page = parseInt(url.searchParams.get('page')) || 1;
        const listings = await fetchRentStabilizedListings(borough, page);
        return jsonResponse({ listings, borough, page, source: 'streeteasy' });
      }

      if (action === 'photos') {
        const address = url.searchParams.get('address');
        const borough = url.searchParams.get('borough');
        if (!address) return jsonResponse({ error: 'Missing address parameter' }, 400);
        const photos = await fetchPhotosForAddress(address, borough);
        return jsonResponse({ photos, address, borough });
      }

      return jsonResponse({ error: 'Unknown action' }, 400);
    } catch (err) {
      return jsonResponse({ error: err.message, listings: [], photos: [] }, 500);
    }
  },
};

// ============================================================
// RENT-STABILIZED LISTING SEARCH
// ============================================================

async function fetchRentStabilizedListings(borough, page) {
  const slug = BOROUGH_SLUGS[borough.toLowerCase()] || 'nyc';

  // If a specific page was requested, fetch just that page
  if (page > 1) {
    return fetchSinglePage(slug, page);
  }

  // Otherwise fetch multiple pages to get as many listings as possible
  const MAX_PAGES = 5;
  const allListings = [];
  const seenUrls = new Set();

  for (let p = 1; p <= MAX_PAGES; p++) {
    const pageListings = await fetchSinglePage(slug, p);
    if (pageListings.length === 0) break; // No more results

    for (const listing of pageListings) {
      if (!seenUrls.has(listing.url)) {
        seenUrls.add(listing.url);
        allListings.push(listing);
      }
    }

    // If we got fewer results than expected, we've hit the last page
    if (pageListings.length < 10) break;
  }

  return allListings;
}

// Multiple search URL formats to try (StreetEasy changes their URL patterns)
function getSearchUrls(slug, page) {
  const pageParam = page > 1 ? `?page=${page}` : '';
  return [
    // Format 1: filter syntax with description search
    `https://streeteasy.com/for-rent/${slug}/status:open%7Cdescription:%22rent+stabilized%22${pageParam}`,
    // Format 2: text search parameter
    `https://streeteasy.com/for-rent/${slug}?utf8=%E2%9C%93&search=rent+stabilized${page > 1 ? '&page=' + page : ''}`,
    // Format 3: amenity/keyword filter
    `https://streeteasy.com/for-rent/${slug}/rent+stabilized${pageParam}`,
  ];
}

async function fetchSinglePage(slug, page) {
  const urls = getSearchUrls(slug, page);

  for (const searchUrl of urls) {
    try {
      const resp = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip',
          'Cache-Control': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
        },
        cf: { cacheTtl: 300 },
      });

      if (!resp.ok) continue;
      const html = await resp.text();
      const raw = parseStreetEasyListings(html);
      const verified = raw.filter(l => isVerifiedRentStabilized(l));

      if (verified.length > 0) return verified;
    } catch (e) {
      // Try next URL format
    }
  }

  return [];
}

// Debug endpoint to diagnose what StreetEasy returns
async function debugStreetEasyFetch() {
  const slug = 'nyc';
  const urls = getSearchUrls(slug, 1);
  const results = [];

  for (const searchUrl of urls) {
    try {
      const resp = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        cf: { cacheTtl: 0 },
      });

      const html = await resp.text();
      const hasJsonLd = html.includes('application/ld+json');
      const hasNextData = html.includes('__NEXT_DATA__');
      const hasRentalLinks = html.includes('/rental/');
      const hasCaptcha = html.includes('captcha') || html.includes('challenge') || html.includes('cf-browser-verification');
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);

      results.push({
        url: searchUrl,
        status: resp.status,
        htmlLength: html.length,
        title: titleMatch ? titleMatch[1].trim() : null,
        hasJsonLd,
        hasNextData,
        hasRentalLinks,
        hasCaptcha,
        htmlPreview: html.substring(0, 500),
        listingsParsed: parseStreetEasyListings(html).length,
      });
    } catch (e) {
      results.push({ url: searchUrl, error: e.message });
    }
  }

  return { debug: true, results };
}

function isVerifiedRentStabilized(listing) {
  const text = [listing.address, listing.description, listing.title].join(' ').toLowerCase();
  return RS_KEYWORDS.some(kw => text.includes(kw));
}

// ============================================================
// HTML PARSING — multiple strategies for robustness
// ============================================================

function parseStreetEasyListings(html) {
  let listings = [];

  // Strategy 1: JSON-LD structured data (most reliable)
  listings = parseJsonLd(html);
  if (listings.length > 0) return listings;

  // Strategy 2: Embedded application JSON (__NEXT_DATA__ or similar)
  listings = parseEmbeddedJson(html);
  if (listings.length > 0) return listings;

  // Strategy 3: Regex-based HTML card parsing (fallback)
  listings = parseHtmlCards(html);
  return listings;
}

function parseJsonLd(html) {
  const listings = [];
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];

  for (const block of blocks) {
    try {
      const jsonStr = block.replace(/<\/?script[^>]*>/g, '');
      const data = JSON.parse(jsonStr);

      // Handle ItemList (search results page)
      if (data['@type'] === 'ItemList' && data.itemListElement) {
        for (const item of data.itemListElement) {
          const listing = item.item || item;
          const url = listing.url || listing['@id'] || '';
          if (!url) continue;

          const addr = listing.address || {};
          listings.push({
            url: url.startsWith('http') ? url : `https://streeteasy.com${url}`,
            address: addr.streetAddress || listing.name || '',
            borough: addr.addressLocality || '',
            price: extractPrice(listing.offers),
            image: extractImage(listing.image),
            bedrooms: listing.numberOfBedrooms || listing.numberOfRooms || null,
            bathrooms: listing.numberOfBathroomsTotal || null,
            description: listing.description || '',
            title: listing.name || '',
            source: 'streeteasy',
          });
        }
      }

      // Handle single Apartment/Residence listing
      if ((data['@type'] === 'Apartment' || data['@type'] === 'Residence') && data.url) {
        const addr = data.address || {};
        listings.push({
          url: data.url.startsWith('http') ? data.url : `https://streeteasy.com${data.url}`,
          address: addr.streetAddress || data.name || '',
          borough: addr.addressLocality || '',
          price: extractPrice(data.offers),
          image: extractImage(data.image),
          bedrooms: data.numberOfBedrooms || data.numberOfRooms || null,
          bathrooms: data.numberOfBathroomsTotal || null,
          description: data.description || '',
          title: data.name || '',
          source: 'streeteasy',
        });
      }
    } catch (e) { /* skip invalid JSON-LD */ }
  }

  return listings;
}

function parseEmbeddedJson(html) {
  const listings = [];

  // Try __NEXT_DATA__
  const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextMatch) {
    try {
      const data = JSON.parse(nextMatch[1]);
      const props = data.props?.pageProps || {};
      const results = props.listings || props.searchResults?.listings || props.results || [];
      const items = Array.isArray(results) ? results : [];

      for (const item of items) {
        listings.push({
          url: item.url ? `https://streeteasy.com${item.url}` : (item.detailUrl || ''),
          address: item.title || item.address || item.streetAddress || '',
          borough: item.borough || item.area || '',
          price: item.price || item.rent || item.monthlyRent || null,
          image: item.photo || item.image || item.mainPhoto || (item.photos && item.photos[0]) || null,
          bedrooms: item.bedrooms || item.beds || null,
          bathrooms: item.bathrooms || item.baths || null,
          neighborhood: item.neighborhood || item.area || '',
          description: item.description || item.listingDescription || '',
          title: item.title || item.name || '',
          source: 'streeteasy',
        });
      }
    } catch (e) { /* skip */ }
  }

  // Try window.__data__ or similar patterns
  const dataPatterns = [
    /window\.__data__\s*=\s*(\{[\s\S]*?\});/,
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/,
    /data-search-results='(\{[^']+)'/,
  ];

  for (const pattern of dataPatterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const items = data.listings || data.results || data.searchResults || [];
        for (const item of (Array.isArray(items) ? items : [])) {
          if (item.url || item.address || item.title) {
            listings.push({
              url: item.url ? (item.url.startsWith('http') ? item.url : `https://streeteasy.com${item.url}`) : '',
              address: item.address || item.title || '',
              borough: item.borough || '',
              price: item.price || item.rent || null,
              image: item.photo || item.image || null,
              bedrooms: item.bedrooms || item.beds || null,
              bathrooms: item.bathrooms || item.baths || null,
              description: item.description || '',
              title: item.title || item.name || '',
              source: 'streeteasy',
            });
          }
        }
      } catch (e) { /* skip */ }
    }
  }

  return listings;
}

function parseHtmlCards(html) {
  const listings = [];

  // Find all rental listing URLs
  const urlPattern = /href="(\/rental\/\d+[^"]*)"/g;
  const seenUrls = new Set();
  let match;

  while ((match = urlPattern.exec(html)) !== null) {
    const listingPath = match[1];
    if (seenUrls.has(listingPath)) continue;
    seenUrls.add(listingPath);

    // Extract a chunk of HTML around this listing link for context parsing
    const idx = match.index;
    const start = Math.max(0, idx - 3000);
    const end = Math.min(html.length, idx + 3000);
    const ctx = html.substring(start, end);

    const listing = {
      url: `https://streeteasy.com${listingPath}`,
      address: '',
      price: null,
      image: null,
      bedrooms: null,
      bathrooms: null,
      neighborhood: '',
      description: '',
      title: '',
      source: 'streeteasy',
    };

    // Price: find dollar amounts
    const priceMatch = ctx.match(/\$\s*([\d,]+)/);
    if (priceMatch) listing.price = priceMatch[0];

    // Address: look for data attributes, structured elements, or title attributes
    const addrPatterns = [
      /data-address="([^"]+)"/,
      /class="[^"]*(?:listingCard-title|listing-title|address)[^"]*"[^>]*>([^<]+)/i,
      /aria-label="([^"]*\d+[^"]*(?:st|nd|rd|th|ave|street|place|drive|road|blvd|way)[^"]*)"/i,
      /title="([^"]*\d+[^"]*(?:st|nd|rd|th|ave|street|place|drive|road|blvd|way)[^"]*)"/i,
    ];
    for (const p of addrPatterns) {
      const m = ctx.match(p);
      if (m) { listing.address = m[1].trim(); break; }
    }

    // Image: look for listing photos (not logos/icons)
    const imgPatterns = [
      /(?:data-src|src)="(https:\/\/[^"]*(?:images|photos|cdn|media)[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      /(?:data-src|src)="(https:\/\/[^"]*streeteasy[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      /background-image:\s*url\(['"]?(https:\/\/[^'")\s]+\.(?:jpg|jpeg|png|webp)[^'")\s]*)['"]?\)/i,
    ];
    for (const p of imgPatterns) {
      const m = ctx.match(p);
      if (m && !m[1].includes('logo') && !m[1].includes('icon') && !m[1].includes('avatar') && !m[1].includes('sprite')) {
        listing.image = m[1];
        break;
      }
    }

    // Bedrooms
    const brMatch = ctx.match(/(\d+)\s*(?:bed(?:room)?s?|br)\b/i);
    if (brMatch) listing.bedrooms = parseInt(brMatch[1]);

    // Bathrooms
    const baMatch = ctx.match(/([\d.]+)\s*(?:bath(?:room)?s?|ba)\b/i);
    if (baMatch) listing.bathrooms = parseFloat(baMatch[1]);

    // Neighborhood
    const areaMatch = ctx.match(/class="[^"]*(?:area|neighborhood|subtitle|location)[^"]*"[^>]*>\s*([^<]+)/i);
    if (areaMatch) listing.neighborhood = areaMatch[1].trim();

    // Description snippet
    const descMatch = ctx.match(/class="[^"]*(?:description|details-info)[^"]*"[^>]*>\s*([^<]{20,})/i);
    if (descMatch) listing.description = descMatch[1].trim().slice(0, 500);

    if (listing.address || listing.price) {
      listings.push(listing);
    }
  }

  return listings;
}

// ============================================================
// HELPERS
// ============================================================

function extractPrice(offers) {
  if (!offers) return null;
  const price = offers.price || offers.lowPrice || offers.highPrice;
  if (price) return typeof price === 'number' ? `$${price.toLocaleString()}` : `$${price}`;
  return null;
}

function extractImage(image) {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return image[0]?.url || image[0] || null;
  return image.url || image.contentUrl || null;
}

// Backward-compatible photo proxy for specific addresses
async function fetchPhotosForAddress(address, borough) {
  const query = `${address}${borough ? ', ' + borough : ''}, NY`;
  const searchUrl = `https://streeteasy.com/for-rent/nyc?utf8=%E2%9C%93&search=${encodeURIComponent(query)}`;

  const resp = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!resp.ok) return [];
  const html = await resp.text();
  const photos = [];

  const imgPatterns = [
    /property="og:image"\s+content="([^"]+)"/g,
    /data-src="(https:\/\/[^"]*streeteasy[^"]*\/[^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi,
    /src="(https:\/\/[^"]*streeteasy[^"]*\/[^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi,
  ];

  for (const pattern of imgPatterns) {
    let m;
    while ((m = pattern.exec(html)) !== null) {
      const url = m[1];
      if (url && !url.includes('logo') && !url.includes('icon') && !url.includes('avatar') && !photos.includes(url)) {
        photos.push(url);
      }
    }
  }

  return photos.slice(0, 5);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}
