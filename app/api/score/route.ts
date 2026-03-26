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

// --- Load static data at module level (kept in memory between requests) ---

import gtfsStops from "@/data/gtfs-stops.json";
import bikeLanes from "@/data/bike-lanes.json";
import bikeshareDocks from "@/data/bikeshare-docks.json";
import communityGardens from "@/data/community-gardens.json";
import compostingSites from "@/data/composting-sites.json";

const TRANSIT_STOPS: TransitStop[] = gtfsStops as TransitStop[];
const BIKE_LANES: BikeLaneSegment[] = bikeLanes as BikeLaneSegment[];
const BIKE_SHARES: Place[] = bikeshareDocks as Place[];
const COMMUNITY_GARDENS: Place[] = communityGardens as Place[];
const COMPOST_SITES: Place[] = compostingSites as Place[];

// --- Geocode helper ---

async function geocode(
  address: string
): Promise<{ address: string; lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK" || !data.results?.length) return null;

  const result = data.results[0];
  return {
    address: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
  };
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
      refillShops: [],     // Rare category — hard to find via Places API types
      communityGardens: nearbyGardens,
      coops: [],           // Not a standard Places type
      csaPickups: [],      // Not a standard Places type
      evCharging: placesData.evCharging,
      waterStations: [],   // Not a standard Places type
    };

    // Step 4: Score
    const scoreResult = calculateScore(amenities);

    // Step 5: Identify census tract and look up equity data
    const tract = identifyTract(lat, lng);
    const equity = tract ? getEquityData(tract) : null;

    // Step 6: Return
    return NextResponse.json({
      address: geo.address,
      lat: geo.lat,
      lng: geo.lng,
      tract,
      score: scoreResult.total,
      breakdown: scoreResult.breakdown,
      amenities,
      equity,
      gaps: scoreResult.gaps,
    });
  } catch (error) {
    console.error("Score API error:", error);
    return NextResponse.json(
      { error: "Failed to calculate score" },
      { status: 500 }
    );
  }
}
