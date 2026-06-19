import { NextResponse } from "next/server";

// --- Load static data at module level (kept in memory between requests) ---

import farmersMarketsData from "@/data/farmers-markets.json";
import greenthumbGardensData from "@/data/greenthumb-gardens.json";
import nycParksData from "@/data/nyc-parks.json";
import librariesData from "@/data/libraries.json";
import donateNycData from "@/data/donatenyc.json";

// repair-cafes-nyc.json may not exist yet — loaded dynamically below

// --- Haversine distance ---

function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// --- Filter helper ---

function filterNearby<T extends { lat: number; lng: number }>(
  items: T[],
  lat: number,
  lng: number,
  radiusMiles: number = 1
): T[] {
  return items.filter(
    (item) => distanceMiles(lat, lng, item.lat, item.lng) <= radiusMiles
  );
}

// --- Main route ---

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");

    if (!latStr || !lngStr) {
      return NextResponse.json(
        { error: "lat and lng query parameters are required" },
        { status: 400 }
      );
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: "lat and lng must be valid numbers" },
        { status: 400 }
      );
    }

    // Load repair cafes dynamically (may not exist yet)
    let repairCafesData: any[] = [];
    try {
      repairCafesData = (await import("@/data/repair-cafes-nyc.json")).default;
    } catch {
      // File doesn't exist yet — return empty array
    }

    // Filter each dataset to items within 1 mile
    const farmersMarkets = filterNearby(farmersMarketsData as any[], lat, lng);
    const gardens = filterNearby(greenthumbGardensData as any[], lat, lng);
    const parks = filterNearby(nycParksData as any[], lat, lng);
    const libraries = filterNearby(librariesData as any[], lat, lng);
    const donateNyc = filterNearby(donateNycData as any[], lat, lng);
    const repairCafes = filterNearby(repairCafesData as any[], lat, lng);

    return NextResponse.json({
      farmersMarkets,
      gardens,
      parks,
      libraries,
      donateNyc,
      repairCafes,
    });
  } catch (error) {
    console.error("Layers API error:", error);
    return NextResponse.json(
      { error: "Failed to load layer data" },
      { status: 500 }
    );
  }
}
