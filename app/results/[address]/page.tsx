"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import mapboxgl from "mapbox-gl";
import { CATEGORY_META, type ScoreResult } from "@/lib/mock-data";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

function getScoreLabel(score: number) {
  if (score >= 75) return { text: "Excellent investment", color: "text-emerald-700" };
  if (score >= 50) return { text: "Moderate investment", color: "text-yellow-600" };
  if (score >= 25) return { text: "Limited investment", color: "text-orange-600" };
  return { text: "Severely underserved", color: "text-red-600" };
}

function getScoreColor(score: number) {
  if (score >= 75) return "#059669";
  if (score >= 50) return "#f59e0b";
  if (score >= 25) return "#f97316";
  return "#ef4444";
}

const AMENITY_COLORS: Record<string, string> = {
  transitStops: "#3b82f6",
  bikeLanes: "#8b5cf6",
  bikeShares: "#a78bfa",
  groceries: "#f59e0b",
  pharmacies: "#fbbf24",
  clinics: "#f97316",
  laundromats: "#fb923c",
  thriftStores: "#10b981",
  compostSites: "#34d399",
  refillShops: "#6ee7b7",
  communityGardens: "#ef4444",
  coops: "#f87171",
  csaPickups: "#fca5a5",
  evCharging: "#06b6d4",
  waterStations: "#22d3ee",
};

const AMENITY_LABELS: Record<string, string> = {
  transitStops: "Transit Stops",
  bikeShares: "Bike Share Docks",
  groceries: "Grocery Stores",
  pharmacies: "Pharmacies",
  clinics: "Clinics",
  laundromats: "Laundromats",
  thriftStores: "Thrift Stores",
  compostSites: "Compost Sites",
  communityGardens: "Community Gardens",
  coops: "Food Co-ops",
  csaPickups: "CSA Pickups",
  evCharging: "EV Charging",
  waterStations: "Water Stations",
};

function ScoreHeader({ result }: { result: ScoreResult }) {
  const label = getScoreLabel(result.score);
  return (
    <div className="text-center py-10">
      <p className="text-sm text-gray-500 mb-2 uppercase tracking-wide">
        Low Carbon Access Score
      </p>
      <div
        className="text-8xl font-bold mb-3"
        style={{ color: getScoreColor(result.score) }}
      >
        {result.score}
      </div>
      <p className={`text-xl font-medium ${label.color}`}>{label.text}</p>
      <p className="text-gray-500 mt-1">{result.address}</p>
    </div>
  );
}

function CategoryBreakdown({ breakdown }: { breakdown: ScoreResult["breakdown"] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-4">Category Breakdown</h2>
      <div className="space-y-4">
        {Object.entries(breakdown).map(([key, value]) => {
          const meta = CATEGORY_META[key];
          if (!meta) return null;
          const pct = (value / meta.max) * 100;
          return (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{meta.label}</span>
                <span className="text-gray-500">
                  {value} / {meta.max}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: meta.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AmenityMap({ result }: { result: ScoreResult }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    new Set(Object.keys(AMENITY_LABELS))
  );

  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [result.lng, result.lat],
      zoom: 14,
    });

    map.current = m;

    m.on("load", () => {
      // Address marker
      new mapboxgl.Marker({ color: "#000" })
        .setLngLat([result.lng, result.lat])
        .setPopup(new mapboxgl.Popup().setText(result.address))
        .addTo(m);

      // Amenity markers
      const amenities = result.amenities as unknown as Record<string, Array<{ name: string; lat: number; lng: number }>>;
      for (const [category, items] of Object.entries(amenities)) {
        if (category === "bikeLanes") continue;
        const color = AMENITY_COLORS[category] || "#888";
        for (const item of items) {
          const marker = new mapboxgl.Marker({ color, scale: 0.7 })
            .setLngLat([item.lng, item.lat])
            .setPopup(
              new mapboxgl.Popup({ offset: 25 }).setHTML(
                `<strong>${item.name}</strong><br/><span style="color:${color}">${AMENITY_LABELS[category] || category}</span>`
              )
            )
            .addTo(m);
          marker.getElement().dataset.category = category;
        }
      }

      // Draw 0.5mi radius circle for gaps
      const radiusKm = 0.8047; // 0.5 miles
      const points = 64;
      const coords: [number, number][] = [];
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        const dx = radiusKm * Math.cos(angle);
        const dy = radiusKm * Math.sin(angle);
        const lat = result.lat + (dy / 111.32);
        const lng = result.lng + (dx / (111.32 * Math.cos((result.lat * Math.PI) / 180)));
        coords.push([lng, lat]);
      }

      m.addSource("radius", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [coords] },
        },
      });

      m.addLayer({
        id: "radius-line",
        type: "line",
        source: "radius",
        paint: {
          "line-color": "#9ca3af",
          "line-dasharray": [4, 4],
          "line-width": 1.5,
        },
      });
    });

    return () => m.remove();
  }, [result]);

  // Toggle layer visibility
  useEffect(() => {
    if (!map.current) return;
    const markers = map.current.getContainer().querySelectorAll(".mapboxgl-marker");
    markers.forEach((el) => {
      const cat = (el as HTMLElement).dataset.category;
      if (cat) {
        (el as HTMLElement).style.display = visibleLayers.has(cat) ? "" : "none";
      }
    });
  }, [visibleLayers]);

  function toggleLayer(key: string) {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold mb-3">Nearby Infrastructure</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(AMENITY_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleLayer(key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                visibleLayers.has(key)
                  ? "border-transparent text-white"
                  : "border-gray-300 text-gray-400 bg-white"
              }`}
              style={
                visibleLayers.has(key)
                  ? { backgroundColor: AMENITY_COLORS[key] }
                  : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {MAPBOX_TOKEN ? (
        <div ref={mapContainer} className="h-[450px] w-full" />
      ) : (
        <div className="h-[450px] w-full flex items-center justify-center bg-gray-100 text-gray-400">
          Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the map
        </div>
      )}
    </div>
  );
}

function EquityPanel({ equity }: { equity: ScoreResult["equity"] }) {
  const incomePct = Math.round(
    (equity.median_income / equity.nyc_median_income) * 100
  );
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">Equity Context</h2>
      <p className="text-sm text-gray-500 mb-4">
        What this score means in context.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Median Household Income</p>
          <p className="text-2xl font-bold">
            ${equity.median_income.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">
            {incomePct}% of NYC median (${equity.nyc_median_income.toLocaleString()})
          </p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Displacement Risk</p>
          <p className="text-2xl font-bold capitalize">{equity.displacement_risk}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Rent Burden</p>
          <p className="text-2xl font-bold">{equity.rent_burden_pct}%</p>
          <p className="text-sm text-gray-500">
            of households paying &gt;30% of income on rent
          </p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">% White Population</p>
          <p className="text-2xl font-bold">{equity.pct_white}%</p>
        </div>
      </div>
    </div>
  );
}

function GapList({ gaps }: { gaps: string[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">Infrastructure Gaps</h2>
      <p className="text-sm text-gray-500 mb-4">
        What&apos;s missing and where the city could invest.
      </p>
      {gaps.length === 0 ? (
        <p className="text-gray-400">No major gaps identified.</p>
      ) : (
        <ul className="space-y-2">
          {gaps.map((gap, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="text-red-500 mt-0.5">●</span>
              <span>{gap}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 pt-4 border-t border-gray-100 text-sm text-gray-500">
        <p>
          Report infrastructure needs via{" "}
          <a
            href="https://portal.311.nyc.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 underline"
          >
            NYC 311
          </a>
          . View the{" "}
          <Link href="/map" className="text-emerald-600 underline">
            citywide gap map
          </Link>{" "}
          to see how your neighborhood compares.
        </p>
      </div>
    </div>
  );
}

export default function ResultsPage({
  params,
}: {
  params: { address: string };
}) {
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const address = decodeURIComponent(params.address);
    fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch score");
        }
        return res.json();
      })
      .then((data) => setResult(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.address]);

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="font-semibold text-gray-900">
            Low Carbon Access Score
          </Link>
          <Link href="/map" className="text-sm text-gray-500 hover:text-gray-900">
            Gap Map
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="mt-4 text-gray-500">Calculating score...</p>
          </div>
        )}
        {error && (
          <div className="text-center py-20">
            <p className="text-red-500 text-lg font-medium">{error}</p>
            <Link href="/" className="text-emerald-600 underline mt-2 inline-block">
              Try another address
            </Link>
          </div>
        )}
        {result && (
          <>
            <ScoreHeader result={result} />
            <CategoryBreakdown breakdown={result.breakdown} />
            <AmenityMap result={result} />
            {result.equity && <EquityPanel equity={result.equity} />}
            <GapList gaps={result.gaps} />
          </>
        )}
      </div>
    </main>
  );
}
