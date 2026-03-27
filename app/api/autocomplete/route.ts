import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get("input");

  if (!input || input.length < 3) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("Autocomplete: No API key configured");
    return NextResponse.json({ predictions: [] });
  }

  // Try Places API (New) autocomplete first, then fall back to legacy
  const newApiResult = await tryNewPlacesAutocomplete(apiKey, input);
  if (newApiResult !== null) {
    return NextResponse.json({ predictions: newApiResult });
  }

  const legacyResult = await tryLegacyAutocomplete(apiKey, input);
  return NextResponse.json({ predictions: legacyResult });
}

// Places API (New) — uses POST with X-Goog-Api-Key header
async function tryNewPlacesAutocomplete(
  apiKey: string,
  input: string
): Promise<Array<{ description: string; place_id: string }> | null> {
  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({
          input,
          includedRegionCodes: ["us"],
          locationBias: {
            circle: {
              center: { latitude: 40.7128, longitude: -74.006 },
              radius: 50000,
            },
          },
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.suggestions?.length) return [];

    return data.suggestions
      .filter(
        (s: { placePrediction?: { text?: { text: string } } }) =>
          s.placePrediction?.text?.text
      )
      .map(
        (s: {
          placePrediction: {
            text: { text: string };
            placeId?: string;
            place?: string;
          };
        }) => ({
          description: s.placePrediction.text.text,
          place_id:
            s.placePrediction.placeId ||
            s.placePrediction.place?.replace("places/", "") ||
            "",
        })
      );
  } catch {
    return null;
  }
}

// Legacy Places API — uses GET with key query param
async function tryLegacyAutocomplete(
  apiKey: string,
  input: string
): Promise<Array<{ description: string; place_id: string }>> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      input
    )}&types=address&components=country:us&location=40.7128,-74.0060&radius=50000&strictbounds=true&key=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error(
        "Legacy autocomplete error:",
        data.status,
        data.error_message
      );
      return [];
    }

    return (data.predictions || []).map(
      (p: { description: string; place_id: string }) => ({
        description: p.description,
        place_id: p.place_id,
      })
    );
  } catch (error) {
    console.error("Legacy autocomplete error:", error);
    return [];
  }
}
