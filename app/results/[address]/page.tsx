"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import mapboxgl from "mapbox-gl";
import { CATEGORY_META, type ScoreResult } from "@/lib/mock-data";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

function getScoreLabel(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 50) return "Moderate";
  if (score >= 25) return "Limited";
  return "Severely underserved";
}

const AMENITY_COLORS: Record<string, string> = {
  transitStops: "#0B6E6F",
  bikeLanes: "#7A4A38",
  bikeShares: "#7A4A38",
  groceries: "#E24B3A",
  pharmacies: "#E24B3A",
  clinics: "#E24B3A",
  laundromats: "#E24B3A",
  thriftStores: "#0B6E6F",
  compostSites: "#0B6E6F",
  refillShops: "#0B6E6F",
  communityGardens: "#7A4A38",
  coops: "#7A4A38",
  csaPickups: "#7A4A38",
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
  farmersMarkets: "#7A4A38",
  gardens: "#0B6E6F",
  parks: "#0B6E6F",
  libraries: "#7A4A38",
  donateNyc: "#E24B3A",
  repairCafes: "#E24B3A",
};

const LAYER_LABELS: Record<string, string> = {
  farmersMarkets: "Farmers Markets",
  gardens: "Community Gardens",
  parks: "Parks",
  libraries: "Libraries",
  donateNyc: "Donation Centers",
  repairCafes: "Repair Cafes",
};

const CATEGORY_FILL: Record<string, string> = {
  transit: "var(--teal)",
  activeMobility: "var(--overprint)",
  dailyNeeds: "var(--coral)",
  circularEconomy: "var(--teal)",
  localFood: "var(--overprint)",
};

function TransitIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true" className="flex-shrink-0">
      <rect x="4" y="5" width="10" height="8" rx="1.5" stroke="var(--teal)" strokeWidth="1.2"/>
      <circle cx="9" cy="9" r="2" fill="var(--teal)" opacity="0.4"/>
      <line x1="6" y1="3.5" x2="6" y2="5" stroke="var(--teal)" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="12" y1="3.5" x2="12" y2="5" stroke="var(--teal)" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="4" y1="14" x2="14" y2="14" stroke="var(--teal)" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

function MobilityIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true" className="flex-shrink-0">
      <circle cx="5" cy="12.5" r="2.8" stroke="var(--overprint)" strokeWidth="1.1"/>
      <circle cx="13" cy="12.5" r="2.8" stroke="var(--overprint)" strokeWidth="1.1"/>
      <path d="M5 10L8 5L13 10" stroke="var(--overprint)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="8" y1="5" x2="8" y2="8" stroke="var(--overprint)" strokeWidth="1.1"/>
    </svg>
  );
}

function DailyNeedsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true" className="flex-shrink-0">
      <path d="M5 6L5 14L13 14L13 6" stroke="var(--coral)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 6L9 3L15 6" stroke="var(--coral)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="7.5" y="10" width="3" height="4" stroke="var(--coral)" strokeWidth="0.8"/>
    </svg>
  );
}

function CircularIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true" className="flex-shrink-0">
      <path d="M9 3A6 6 0 0115 9" stroke="var(--teal)" strokeWidth="1.1" strokeLinecap="round"/>
      <path d="M15 9A6 6 0 019 15" stroke="var(--teal)" strokeWidth="1.1" strokeLinecap="round"/>
      <path d="M9 15A6 6 0 013 9" stroke="var(--teal)" strokeWidth="1.1" strokeLinecap="round"/>
      <path d="M3 9A6 6 0 019 3" stroke="var(--teal)" strokeWidth="1.1" strokeLinecap="round"/>
      <polygon points="13,4 15,2.5 13.5,5" fill="var(--teal)" opacity="0.6"/>
    </svg>
  );
}

function LocalFoodIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true" className="flex-shrink-0">
      <path d="M9 14.5L9 7" stroke="var(--overprint)" strokeWidth="1.1" strokeLinecap="round"/>
      <path d="M9 7C9 4 5 2.5 5 5C5 7 9 7 9 7" fill="var(--teal)" opacity="0.25" stroke="var(--teal)" strokeWidth="0.9"/>
      <path d="M9 9C9 6.5 13 5 13 7.5C13 9 9 9 9 9" fill="var(--coral)" opacity="0.2" stroke="var(--coral)" strokeWidth="0.9"/>
      <line x1="7" y1="14.5" x2="11" y2="14.5" stroke="var(--overprint)" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

const CATEGORY_ICONS: Record<string, (props: { size?: number }) => React.ReactElement> = {
  transit: TransitIcon,
  activeMobility: MobilityIcon,
  dailyNeeds: DailyNeedsIcon,
  circularEconomy: CircularIcon,
  localFood: LocalFoodIcon,
};

const AMENITY_SUMMARY_CATEGORIES = [
  {
    key: "transit",
    label: "Transit",
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
    <div>
      <h2 className="font-display font-bold text-section uppercase border-b-2 border-ink pb-1 mb-1">
        What&apos;s Nearby
      </h2>
      {AMENITY_SUMMARY_CATEGORIES.map((cat) => {
        const total = cat.amenityKeys.reduce((sum, k) => sum + (counts[k] || 0), 0);
        const Icon = CATEGORY_ICONS[cat.key];
        return (
          <div
            key={cat.key}
            className="flex items-center gap-2 py-1.5 border-b border-dashed border-buff"
          >
            {Icon && <Icon size={18} />}
            <span className="flex-1 font-bold text-label uppercase tracking-wide">
              {cat.label}
            </span>
            <span className="text-[0.55rem] text-faded hidden sm:inline">
              {cat.description(counts)}
            </span>
            <span
              className="font-display font-extrabold text-base min-w-[22px] text-right"
              style={{ color: CATEGORY_FILL[cat.key] }}
            >
              {total}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ScoreSection({ result }: { result: ScoreResult }) {
  const label = getScoreLabel(result.score);
  return (
    <div className="text-center py-2">
      <span
        className="font-display font-extrabold text-score-hero text-coral misregister"
        data-text={result.score.toString()}
      >
        {result.score}
      </span>
      <div className="mt-1">
        <span className="inline-block px-2 py-0.5 border-2 border-dashed border-teal text-tag uppercase tracking-[0.12em] text-teal">
          {label}
        </span>
      </div>
      <p className="text-tag text-faded mt-1.5">{result.address}</p>
      <ScoreNarrative result={result} />
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
      <p className="text-body-sm text-faded mt-3 max-w-[400px] mx-auto leading-relaxed">
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
    <p className="text-body-sm text-faded mt-3 max-w-[400px] mx-auto leading-relaxed">
      Your neighborhood has {listed} within walking distance, a foundation
      for living lightly. The score reflects both what&apos;s already here
      and where there&apos;s room to grow.
    </p>
  );
}

function CategoryBreakdown({ breakdown }: { breakdown: ScoreResult["breakdown"] }) {
  return (
    <div>
      <h2 className="font-display font-bold text-section uppercase border-b-2 border-ink pb-1 mb-2">
        Category Breakdown
      </h2>
      <div className="space-y-2">
        {Object.entries(breakdown).map(([key, value]) => {
          const meta = CATEGORY_META[key];
          if (!meta) return null;
          const pct = (value / meta.max) * 100;
          const Icon = CATEGORY_ICONS[key];
          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-0.5">
                <div className="flex items-center gap-1.5">
                  {Icon && <Icon size={15} />}
                  <span className="font-display font-bold text-tag uppercase tracking-wide">
                    {meta.label}
                  </span>
                </div>
                <span className="text-[0.55rem] text-faded">
                  {value} / {meta.max}
                </span>
              </div>
              <div className="score-bar">
                <div
                  className="h-full"
                  style={{ width: `${pct}%`, backgroundColor: CATEGORY_FILL[key] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReferenceNeighborhood({ result }: { result: ScoreResult }) {
  if (!result.referenceNeighborhood || !result.borough) return null;

  const ref = result.referenceNeighborhood;
  const diff = ref.score - result.score;

  return (
    <div className="border border-ink p-4 relative">
      <span className="absolute -top-2 left-3 bg-paper px-1.5 font-display font-bold text-[0.5rem] tracking-[0.1em] uppercase text-faded">
        How You Compare
      </span>
      <div className="flex items-center justify-center gap-3">
        <div className="flex-1 text-center">
          <div className="text-[0.52rem] font-bold uppercase tracking-wide text-faded mb-0.5">
            Your Neighborhood
          </div>
          <div className="font-display font-extrabold text-[2.6rem] leading-none text-coral">
            {result.score}
          </div>
        </div>
        <span className="font-display font-extrabold text-[0.85rem] text-buff">VS</span>
        <div className="flex-1 text-center">
          <div className="text-[0.52rem] font-bold uppercase tracking-wide text-faded mb-0.5">
            {ref.name}
          </div>
          <div className="font-display font-extrabold text-[2.6rem] leading-none text-teal">
            {ref.score}
          </div>
        </div>
      </div>
      <p className="text-center text-[0.55rem] text-faded mt-2">
        Highest-scoring neighborhood in {result.borough}
        {diff > 0 && `, ${diff} point${diff !== 1 ? "s" : ""} ahead`}
      </p>
      {diff > 0 && (
        <p className="text-center text-[0.55rem] text-faded mt-1">
          See the{" "}
          <Link href="/map" className="text-teal underline underline-offset-2">
            gap map
          </Link>{" "}
          to explore what makes the difference.
        </p>
      )}
    </div>
  );
}

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
        return `<br/><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer" style="color:#0B6E6F;font-size:12px;">View on Google Maps</a>`;
      };

      new mapboxgl.Marker({ color: "#2D2926" })
        .setLngLat([result.lng, result.lat])
        .setPopup(new mapboxgl.Popup().setText(result.address))
        .addTo(m);

      const amenities = result.amenities as unknown as Record<string, Array<{ name: string; lat: number; lng: number }>>;
      for (const [category, items] of Object.entries(amenities)) {
        if (category === "bikeLanes") continue;
        const color = AMENITY_COLORS[category] || "#7A4A38";
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
          "line-color": "#9A9183",
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
          "text-color": "#9A9183",
          "text-halo-color": "#F2EBD9",
          "text-halo-width": 1.5,
        },
      });

      if (layers) {
        const addLayerMarkers = (
          items: any[],
          categoryKey: string,
          popupFn: (item: any) => string
        ) => {
          const color = LAYER_COLORS[categoryKey] || "#7A4A38";
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
              html += `<br/><span style="background:#0B6E6F;color:#F2EBD9;padding:1px 6px;font-size:11px;">Accepts EBT</span>`;
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
    <div className="border border-ink overflow-hidden">
      <div className="p-3 border-b-2 border-ink">
        <h2 className="font-display font-bold text-section uppercase mb-2">
          Your Neighborhood Map
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(AMENITY_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleLayer(key)}
              className={`text-tag px-2 py-0.5 transition-colors ${
                visibleLayers.has(key)
                  ? "text-paper"
                  : "border border-dashed border-faded text-faded"
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
            <p className="text-tag text-faded mt-2 mb-1 uppercase tracking-wide font-bold">
              Community Resources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(LAYER_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleLayer(key)}
                  className={`text-tag px-2 py-0.5 transition-colors ${
                    visibleLayers.has(key)
                      ? "text-paper"
                      : "border border-dashed border-faded text-faded"
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
        <div ref={mapContainer} className="h-[350px] sm:h-[450px] w-full" />
      ) : (
        <div className="h-[350px] sm:h-[450px] w-full flex items-center justify-center bg-buff text-faded font-display text-label uppercase tracking-wide">
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
    <div>
      <h2 className="font-display font-bold text-section uppercase border-b-2 border-ink pb-1 mb-2">
        Equity Context
      </h2>
      <p className="text-body-sm text-faded mb-3">
        Who lives here matters. Scores mean different things in different communities.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border border-dashed border-faded p-3">
          <p className="text-tag uppercase text-faded">Median Household Income</p>
          <p className="font-display font-extrabold text-xl">
            ${equity.median_income.toLocaleString()}
          </p>
          <p className="text-body-sm text-faded">
            {incomePct}% of NYC median (${equity.nyc_median_income.toLocaleString()})
          </p>
        </div>
        <div className="border border-dashed border-faded p-3">
          <p className="text-tag uppercase text-faded">Displacement Risk</p>
          <p className="font-display font-extrabold text-xl capitalize">{equity.displacement_risk}</p>
        </div>
        <div className="border border-dashed border-faded p-3">
          <p className="text-tag uppercase text-faded">Rent Burden</p>
          <p className="font-display font-extrabold text-xl">{equity.rent_burden_pct}%</p>
          <p className="text-body-sm text-faded">
            of households paying &gt;30% of income on rent
          </p>
        </div>
        <div className="border border-dashed border-faded p-3">
          <p className="text-tag uppercase text-faded">% White Population</p>
          <p className="font-display font-extrabold text-xl">{equity.pct_white}%</p>
        </div>
      </div>
    </div>
  );
}

function GapList({ gaps }: { gaps: string[] }) {
  return (
    <div>
      <h2 className="font-display font-bold text-section uppercase border-b-2 border-ink pb-1 mb-1">
        What&apos;s Missing
      </h2>
      {gaps.length === 0 ? (
        <p className="text-body-sm text-faded py-2">No major gaps identified.</p>
      ) : (
        <div>
          {gaps.map((gap, i) => (
            <div
              key={i}
              className="flex items-start gap-2 py-1.5 border-t border-dashed border-buff text-tag"
            >
              <span className="w-[7px] h-[7px] rounded-full bg-coral flex-shrink-0 mt-0.5" />
              <span>{gap}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 pt-3 border-t border-dashed border-buff text-body-sm text-faded">
        <p>
          Report infrastructure needs via{" "}
          <a
            href="https://portal.311.nyc.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal underline underline-offset-2"
          >
            NYC 311
          </a>
          . View the{" "}
          <Link href="/map" className="text-teal underline underline-offset-2">
            citywide gap map
          </Link>{" "}
          to see how your neighborhood compares.
        </p>
      </div>
    </div>
  );
}

interface Initiative {
  title: string;
  description: string;
  timeline: string;
  matchesGap: (gap: string) => boolean;
}

const INITIATIVES: Initiative[] = [
  {
    title: "NYC Streets Plan: Protected Bike Lanes Expansion",
    description:
      "The city is required to build 250 miles of protected bike lanes by 2026 under the Streets Plan law, with a focus on high-injury corridors and transit deserts.",
    timeline: "Ongoing through 2026",
    matchesGap: (g) => /bike lane/i.test(g),
  },
  {
    title: "Curbside Composting: Citywide Rollout",
    description:
      "DSNY's curbside composting program is expanding borough by borough. All five boroughs now have curbside food scrap collection.",
    timeline: "Citywide",
    matchesGap: (g) => /compost/i.test(g),
  },
  {
    title: "MTA Fast Forward Plan: Subway Accessibility & Frequency",
    description:
      "The MTA's capital plan includes signal modernization on key lines, bus network redesigns, and new ADA-accessible stations to improve transit frequency and coverage.",
    timeline: "Through 2029",
    matchesGap: (g) => /subway|bus|transit/i.test(g),
  },
  {
    title: "FRESH Program: Grocery Store Incentives",
    description:
      "The Food Retail Expansion to Support Health (FRESH) program offers tax incentives and zoning flexibility to attract grocery stores to underserved neighborhoods.",
    timeline: "Ongoing",
    matchesGap: (g) => /grocery/i.test(g),
  },
  {
    title: "Community Health Center Expansion",
    description:
      "NYC Health + Hospitals is expanding Federally Qualified Health Centers in underserved areas, with several new sites planned in Brooklyn and the Bronx.",
    timeline: "New sites opening 2025-2027",
    matchesGap: (g) => /clinic|health/i.test(g),
  },
  {
    title: "GreenThumb: Community Garden Support",
    description:
      "NYC Parks' GreenThumb program supports 500+ community gardens citywide and is actively helping neighborhoods start new gardens on vacant lots.",
    timeline: "Ongoing, new gardens each season",
    matchesGap: (g) => /community garden/i.test(g),
  },
  {
    title: "Zero Waste NYC: Reuse & Refill Infrastructure",
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
    <div>
      <h2 className="font-display font-bold text-section uppercase border-b-2 border-ink pb-1 mb-1">
        What&apos;s Being Done
      </h2>
      <p className="text-body-sm text-faded mb-3">
        City initiatives working to close these gaps.
      </p>
      <div className="space-y-3">
        {relevant.map((init, i) => (
          <div
            key={i}
            className="border-l-2 border-teal pl-3 py-1"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display font-bold text-label uppercase">
                {init.title}
              </h3>
              <span className="text-tag text-teal border border-dashed border-teal px-1.5 py-0.5 whitespace-nowrap">
                {init.timeline}
              </span>
            </div>
            <p className="text-body-sm text-faded mt-1">{init.description}</p>
          </div>
        ))}
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
    <main className="min-h-screen grain bg-paper">
      <nav className="max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-3 py-2.5 border-b-2 border-ink">
          <Link href="/" className="font-display font-extrabold text-[0.9rem] text-coral">
            LIVE LIGHTLY
          </Link>
          <Link href="/map" className="text-tag uppercase tracking-wide text-faded hover:text-ink transition-colors">
            Gap Map
          </Link>
          <Link href="/methodology" className="text-tag uppercase tracking-wide text-faded hover:text-ink transition-colors">
            How We Score
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-coral border-t-transparent" />
            <p className="mt-4 text-faded text-body-sm">Mapping your neighborhood...</p>
          </div>
        )}
        {error && (
          <div className="text-center py-20">
            <p className="text-coral text-section font-display">{error}</p>
            <Link href="/" className="text-teal underline underline-offset-2 mt-2 inline-block text-body-sm">
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
