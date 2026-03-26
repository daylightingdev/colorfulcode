"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import mapboxgl from "mapbox-gl";
type TractScores = Record<string, { score: number; lat: number; lng: number }>;

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

function scoreToColor(score: number): string {
  if (score >= 75) return "#059669";
  if (score >= 50) return "#22c55e";
  if (score >= 35) return "#f59e0b";
  if (score >= 20) return "#f97316";
  return "#ef4444";
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
      // Fetch pre-computed tract scores from API
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

      // Heatmap-like circles as choropleth proxy until we have real tract polygons
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
            0, "#ef4444",
            25, "#f97316",
            40, "#f59e0b",
            60, "#22c55e",
            80, "#059669",
          ],
          "circle-opacity": 0.6,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff",
          "circle-stroke-opacity": 0.5,
        },
      });

          // Click handler
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
    <main className="h-screen flex flex-col">
      <nav className="border-b border-gray-200 bg-white z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="font-semibold text-gray-900">
            Within Reach
          </Link>
          <span className="text-sm text-emerald-600 font-medium">
            Citywide Gap Map
          </span>
        </div>
      </nav>

      <div className="flex-1 relative">
        {MAPBOX_TOKEN ? (
          <div ref={mapContainer} className="absolute inset-0" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
            Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the map
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-6 left-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-10">
          <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Score
          </h3>
          <div className="space-y-1.5">
            {[
              { label: "75–100 Excellent", color: "#059669" },
              { label: "50–74 Moderate", color: "#22c55e" },
              { label: "35–49 Limited", color: "#f59e0b" },
              { label: "20–34 Poor", color: "#f97316" },
              { label: "0–19 Severely underserved", color: "#ef4444" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected tract panel */}
        {selectedTract && (
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-10 w-64">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Census Tract
              </h3>
              <button
                onClick={() => setSelectedTract(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2 font-mono">
              {selectedTract.id}
            </p>
            <div className="text-center py-3">
              <div
                className="text-4xl font-bold"
                style={{ color: scoreToColor(selectedTract.score) }}
              >
                {selectedTract.score}
              </div>
              <p className="text-xs text-gray-500 mt-1">/ 100</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
