import { NextResponse } from "next/server";
import {
  calculateScore,
  type AmenityResults,
  type TransitStop,
  type BikeLaneSegment,
  type Place,
} from "@/lib/scoring";

// --- Mock amenity data (will be replaced by real data sources in Phase 3/4) ---

const MOCK_TRANSIT_STOPS: TransitStop[] = [
  { name: "Franklin Ave (C)", lat: 40.6706, lng: -73.9579, type: "subway", routes: ["C"], headway_minutes: 8 },
  { name: "Nostrand Ave (A/C)", lat: 40.6699, lng: -73.9505, type: "subway", routes: ["A", "C"], headway_minutes: 6 },
  { name: "Clinton-Washington (C)", lat: 40.6832, lng: -73.9659, type: "subway", routes: ["C"], headway_minutes: 8 },
  { name: "Kingston-Throop (C)", lat: 40.6799, lng: -73.9409, type: "subway", routes: ["C"], headway_minutes: 8 },
  { name: "B65 Bus - Franklin Ave", lat: 40.6720, lng: -73.9582, type: "bus" },
  { name: "B44 Bus - Nostrand Ave", lat: 40.6695, lng: -73.9508, type: "bus" },
  { name: "B48 Bus - Franklin Ave", lat: 40.6735, lng: -73.9577, type: "bus" },
];

const MOCK_BIKE_LANES: BikeLaneSegment[] = [
  { protection_level: "painted", coords: [[-73.958, 40.670], [-73.958, 40.675]] },
  { protection_level: "shared", coords: [[-73.955, 40.668], [-73.960, 40.668]] },
];

const MOCK_BIKE_SHARES: Place[] = [
  { name: "Citi Bike - Franklin Ave & Eastern Pkwy", lat: 40.6710, lng: -73.9585 },
  { name: "Citi Bike - Classon Ave & Lafayette Ave", lat: 40.6890, lng: -73.9600 },
  { name: "Citi Bike - Bedford Ave & Dean St", lat: 40.6800, lng: -73.9530 },
];

const MOCK_GROCERIES: Place[] = [
  { name: "Associated Supermarket", lat: 40.6725, lng: -73.9555 },
  { name: "C-Town Supermarkets", lat: 40.6680, lng: -73.9520 },
];

const MOCK_PHARMACIES: Place[] = [
  { name: "Rite Aid", lat: 40.6730, lng: -73.9560 },
];

const MOCK_CLINICS: Place[] = [
  { name: "SUNY Downstate Urgent Care", lat: 40.6560, lng: -73.9440 },
];

const MOCK_LAUNDROMATS: Place[] = [
  { name: "Crown Heights Laundromat", lat: 40.6700, lng: -73.9590 },
];

const MOCK_THRIFT_STORES: Place[] = [
  { name: "Goodwill - Flatbush", lat: 40.6620, lng: -73.9610 },
];

const MOCK_COMPOST_SITES: Place[] = [];

const MOCK_REFILL_SHOPS: Place[] = [];

const MOCK_COMMUNITY_GARDENS: Place[] = [
  { name: "Hattie Carthan Community Garden", lat: 40.6780, lng: -73.9490 },
  { name: "Jackie Robinson Garden", lat: 40.6750, lng: -73.9530 },
];

const MOCK_COOPS: Place[] = [];

const MOCK_CSA_PICKUPS: Place[] = [
  { name: "Crown Heights CSA", lat: 40.6730, lng: -73.9500 },
];

const MOCK_EV_CHARGING: Place[] = [
  { name: "ChargePoint - Pacific St", lat: 40.6810, lng: -73.9700 },
];

const MOCK_WATER_STATIONS: Place[] = [];

// --- Geocode helper ---

async function geocode(address: string): Promise<{ address: string; lat: number; lng: number } | null> {
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
        { error: "Could not geocode address. Make sure it's a valid NYC address." },
        { status: 404 }
      );
    }

    // Step 2: Gather amenities (mock data for now — Phase 3/4 will replace with real sources)
    // In the future, static data will be filtered by proximity here,
    // and Google Places calls will run in parallel via Promise.all
    const amenities: AmenityResults = {
      transitStops: MOCK_TRANSIT_STOPS,
      bikeLanes: MOCK_BIKE_LANES,
      bikeShares: MOCK_BIKE_SHARES,
      groceries: MOCK_GROCERIES,
      pharmacies: MOCK_PHARMACIES,
      clinics: MOCK_CLINICS,
      laundromats: MOCK_LAUNDROMATS,
      thriftStores: MOCK_THRIFT_STORES,
      compostSites: MOCK_COMPOST_SITES,
      refillShops: MOCK_REFILL_SHOPS,
      communityGardens: MOCK_COMMUNITY_GARDENS,
      coops: MOCK_COOPS,
      csaPickups: MOCK_CSA_PICKUPS,
      evCharging: MOCK_EV_CHARGING,
      waterStations: MOCK_WATER_STATIONS,
    };

    // Step 3: Score
    const scoreResult = calculateScore(amenities);

    // Step 4: Return
    return NextResponse.json({
      address: geo.address,
      lat: geo.lat,
      lng: geo.lng,
      tract: null, // Phase 5: census tract lookup
      score: scoreResult.total,
      breakdown: scoreResult.breakdown,
      amenities,
      equity: null, // Phase 5: equity data lookup
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
