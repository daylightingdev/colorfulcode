import { NextResponse } from "next/server";
import {
  calculateScore,
  filterByDistance,
  filterBikeLanesByDistance,
  type AmenityResults,
  type TransitStop,
  type BikeLaneSegment,
  type Place,
} from "@/lib/scoring";
import { getAllPlacesData } from "@/lib/datasources/google-places";
import { identifyTract, getEquityData } from "@/lib/equity";
import { TTLCache } from "@/lib/cache";

// --- Load static data at module level (kept in memory between requests) ---

import gtfsStops from "@/data/gtfs-stops.json";
import busStops from "@/data/bus-stops.json";
import bikeLanes from "@/data/bike-lanes.json";
import bikeshareDocks from "@/data/bikeshare-docks.json";
import communityGardens from "@/data/community-gardens.json";
import compostingSites from "@/data/composting-sites.json";
import tractScores from "@/data/tract-scores.json";

const TRANSIT_STOPS: TransitStop[] = [
  ...(gtfsStops as TransitStop[]),
  ...(busStops as TransitStop[]),
];
const BIKE_LANES: BikeLaneSegment[] = bikeLanes as BikeLaneSegment[];
const BIKE_SHARES: Place[] = bikeshareDocks as Place[];
const COMMUNITY_GARDENS: Place[] = communityGardens as Place[];
const COMPOST_SITES: Place[] = compostingSites as Place[];

const FIPS_TO_BOROUGH: Record<string, string> = {
  "36047": "Brooklyn",
  "36061": "Manhattan",
  "36081": "Queens",
  "36005": "Bronx",
  "36085": "Staten Island",
};

const TRACT_NEIGHBORHOODS: Record<string, string> = {
  "36047028500": "Prospect Heights",
  "36061005200": "Chelsea",
  "36081014300": "Jackson Heights",
  "36005039800": "Wakefield",
  "36005003800": "Morrisania",
  "36085014200": "St. George",
  "36085016200": "Tompkinsville",
};

function getBoroughFromTract(tract: string): string | null {
  const county = tract.substring(0, 5);
  return FIPS_TO_BOROUGH[county] || null;
}

function getBoroughFromAddress(address: string): string | null {
  const boroughs = ["Brooklyn", "Manhattan", "Queens", "Bronx", "Staten Island"];
  for (const b of boroughs) {
    if (address.includes(b)) return b;
  }
  return null;
}

function getReferenceNeighborhood(borough: string): { name: string; score: number; tract: string } | null {
  const countyCode = Object.entries(FIPS_TO_BOROUGH).find(([, b]) => b === borough)?.[0];
  if (!countyCode) return null;

  const scores = tractScores as Record<string, { score: number; lat: number; lng: number }>;
  let best: { tract: string; score: number } | null = null;

  for (const [tract, data] of Object.entries(scores)) {
    if (tract.startsWith(countyCode) && (!best || data.score > best.score)) {
      best = { tract, score: data.score };
    }
  }

  if (!best) return null;
  const name = TRACT_NEIGHBORHOODS[best.tract] || borough;
  return { name, score: best.score, tract: best.tract };
}

// --- Geocode helper with 30-minute cache ---

const geocodeCache = new TTLCache<{ address: string; lat: number; lng: number }>(1800);

async function geocode(
  address: string
): Promise<{ address: string; lat: number; lng: number } | null> {
  const cacheKey = address.toLowerCase().trim();
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK" || !data.results?.length) return null;

  const result = data.results[0];
  const geo = {
    address: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
  };

  geocodeCache.set(cacheKey, geo);
  return geo;
}

// --- Main route ---

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    // Step 1: Geocode
    const geo = await geocode(address);
    if (!geo) {
      return NextResponse.json(
        {
          error:
            "Could not geocode address. Make sure it's a valid NYC address.",
        },
        { status: 404 }
      );
    }

    const { lat, lng } = geo;

    // Step 2: Filter static data by proximity + fetch Google Places in parallel
    const [placesData] = await Promise.all([
      getAllPlacesData(lat, lng),
    ]);

    const nearbyTransit = filterByDistance(TRANSIT_STOPS, lat, lng, 0.5);
    const nearbyBikeLanes = filterBikeLanesByDistance(BIKE_LANES, lat, lng, 0.25);
    const nearbyBikeShares = filterByDistance(BIKE_SHARES, lat, lng, 0.5);
    const nearbyGardens = filterByDistance(COMMUNITY_GARDENS, lat, lng, 0.5);
    const nearbyCompost = filterByDistance(COMPOST_SITES, lat, lng, 0.5);

    // Step 3: Build amenity results from static data + Google Places
    const amenities: AmenityResults = {
      transitStops: nearbyTransit,
      bikeLanes: nearbyBikeLanes,
      bikeShares: nearbyBikeShares,
      groceries: placesData.groceries,
      pharmacies: placesData.pharmacies,
      clinics: placesData.clinics,
      laundromats: placesData.laundromats,
      thriftStores: placesData.thriftStores,
      compostSites: nearbyCompost,
      refillShops: [],
      communityGardens: nearbyGardens,
      coops: [],
      csaPickups: [],
    };

    // Step 4: Score
    const scoreResult = calculateScore(amenities);

    // Step 5: Identify census tract and look up equity data
    const tract = identifyTract(lat, lng);
    const equity = tract ? getEquityData(tract) : null;

    // Step 6: Borough and reference neighborhood
    const borough =
      (tract ? getBoroughFromTract(tract) : null) ||
      getBoroughFromAddress(geo.address);
    const referenceNeighborhood = borough
      ? getReferenceNeighborhood(borough)
      : null;

    // Step 7: Return
    return NextResponse.json({
      address: geo.address,
      lat: geo.lat,
      lng: geo.lng,
      tract,
      borough,
      score: scoreResult.total,
      breakdown: scoreResult.breakdown,
      amenities,
      equity,
      gaps: scoreResult.gaps,
      referenceNeighborhood,
    });
  } catch (error) {
    console.error("Score API error:", error);
    return NextResponse.json(
      { error: "Failed to calculate score" },
      { status: 500 }
    );
  }
}
