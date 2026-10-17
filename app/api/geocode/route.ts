import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Geocoding API key not configured" },
        { status: 500 }
      );
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" || !data.results?.length) {
      return NextResponse.json(
        { error: "Address not found", status: data.status },
        { status: 404 }
      );
    }

    const result = data.results[0];
    const { lat, lng } = result.geometry.location;

    return NextResponse.json({
      address: result.formatted_address,
      lat,
      lng,
    });
  } catch (error) {
    console.error("Geocode error:", error);
    return NextResponse.json(
      { error: "Failed to geocode address" },
      { status: 500 }
    );
  }
}
