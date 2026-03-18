// StableNYC Photo Proxy — Cloudflare Worker (free tier)
// Fetches StreetEasy search results and extracts listing photo URLs
// Deploy: cd worker && npx wrangler deploy

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const address = url.searchParams.get('address');
    const borough = url.searchParams.get('borough');

    if (!address) {
      return jsonResponse({ error: 'Missing address parameter' }, 400);
    }

    try {
      const photos = await fetchStreetEasyPhotos(address, borough);
      return jsonResponse({ photos, address, borough });
    } catch (err) {
      return jsonResponse({ error: err.message, photos: [] }, 500);
    }
  },
};

async function fetchStreetEasyPhotos(address, borough) {
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

  // Extract listing image URLs from StreetEasy search results HTML
  // StreetEasy uses data-src or src attributes on listing images
  const imgPatterns = [
    // og:image meta tag
    /property="og:image"\s+content="([^"]+)"/g,
    // Listing card images — various patterns
    /data-src="(https:\/\/[^"]*streeteasy[^"]*\/[^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi,
    /src="(https:\/\/[^"]*streeteasy[^"]*\/[^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi,
    // Image URLs in data attributes
    /data-original="(https:\/\/[^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi,
    // Background images
    /background-image:\s*url\(['"]?(https:\/\/[^'")\s]+\.(jpg|jpeg|png|webp)[^'")\s]*)['"]?\)/gi,
    // img tags with photo content
    /img[^>]+src="(https:\/\/image[^"]+)"/gi,
  ];

  for (const pattern of imgPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const photoUrl = match[1];
      if (photoUrl &&
          !photoUrl.includes('logo') &&
          !photoUrl.includes('icon') &&
          !photoUrl.includes('avatar') &&
          !photoUrl.includes('sprite') &&
          !photoUrl.includes('1x1') &&
          !photos.includes(photoUrl)) {
        photos.push(photoUrl);
      }
    }
  }

  // Also try to find JSON-LD structured data with images
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const jsonStr = block.replace(/<\/?script[^>]*>/g, '');
        const data = JSON.parse(jsonStr);
        if (data.image) {
          const images = Array.isArray(data.image) ? data.image : [data.image];
          for (const img of images) {
            const imgUrl = typeof img === 'string' ? img : img.url;
            if (imgUrl && !photos.includes(imgUrl)) photos.push(imgUrl);
          }
        }
      } catch (e) { /* skip invalid JSON-LD */ }
    }
  }

  return photos.slice(0, 5); // Return up to 5 photos
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
