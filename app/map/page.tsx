"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import mapboxgl from "mapbox-gl";
type TractScores = Record<string, { score: number; lat: number; lng: number }>;

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

function scoreToColor(score: number): string {
  if (score >= 75) return "#0B6E6F";
  if (score >= 50) return "#2D8A8B";
  if (score >= 35) return "#7A4A38";
  if (score >= 20) return "#B5604E";
  return "#E24B3A";
}

export default function GapMapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedTract, setSelectedTract] = useState<{
    id: string;
    score: number;
  } | null>(null);

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
                0, "#E24B3A",
                25, "#B5604E",
                40, "#7A4A38",
                60, "#2D8A8B",
                80, "#0B6E6F",
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
    });

    return () => m.remove();
  }, []);

  return (
    <main className="h-screen flex flex-col bg-paper">
      <nav className="border-b-2 border-ink bg-paper z-10">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/" className="font-display font-extrabold text-[0.9rem] text-coral">
            LIVE LIGHTLY
          </Link>
          <span className="text-tag uppercase tracking-wide text-teal font-bold">
            Citywide Gap Map
          </span>
          <Link href="/methodology" className="text-tag uppercase tracking-wide text-faded hover:text-ink transition-colors">
            How We Score
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
              { label: "75-100 Excellent", color: "#0B6E6F" },
              { label: "50-74 Moderate", color: "#2D8A8B" },
              { label: "35-49 Limited", color: "#7A4A38" },
              { label: "20-34 Poor", color: "#B5604E" },
              { label: "0-19 Severely underserved", color: "#E24B3A" },
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
