"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import mapboxgl from "mapbox-gl";
type TractScores = Record<string, { score: number; lat: number; lng: number }>;

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

function applyBrandBasemap(m: mapboxgl.Map) {
  try {
    const style = m.getStyle();
    if (!style?.layers) return;

    for (const layer of style.layers) {
      try {
        if (layer.id === "background") {
          m.setPaintProperty(layer.id, "background-color", "#F2EBD9");
          continue;
        }
        if (layer.type === "fill" && layer.id.includes("water")) {
          m.setPaintProperty(layer.id, "fill-color", "#C8DCDD");
          continue;
        }
        if (layer.type === "line" && layer.id.includes("waterway")) {
          m.setPaintProperty(layer.id, "line-color", "#B8D0D1");
          continue;
        }
        if (layer.type === "fill" && (layer.id.includes("park") || layer.id.includes("landuse"))) {
          m.setPaintProperty(layer.id, "fill-color", "#E5DFCA");
          continue;
        }
        if (layer.type === "fill" && layer.id.includes("building")) {
          m.setPaintProperty(layer.id, "fill-color", "#E6DBC5");
          continue;
        }
      } catch {
        // Some properties may not be settable
      }
    }
  } catch {
    // Style may not be fully loaded
  }
}

function scoreToColor(score: number): string {
  if (score >= 75) return "#1A6B4B";
  if (score >= 50) return "#2D8A8B";
  if (score >= 25) return "#B5604E";
  return "#C0392B";
}

export default function GapMapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedTract, setSelectedTract] = useState<{
    id: string;
    score: number;
  } | null>(null);
  const [showCommunity, setShowCommunity] = useState(true);

  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-73.95, 40.71],
      zoom: 10.5,
    });

    map.current = m;

    m.on("load", () => {
      applyBrandBasemap(m);

      fetch("/api/tract-scores")
        .then((res) => res.json())
        .then((tractScores: TractScores) => {
          const features = Object.entries(tractScores).map(
            ([tractId, data]) => ({
              type: "Feature" as const,
              properties: { tractId, score: data.score },
              geometry: {
                type: "Point" as const,
                coordinates: [data.lng, data.lat],
              },
            })
          );

          m.addSource("tract-scores", {
            type: "geojson",
            data: { type: "FeatureCollection", features },
          });

          m.addLayer({
            id: "tract-circles",
            type: "circle",
            source: "tract-scores",
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                9, 12,
                12, 30,
                14, 50,
              ],
              "circle-color": [
                "interpolate",
                ["linear"],
                ["get", "score"],
                0, "#C0392B",
                25, "#B5604E",
                50, "#2D8A8B",
                75, "#1A6B4B",
              ],
              "circle-opacity": 0.6,
              "circle-stroke-width": 1,
              "circle-stroke-color": "#F2EBD9",
              "circle-stroke-opacity": 0.5,
            },
          });

          m.on("click", "tract-circles", (e) => {
            if (e.features && e.features[0]) {
              const props = e.features[0].properties!;
              setSelectedTract({
                id: props.tractId,
                score: props.score,
              });
            }
          });

          m.on("mouseenter", "tract-circles", () => {
            m.getCanvas().style.cursor = "pointer";
          });
          m.on("mouseleave", "tract-circles", () => {
            m.getCanvas().style.cursor = "";
          });
        });

      fetch("/api/community-spots")
        .then((res) => res.json())
        .then((geojson) => {
          if (!geojson.features) return;

          m.addSource("community-spots", {
            type: "geojson",
            data: geojson,
          });

          m.addLayer({
            id: "community-spots-layer",
            type: "circle",
            source: "community-spots",
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                10, 4,
                14, 8,
              ],
              "circle-color": "#3A7D44",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#F2EBD9",
              "circle-opacity": 0.85,
            },
          });

          m.addLayer({
            id: "community-spots-top-pick",
            type: "symbol",
            source: "community-spots",
            filter: ["==", ["get", "isTopPick"], true],
            layout: {
              "text-field": "★",
              "text-size": 10,
              "text-offset": [0, -1.2],
              "text-allow-overlap": true,
            },
            paint: {
              "text-color": "#E24B3A",

            },
          });

          m.on("click", "community-spots-layer", (e) => {
            if (!e.features || !e.features[0]) return;
            const props = e.features[0].properties!;
            const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;

            new mapboxgl.Popup({
              className: "community-popup",
              maxWidth: "240px",
            })
              .setLngLat(coords as [number, number])
              .setHTML(
                `<div style="font-family:var(--font-text);font-size:0.875rem;">` +
                  `<strong style="font-family:var(--font-display);text-transform:uppercase;font-size:0.875rem;">${props.name}</strong>` +
                  `<span style="display:inline-block;margin-left:4px;padding:0 4px;background:var(--cat-food);color:#F2EBD9;font-size:0.75rem;text-transform:uppercase;">Community</span>` +
                  (props.isTopPick === "true" || props.isTopPick === true
                    ? `<span style="display:inline-block;margin-left:2px;padding:0 4px;background:var(--coral);color:#F2EBD9;font-size:0.75rem;text-transform:uppercase;">Top Pick</span>`
                    : "") +
                  `<p style="margin:4px 0 0;color:#9A9183;font-size:0.875rem;">${props.description || ""}</p>` +
                  `</div>`
              )
              .addTo(m);
          });

          m.on("mouseenter", "community-spots-layer", () => {
            m.getCanvas().style.cursor = "pointer";
          });
          m.on("mouseleave", "community-spots-layer", () => {
            m.getCanvas().style.cursor = "";
          });
        })
        .catch(() => {});
    });

    return () => m.remove();
  }, []);

  useEffect(() => {
    if (!map.current) return;
    const m = map.current;
    if (m.getLayer("community-spots-layer")) {
      m.setLayoutProperty(
        "community-spots-layer",
        "visibility",
        showCommunity ? "visible" : "none"
      );
    }
    if (m.getLayer("community-spots-top-pick")) {
      m.setLayoutProperty(
        "community-spots-top-pick",
        "visibility",
        showCommunity ? "visible" : "none"
      );
    }
  }, [showCommunity]);

  return (
    <main className="h-screen flex flex-col bg-paper">
      <nav className="border-b-2 border-ink bg-paper z-10 sticky top-0">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-display font-extrabold text-[1rem] text-coral">
              LIVE LIGHTLY
            </Link>
            <span className="text-body-sm uppercase tracking-wide text-teal font-display font-bold">
              Citywide Gap Map
            </span>
            <Link href="/methodology" className="text-body-sm uppercase tracking-wide text-faded hover:text-ink transition-colors font-display font-bold hidden sm:inline">
              How We Score
            </Link>
          </div>
          <Link
            href="/suggest"
            className="border-2 border-ink px-3 py-1.5 text-body-sm uppercase tracking-wide font-display font-bold hover:bg-ink hover:text-paper transition-colors"
          >
            Add to the Map
          </Link>
        </div>
      </nav>

      <div className="flex-1 relative">
        {MAPBOX_TOKEN ? (
          <div ref={mapContainer} className="absolute inset-0" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-buff text-faded font-display text-label uppercase tracking-wide">
            Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the map
          </div>
        )}

        <div className="absolute bottom-6 left-4 bg-paper border border-ink shadow-[3px_3px_0_var(--buff)] p-3 z-10">
          <h3 className="font-display font-bold text-tag uppercase tracking-wide text-ink mb-1.5">
            Score
          </h3>
          <div className="space-y-1">
            {[
              { label: "75-100 Excellent", color: "#1A6B4B" },
              { label: "50-74 Moderate", color: "#2D8A8B" },
              { label: "25-49 Limited", color: "#B5604E" },
              { label: "0-24 Severely underserved", color: "#C0392B" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-tag">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-faded">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-2.5 pt-2 border-t border-dashed border-buff">
            <label className="flex items-center gap-2 cursor-pointer text-tag">
              <input
                type="checkbox"
                checked={showCommunity}
                onChange={(e) => setShowCommunity(e.target.checked)}
                className="w-3 h-3 accent-teal"
              />
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full border-2"
                  style={{ backgroundColor: "#3A7D44", borderColor: "#F2EBD9" }}
                />
                <span className="text-faded">Community suggested</span>
              </div>
            </label>
          </div>
        </div>

        {selectedTract && (
          <div className="absolute top-4 right-4 bg-paper border border-ink shadow-[3px_3px_0_var(--buff)] p-3 z-10 w-56">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-display font-bold text-label uppercase text-ink">
                Census Tract
              </h3>
              <button
                onClick={() => setSelectedTract(null)}
                className="text-faded hover:text-ink text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <p className="text-tag text-faded font-body mb-2">
              {selectedTract.id}
            </p>
            <div className="text-center py-2">
              <div
                className="font-display font-extrabold text-[2.6rem] leading-none"
                style={{ color: scoreToColor(selectedTract.score) }}
              >
                {selectedTract.score}
              </div>
              <p className="text-tag text-faded mt-1">/ 100</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
