import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const NYC_BOUNDS = {
  minLat: 40.477,
  maxLat: 40.917,
  minLng: -74.259,
  maxLng: -73.700,
};

function isInNYC(lat: number, lng: number): boolean {
  return (
    lat >= NYC_BOUNDS.minLat &&
    lat <= NYC_BOUNDS.maxLat &&
    lng >= NYC_BOUNDS.minLng &&
    lng <= NYC_BOUNDS.maxLng
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      name,
      latitude,
      longitude,
      category,
      description,
      link,
      email,
      contact_consent,
      publish_consent,
    } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Spot name is required." },
        { status: 400 }
      );
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json(
        { error: "A valid location is required." },
        { status: 400 }
      );
    }

    if (!isInNYC(latitude, longitude)) {
      return NextResponse.json(
        {
          error:
            "This tool covers NYC neighborhoods only. Drop your pin within the five boroughs.",
        },
        { status: 400 }
      );
    }

    if (!category || typeof category !== "string") {
      return NextResponse.json(
        { error: "Please pick a category." },
        { status: 400 }
      );
    }

    if (
      !description ||
      typeof description !== "string" ||
      description.trim().length < 20 ||
      description.trim().length > 600
    ) {
      return NextResponse.json(
        { error: "Your reason should be between 20 and 600 characters." },
        { status: 400 }
      );
    }

    if (!publish_consent) {
      return NextResponse.json(
        { error: "Publishing consent is required to submit." },
        { status: 400 }
      );
    }

    if (contact_consent && (!email || typeof email !== "string")) {
      return NextResponse.json(
        { error: "An email is required if you opt in to contact." },
        { status: 400 }
      );
    }

    const sanitizedName = escapeHtml(name.trim());
    const sanitizedDescription = escapeHtml(description.trim());
    const sanitizedLink =
      link && typeof link === "string" ? escapeHtml(link.trim()) : null;
    const sanitizedEmail =
      email && typeof email === "string" ? email.trim().toLowerCase() : null;

    const supabase = getSupabase();
    let clusterId: string | null = null;

    const { data: nearby } = await supabase.rpc("find_nearby_submissions", {
      search_lat: latitude,
      search_lng: longitude,
      radius_meters: 50,
      search_name: sanitizedName.toLowerCase(),
    });

    if (nearby && nearby.length > 0) {
      clusterId = nearby[0].cluster_id || nearby[0].id;

      await supabase
        .from("submissions")
        .update({
          nomination_count: (nearby[0].nomination_count || 1) + 1,
          cluster_id: clusterId,
        })
        .eq("id", nearby[0].id);
    }

    const { data, error } = await supabase
      .from("submissions")
      .insert({
        name: sanitizedName,
        latitude,
        longitude,
        category,
        description: sanitizedDescription,
        link: sanitizedLink,
        email: sanitizedEmail,
        contact_consent: !!contact_consent,
        publish_consent: true,
        cluster_id: clusterId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Something went wrong saving your suggestion. Try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      clustered: !!clusterId,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
