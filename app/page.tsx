"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const [address, setAddress] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    router.push(`/results/${encodeURIComponent(address.trim())}`);
  }

  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center">
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            title="A tool to understand how easy it is to live a climate-friendly lifestyle in your neighborhood — and what's missing"
          >
            Within Reach
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            See how well your neighborhood has been served by climate
            infrastructure investment.
          </p>
          <p className="text-sm text-gray-500 mb-10">
            Not a lifestyle score. A measure of whether cities are keeping their
            climate commitments — equitably.
          </p>

          <form onSubmit={handleSubmit} className="flex gap-3 max-w-lg mx-auto">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter a NYC address..."
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              Score
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-semibold mb-6">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8 text-sm text-gray-600">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                We map the infrastructure
              </h3>
              <p>
                Transit stops, bike lanes, grocery stores, composting sites, EV
                chargers, and more — all the low-carbon infrastructure near your
                address.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                We score the access
              </h3>
              <p>
                Six categories weighted by impact: transit, active mobility,
                daily needs, circular economy, local food, and clean energy.
                Total score 0–100.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                We show the gaps
              </h3>
              <p>
                What&apos;s missing in your area and where the city should invest
                next. View the{" "}
                <Link href="/map" className="text-emerald-600 underline">
                  citywide gap map
                </Link>{" "}
                to see the full picture.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
