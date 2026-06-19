"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import mapboxgl from "mapbox-gl";
import { CATEGORY_META, type ScoreResult } from "@/lib/mock-data";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

function getScoreLabel(score: number) {
  if (score >= 75) return { text: "Excellent", color: "text-emerald-700" };
  if (score >= 50) return { text: "Moderate", color: "text-yellow-600" };
  if (score >= 25) return { text: "Limited", color: "text-orange-600" };
  return { text: "Severely underserved", color: "text-red-600" };
}

function getScoreColor(score: number) {
  if (score >= 75) return "#059669";
  if (score >= 50) return "#f59e0b";
  if (score >= 25) return "#f97316";
  return "#ef4444";
}

const AMENITY_COLORS: Record<string, string> = {
  transitStops: "#4a6fa5",
  bikeLanes: "#57a773",
  bikeShares: "#6dbe8b",
  groceries: "#e08b4a",
  pharmacies: "#e9a36a",
  clinics: "#d47840",
  laundromats: "#eba86e",
  thriftStores: "#2a9d8f",
  compostSites: "#3db8a9",
  refillShops: "#5ec4b6",
  communityGardens: "#c46a3f",
  coops: "#d4845f",
  csaPickups: "#dea07f",
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
};

const LAYER_COLORS: Record<string, string> = {
  farmersMarkets: "#8B5E3C",
  gardens: "#2D6A4F",
  parks: "#52B788",
  libraries: "#7B2D8E",
  donateNyc: "#E07B39",
  repairCafes: "#D4A017",
};

const LAYER_LABELS: Record<string, string> = {
  farmersMarkets: "Farmers Markets",
  gardens: "Community Gardens",
  parks: "Parks",
  libraries: "Libraries",
  donateNyc: "Donation Centers",
  repairCafes: "Repair Cafes",
};

// --- Amenity Summary ---

const AMENITY_SUMMARY_CATEGORIES = [
  {
    key: "transit",
    label: "Transit",
    color: "#4a6fa5",
    amenityKeys: ["transitStops"],
    description: (counts: Record<string, number>) => {
      const total = counts.transitStops || 0;
      if (total === 0) return "No transit stops within walking distance.";
      return `${total} transit stop${total > 1 ? "s" : ""} within walking distance.`;
    },
  },
  {
    key: "activeMobility",
    label: "Active Mobility",
    color: "#57a773",
    amenityKeys: ["bikeShares"],
    description: (counts: Record<string, number>) => {
      const docks = counts.bikeShares || 0;
      if (docks === 0) return "No bike share docks nearby.";
      return `${docks} bike share dock${docks > 1 ? "s" : ""} nearby.`;
    },
  },
  {
    key: "dailyNeeds",
    label: "Daily Needs",
    color: "#e08b4a",
    amenityKeys: ["groceries", "pharmacies", "clinics", "laundromats"],
    description: (counts: Record<string, number>) => {
      const parts: string[] = [];
      if (counts.groceries) parts.push(`${counts.groceries} grocer${counts.groceries > 1 ? "ies" : "y"}`);
      if (counts.pharmacies) parts.push(`${counts.pharmacies} pharmac${counts.pharmacies > 1 ? "ies" : "y"}`);
      if (counts.clinics) parts.push(`${counts.clinics} clinic${counts.clinics > 1 ? "s" : ""}`);
      if (counts.laundromats) parts.push(`${counts.laundromats} laundromat${counts.laundromats > 1 ? "s" : ""}`);
      if (parts.length === 0) return "No daily-needs amenities found nearby.";
      return parts.join(", ") + " within walking distance.";
    },
  },
  {
    key: "circularEconomy",
    label: "Circular Economy",
    color: "#2a9d8f",
    amenityKeys: ["thriftStores", "compostSites", "refillShops"],
    description: (counts: Record<string, number>) => {
      const parts: string[] = [];
      if (counts.thriftStores) parts.push(`${counts.thriftStores} thrift store${counts.thriftStores > 1 ? "s" : ""}`);
      if (counts.compostSites) parts.push(`${counts.compostSites} compost site${counts.compostSites > 1 ? "s" : ""}`);
      if (counts.refillShops) parts.push(`${counts.refillShops} refill shop${counts.refillShops > 1 ? "s" : ""}`);
      if (parts.length === 0) return "No reuse or composting options found nearby.";
      return parts.join(", ") + " nearby.";
    },
  },
  {
    key: "localFood",
    label: "Local Food",
    color: "#c46a3f",
    amenityKeys: ["communityGardens", "coops", "csaPickups"],
    description: (counts: Record<string, number>) => {
      const parts: string[] = [];
      if (counts.communityGardens) parts.push(`${counts.communityGardens} community garden${counts.communityGardens > 1 ? "s" : ""}`);
      if (counts.coops) parts.push(`${counts.coops} food co-op${counts.coops > 1 ? "s" : ""}`);
      if (counts.csaPickups) parts.push(`${counts.csaPickups} CSA pickup${counts.csaPickups > 1 ? "s" : ""}`);
      if (parts.length === 0) return "No local food infrastructure found nearby.";
      return parts.join(", ") + " nearby.";
    },
  },
];

function AmenitySummary({ amenities }: { amenities: ScoreResult["amenities"] }) {
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(amenities)) {
    if (Array.isArray(value)) counts[key] = value.length;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">What&apos;s nearby</h2>
      <p className="text-sm text-gray-500 mb-4">
        Places that make it easier to live lightly, within walking distance.
      </p>
      <div className="space-y-3">
        {AMENITY_SUMMARY_CATEGORIES.map((cat) => {
          const total = cat.amenityKeys.reduce((sum, k) => sum + (counts[k] || 0), 0);
          return (
            <div key={cat.key} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
              <div
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{cat.label}</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: total > 0 ? cat.color : "#9ca3af" }}
                  >
                    {total}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{cat.description(counts)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Score Section ---

function ScoreSection({ result }: { result: ScoreResult }) {
  const label = getScoreLabel(result.score);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-1 uppercase tracking-wide">
          Neighborhood Score
        </p>
        <div
          className="text-7xl font-bold mb-2"
          style={{ color: getScoreColor(result.score) }}
        >
          {result.score}
        </div>
        <p className={`text-lg font-medium ${label.color}`}>{label.text}</p>
        <p className="text-gray-500 text-sm mt-1">{result.address}</p>
        <ScoreNarrative result={result} />
      </div>
    </div>
  );
}

function ScoreNarrative({ result }: { result: ScoreResult }) {
  const parts: string[] = [];
  const a = result.amenities;

  const subways = a?.transitStops?.filter((s: { type?: string }) => s.type === "subway") || [];
  const transitCount = a?.transitStops?.length || 0;
  if (subways.length > 0) {
    parts.push(`${subways.length} subway station${subways.length > 1 ? "s" : ""}`);
  } else if (transitCount > 0) {
    parts.push(`${transitCount} transit stop${transitCount > 1 ? "s" : ""}`);
  }

  const bikeShares = a?.bikeShares?.length || 0;
  if (bikeShares > 0) parts.push(`${bikeShares} bike share dock${bikeShares > 1 ? "s" : ""}`);

  const groceries = a?.groceries?.length || 0;
  if (groceries > 0) parts.push(`${groceries} grocery store${groceries > 1 ? "s" : ""}`);

  const gardens = a?.communityGardens?.length || 0;
  if (gardens > 0) parts.push(`${gardens} community garden${gardens > 1 ? "s" : ""}`);

  const compost = a?.compostSites?.length || 0;
  if (compost > 0) parts.push(`a composting drop-off`);

  if (parts.length === 0) {
    return (
      <p className="text-gray-500 mt-4 max-w-lg mx-auto text-sm leading-relaxed">
        This area has limited planet-friendly infrastructure right now. Every
        neighborhood deserves access to sustainable options, and knowing the
        gaps is the first step toward change.
      </p>
    );
  }

  const listed = parts.length <= 2
    ? parts.join(" and ")
    : parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];

  return (
    <p className="text-gray-600 mt-4 max-w-lg mx-auto text-sm leading-relaxed">
      Your neighborhood has {listed} within walking distance — a foundation
      for living lightly. The score reflects both what&apos;s already here
      and where there&apos;s room to grow.
    </p>
  );
}

// --- Category Breakdown ---

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

// --- Reference Neighborhood ---

function ReferenceNeighborhood({
  result,
}: {
  result: ScoreResult;
}) {
  if (!result.referenceNeighborhood || !result.borough) return null;

  const ref = result.referenceNeighborhood;
  const diff = ref.score - result.score;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">How you compare</h2>
      <p className="text-sm text-gray-500 mb-4">
        The highest-scoring neighborhood in {result.borough}.
      </p>
      <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <p className="text-sm text-gray-500">Your neighborhood</p>
          <p className="text-3xl font-bold" style={{ color: getScoreColor(result.score) }}>
            {result.score}
          </p>
        </div>
        <div className="text-gray-300 text-2xl">vs</div>
        <div className="flex-1 text-right">
          <p className="text-sm text-gray-500">{ref.name}</p>
          <p className="text-3xl font-bold" style={{ color: getScoreColor(ref.score) }}>
            {ref.score}
          </p>
        </div>
      </div>
      {diff > 0 && (
        <p className="text-sm text-gray-500 mt-3">
          {ref.name} scores {diff} point{diff !== 1 ? "s" : ""} higher — see the{" "}
          <Link href="/map" className="text-emerald-600 underline">gap map</Link> to
          explore what makes the difference.
        </p>
      )}
    </div>
  );
}

// --- Amenity Map ---

function AmenityMap({ result, layers }: { result: ScoreResult; layers: any | null }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    new Set([...Object.keys(AMENITY_LABELS), ...Object.keys(LAYER_LABELS)])
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
      const gmapsLink = (item: { name?: string; address?: string; lat: number; lng: number }) => {
        const query = item.name && item.address
          ? `${item.name}, ${item.address}`
          : item.name || item.address || `${item.lat},${item.lng}`;
        return `<br/><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer" style="color:#1a73e8;font-size:12px;">View on Google Maps</a>`;
      };

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
                `<strong>${item.name}</strong><br/><span style="color:${color}">${AMENITY_LABELS[category] || category}</span>${gmapsLink(item)}`
              )
            )
            .addTo(m);
          marker.getElement().dataset.category = category;
        }
      }

      // Draw 0.5mi radius circle
      const radiusKm = 0.8047;
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

      const labelLat = result.lat + (radiusKm / 111.32);
      m.addSource("radius-label", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { label: "0.5 mi radius" },
          geometry: { type: "Point", coordinates: [result.lng, labelLat] },
        },
      });
      m.addLayer({
        id: "radius-label-text",
        type: "symbol",
        source: "radius-label",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-offset": [0, -0.8],
          "text-anchor": "bottom",
        },
        paint: {
          "text-color": "#9ca3af",
          "text-halo-color": "#fff",
          "text-halo-width": 1.5,
        },
      });

      // Additional layer markers
      if (layers) {
        const addLayerMarkers = (
          items: any[],
          categoryKey: string,
          popupFn: (item: any) => string
        ) => {
          const color = LAYER_COLORS[categoryKey] || "#888";
          for (const item of items) {
            if (item.lat == null || item.lng == null) continue;
            const marker = new mapboxgl.Marker({ color, scale: 0.7 })
              .setLngLat([item.lng, item.lat])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 }).setHTML(popupFn(item))
              )
              .addTo(m);
            marker.getElement().dataset.category = categoryKey;
          }
        };

        addLayerMarkers(
          layers.farmersMarkets || [],
          "farmersMarkets",
          (item) => {
            let html = `<strong>${item.name || "Farmers Market"}</strong>`;
            if (item.daysHours) html += `<br/>${item.daysHours}`;
            if (item.days) html += `<br/>${item.days}`;
            if (item.hours) html += `<br/>${item.hours}`;
            if (item.acceptsEBT)
              html += `<br/><span style="background:#059669;color:#fff;padding:1px 6px;border-radius:4px;font-size:11px;">Accepts EBT</span>`;
            html += `<br/><span style="color:${LAYER_COLORS.farmersMarkets}">Farmers Market</span>`;
            html += gmapsLink(item);
            return html;
          }
        );

        addLayerMarkers(layers.gardens || [], "gardens", (item) => {
          let html = `<strong>${item.name || "Community Garden"}</strong>`;
          if (item.address) html += `<br/>${item.address}`;
          html += `<br/><span style="color:${LAYER_COLORS.gardens}">Community Garden</span>`;
          html += gmapsLink(item);
          return html;
        });

        addLayerMarkers(layers.parks || [], "parks", (item) => {
          let html = `<strong>${item.name || "Park"}</strong>`;
          if (item.type) html += `<br/>Type: ${item.type}`;
          if (item.acres) html += `<br/>${item.acres} acres`;
          html += `<br/><span style="color:${LAYER_COLORS.parks}">Park</span>`;
          html += gmapsLink(item);
          return html;
        });

        addLayerMarkers(layers.libraries || [], "libraries", (item) => {
          let html = `<strong>${item.name || "Library"}</strong>`;
          if (item.system) html += `<br/>${item.system}`;
          if (item.address) html += `<br/>${item.address}`;
          html += `<br/><span style="color:${LAYER_COLORS.libraries}">Library</span>`;
          html += gmapsLink(item);
          return html;
        });

        addLayerMarkers(layers.donateNyc || [], "donateNyc", (item) => {
          let html = `<strong>${item.name || "Donation Center"}</strong>`;
          if (item.categories) html += `<br/>Accepts: ${item.categories}`;
          if (item.hours) html += `<br/>${item.hours}`;
          html += `<br/><span style="color:${LAYER_COLORS.donateNyc}">Donation Center</span>`;
          html += gmapsLink(item);
          return html;
        });

        addLayerMarkers(layers.repairCafes || [], "repairCafes", (item) => {
          let html = `<strong>${item.name || "Repair Cafe"}</strong>`;
          if (item.address) html += `<br/>${item.address}`;
          html += `<br/><span style="color:${LAYER_COLORS.repairCafes}">Repair Cafe</span>`;
          html += gmapsLink(item);
          return html;
        });
      }
    });

    return () => m.remove();
  }, [result, layers]);

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
        <h2 className="text-lg font-semibold mb-3">Your neighborhood map</h2>
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
        {layers && (
          <>
            <p className="text-xs text-gray-400 mt-3 mb-1 uppercase tracking-wide font-medium">
              Community Resources
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(LAYER_LABELS).map(([key, label]) => (
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
                      ? { backgroundColor: LAYER_COLORS[key] }
                      : undefined
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
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

// --- Equity Panel ---

function EquityPanel({ equity }: { equity: ScoreResult["equity"] }) {
  const incomePct = Math.round(
    (equity.median_income / equity.nyc_median_income) * 100
  );
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">Equity context</h2>
      <p className="text-sm text-gray-500 mb-4">
        Who lives here matters. Scores mean different things in different communities.
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

// --- Gap List ---

function GapList({ gaps }: { gaps: string[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">What&apos;s missing</h2>
      <p className="text-sm text-gray-500 mb-4">
        Infrastructure gaps that keep this neighborhood from scoring higher.
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

// --- Policy Section ---

interface Initiative {
  title: string;
  description: string;
  timeline: string;
  matchesGap: (gap: string) => boolean;
}

const INITIATIVES: Initiative[] = [
  {
    title: "NYC Streets Plan — Protected Bike Lanes Expansion",
    description:
      "The city is required to build 250 miles of protected bike lanes by 2026 under the Streets Plan law, with a focus on high-injury corridors and transit deserts.",
    timeline: "Ongoing through 2026",
    matchesGap: (g) => /bike lane/i.test(g),
  },
  {
    title: "Curbside Composting — Citywide Rollout",
    description:
      "DSNY's curbside composting program is expanding borough by borough. All five boroughs now have curbside food scrap collection.",
    timeline: "Citywide",
    matchesGap: (g) => /compost/i.test(g),
  },
  {
    title: "MTA Fast Forward Plan — Subway Accessibility & Frequency",
    description:
      "The MTA's capital plan includes signal modernization on key lines, bus network redesigns, and new ADA-accessible stations to improve transit frequency and coverage.",
    timeline: "Through 2029",
    matchesGap: (g) => /subway|bus|transit/i.test(g),
  },
  {
    title: "FRESH Program — Grocery Store Incentives",
    description:
      "The Food Retail Expansion to Support Health (FRESH) program offers tax incentives and zoning flexibility to attract grocery stores to underserved neighborhoods.",
    timeline: "Ongoing",
    matchesGap: (g) => /grocery/i.test(g),
  },
  {
    title: "Community Health Center Expansion",
    description:
      "NYC Health + Hospitals is expanding Federally Qualified Health Centers in underserved areas, with several new sites planned in Brooklyn and the Bronx.",
    timeline: "New sites opening 2025–2027",
    matchesGap: (g) => /clinic|health/i.test(g),
  },
  {
    title: "GreenThumb — Community Garden Support",
    description:
      "NYC Parks' GreenThumb program supports 500+ community gardens citywide and is actively helping neighborhoods start new gardens on vacant lots.",
    timeline: "Ongoing — new gardens each season",
    matchesGap: (g) => /community garden/i.test(g),
  },
  {
    title: "Zero Waste NYC — Reuse & Refill Infrastructure",
    description:
      "The city's zero-waste goals include expanding reuse centers, supporting refill shops, and piloting water bottle refill stations at parks and transit hubs.",
    timeline: "Pilots through 2026",
    matchesGap: (g) => /refill|zero-waste|water/i.test(g),
  },
];

function PolicySection({ gaps }: { gaps: string[] }) {
  const relevant = INITIATIVES.filter((init) =>
    gaps.some((gap) => init.matchesGap(gap))
  );

  if (relevant.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">What&apos;s being done</h2>
      <p className="text-sm text-gray-500 mb-4">
        City initiatives working to close these gaps.
      </p>
      <div className="space-y-4">
        {relevant.map((init, i) => (
          <div
            key={i}
            className="border-l-2 border-emerald-400 pl-4 py-1"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">
                {init.title}
              </h3>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                {init.timeline}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{init.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main Page ---

export default function ResultsPage({
  params,
}: {
  params: { address: string };
}) {
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [layers, setLayers] = useState<any>(null);
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
      .then(async (data) => {
        setResult(data);
        try {
          const layersRes = await fetch(`/api/layers?lat=${data.lat}&lng=${data.lng}`);
          if (layersRes.ok) {
            const layersData = await layersRes.json();
            setLayers(layersData);
          }
        } catch {
          // Layers are optional
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.address]);

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="font-semibold text-gray-900">
            Live Lightly
          </Link>
          <Link href="/map" className="text-sm text-gray-500 hover:text-gray-900">
            Gap Map
          </Link>
          <Link href="/methodology" className="text-sm text-gray-500 hover:text-gray-900">
            Methodology
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="mt-4 text-gray-500">Mapping your neighborhood...</p>
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
            <AmenityMap result={result} layers={layers} />
            <AmenitySummary amenities={result.amenities} />
            <ScoreSection result={result} />
            <CategoryBreakdown breakdown={result.breakdown} />
            <ReferenceNeighborhood result={result} />
            {result.equity && <EquityPanel equity={result.equity} />}
            <GapList gaps={result.gaps} />
            <PolicySection gaps={result.gaps} />
          </>
        )}
      </div>
    </main>
  );
}
