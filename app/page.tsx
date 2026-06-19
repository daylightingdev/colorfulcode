"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Prediction {
  description: string;
  place_id: string;
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setShowDropdown(false);
    router.push(`/results/${encodeURIComponent(address.trim())}`);
  }

  function selectPrediction(description: string) {
    setAddress(description);
    setShowDropdown(false);
    setPredictions([]);
    router.push(`/results/${encodeURIComponent(description)}`);
  }

  function handleInputChange(value: string) {
    setAddress(value);
    setActiveIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/autocomplete?input=${encodeURIComponent(value)}`
        );
        const data = await res.json();
        setPredictions(data.predictions || []);
        setShowDropdown((data.predictions || []).length > 0);
      } catch {
        setPredictions([]);
        setShowDropdown(false);
      }
    }, 250);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || predictions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectPrediction(predictions[activeIndex].description);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center">
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-2"
          >
            Live Lightly
          </h1>
          <p className="text-lg text-emerald-600 font-medium mb-2">
            Your Planet-Friendly Neighborhood Map
          </p>
          <p className="text-base text-gray-600 mb-10">
            Find the places near you that make it easier to walk, bike,
            compost, repair, and shop locally.
          </p>

          <form onSubmit={handleSubmit} className="max-w-lg mx-auto">
            <div className="flex gap-3">
              <div className="flex-1 relative" ref={wrapperRef}>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => {
                    if (predictions.length > 0) setShowDropdown(true);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter a NYC address..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoComplete="off"
                />
                {showDropdown && predictions.length > 0 && (
                  <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto text-left">
                    {predictions.map((p, i) => (
                      <li
                        key={p.place_id}
                        onClick={() => selectPrediction(p.description)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                          i === activeIndex
                            ? "bg-emerald-50 text-emerald-900"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {p.description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
              >
                Explore
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="border-t border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-semibold mb-6">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8 text-sm text-gray-600">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                We map what matters
              </h3>
              <p>
                Transit, bike lanes, farmers markets, composting, thrift stores,
                and more — everything nearby that helps you live a little more
                lightly.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                We score the access
              </h3>
              <p>
                Five categories weighted by how much they matter for
                planet-friendly daily life: transit, active mobility, daily
                needs, circular economy, and local food.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                We show the gaps
              </h3>
              <p>
                What&apos;s missing in your neighborhood — and what the city is
                doing about it. View the{" "}
                <Link href="/map" className="text-emerald-600 underline">
                  citywide gap map
                </Link>{" "}
                to see the bigger picture.
              </p>
            </div>
          </div>
          <p className="mt-8 text-sm text-gray-500">
            Curious how it all works?{" "}
            <Link href="/methodology" className="text-emerald-600 underline">
              Read our methodology
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
