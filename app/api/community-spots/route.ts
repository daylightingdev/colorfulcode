import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("submissions")
      .select(
        "id, name, latitude, longitude, category, description, link, nomination_count, created_at"
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json(
        { error: "Could not load community spots." },
        { status: 500 }
      );
    }

    const geojson = {
      type: "FeatureCollection" as const,
      features: (data || []).map((spot) => ({
        type: "Feature" as const,
        properties: {
          id: spot.id,
          name: spot.name,
          category: spot.category,
          description: spot.description,
          link: spot.link,
          nominationCount: spot.nomination_count,
          isTopPick: spot.nomination_count >= 3,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [spot.longitude, spot.latitude],
        },
      })),
    };

    return NextResponse.json(geojson, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load community spots." },
      { status: 500 }
    );
  }
}
