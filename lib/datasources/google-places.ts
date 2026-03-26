/**
 * Google Places API (New) v1 — server-side only
 * Uses POST to places:searchNearby with X-Goog-Api-Key header
 */

interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
  type: string;
}

interface NearbySearchResponse {
  places?: Array<{
    displayName?: { text: string };
    location?: { latitude: number; longitude: number };
    primaryType?: string;
    types?: string[];
  }>;
}

const API_BASE = "https://places.googleapis.com/v1/places:searchNearby";

async function searchNearby(
  lat: number,
  lng: number,
  includedTypes: string[],
  radiusMeters: number,
  maxResults: number = 10
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn("No Google Places/Maps API key configured");
    return [];
  }

  const body = {
    includedTypes,
    maxResultCount: maxResults,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusMeters,
      },
    },
  };

  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.location,places.primaryType,places.types",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`Places API error: ${res.status} ${res.statusText}`);
    return [];
  }

  const data: NearbySearchResponse = await res.json();

  return (data.places || []).map((p) => ({
    name: p.displayName?.text || "Unknown",
    lat: p.location?.latitude || 0,
    lng: p.location?.longitude || 0,
    type: p.primaryType || "",
  }));
}

// --- Category-specific search functions ---

export async function getNearbyGroceries(
  lat: number,
  lng: number
): Promise<PlaceResult[]> {
  const results = await searchNearby(
    lat,
    lng,
    ["supermarket", "grocery_store"],
    1200, // ~0.75 miles
    15
  );
  // Filter out convenience stores that sneak in
  return results.filter((r) => r.type !== "convenience_store");
}

export async function getNearbyPharmacies(
  lat: number,
  lng: number
): Promise<PlaceResult[]> {
  return searchNearby(lat, lng, ["pharmacy"], 1200, 10);
}

export async function getNearbyClinics(
  lat: number,
  lng: number
): Promise<PlaceResult[]> {
  return searchNearby(
    lat,
    lng,
    ["hospital", "doctor", "medical_lab"],
    1600 // ~1 mile
  );
}

export async function getNearbyLaundromats(
  lat: number,
  lng: number
): Promise<PlaceResult[]> {
  return searchNearby(lat, lng, ["laundry"], 1200, 10);
}

export async function getNearbyThriftStores(
  lat: number,
  lng: number
): Promise<PlaceResult[]> {
  return searchNearby(
    lat,
    lng,
    ["second_hand_store", "clothing_store"],
    1200
  );
}

export async function getNearbyEVCharging(
  lat: number,
  lng: number
): Promise<PlaceResult[]> {
  return searchNearby(
    lat,
    lng,
    ["electric_vehicle_charging_station"],
    1200
  );
}

/**
 * Fetch all Google Places categories in parallel
 */
export async function getAllPlacesData(
  lat: number,
  lng: number
): Promise<{
  groceries: PlaceResult[];
  pharmacies: PlaceResult[];
  clinics: PlaceResult[];
  laundromats: PlaceResult[];
  thriftStores: PlaceResult[];
  evCharging: PlaceResult[];
}> {
  const [groceries, pharmacies, clinics, laundromats, thriftStores, evCharging] =
    await Promise.all([
      getNearbyGroceries(lat, lng),
      getNearbyPharmacies(lat, lng),
      getNearbyClinics(lat, lng),
      getNearbyLaundromats(lat, lng),
      getNearbyThriftStores(lat, lng),
      getNearbyEVCharging(lat, lng),
    ]);

  return { groceries, pharmacies, clinics, laundromats, thriftStores, evCharging };
}
