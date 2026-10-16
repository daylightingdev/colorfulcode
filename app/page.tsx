"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Prediction {
  description: string;
  place_id: string;
}

function MapIllustration() {
  return (
    <svg className="w-[72px] h-[52px] mx-auto mb-2 mt-3" viewBox="0 0 72 52" fill="none" aria-hidden="true">
      <rect x="6" y="10" width="60" height="36" rx="2" stroke="var(--teal)" strokeWidth="1.2" strokeDasharray="3 2"/>
      <path d="M6 28Q18 24 30 28Q42 32 54 28Q60 26 66 28" stroke="var(--teal)" strokeWidth="0.8" opacity="0.3"/>
      <circle cx="24" cy="24" r="3.5" fill="var(--coral)" opacity="0.6"/>
      <circle cx="42" cy="20" r="3" fill="var(--teal)" opacity="0.5"/>
      <circle cx="52" cy="30" r="2.5" fill="var(--overprint)" opacity="0.5"/>
      <circle cx="18" cy="34" r="2" fill="var(--teal)" opacity="0.4"/>
      <circle cx="38" cy="36" r="2" fill="var(--coral)" opacity="0.4"/>
      <path d="M30 14L30 10L33 12Z" fill="var(--coral)" opacity="0.8"/>
      <line x1="30" y1="14" x2="30" y2="20" stroke="var(--coral)" strokeWidth="1.5" opacity="0.7"/>
    </svg>
  );
}

function GaugeIllustration() {
  return (
    <svg className="w-[72px] h-[52px] mx-auto mb-2 mt-3" viewBox="0 0 72 52" fill="none" aria-hidden="true">
      <path d="M16 40A20 20 0 0156 40" stroke="var(--buff)" strokeWidth="6" strokeLinecap="round"/>
      <path d="M16 40A20 20 0 0142 21" stroke="var(--teal)" strokeWidth="6" strokeLinecap="round"/>
      <circle cx="36" cy="40" r="3.5" fill="var(--coral)"/>
      <line x1="36" y1="40" x2="42" y2="24" stroke="var(--coral)" strokeWidth="2" strokeLinecap="round"/>
      <text x="36" y="50" textAnchor="middle" fill="var(--ink)" fontFamily="var(--font-display)" fontWeight="800" fontSize="8">48</text>
    </svg>
  );
}

function GapsIllustration() {
  return (
    <svg className="w-[72px] h-[52px] mx-auto mb-2 mt-3" viewBox="0 0 72 52" fill="none" aria-hidden="true">
      <line x1="8" y1="32" x2="26" y2="32" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round"/>
      <line x1="46" y1="32" x2="64" y2="32" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round"/>
      <line x1="28" y1="32" x2="44" y2="32" stroke="var(--coral)" strokeWidth="1.5" strokeDasharray="2 3" opacity="0.5"/>
      <circle cx="36" cy="26" r="11" stroke="var(--coral)" strokeWidth="1.5"/>
      <line x1="44" y1="34" x2="52" y2="42" stroke="var(--coral)" strokeWidth="2" strokeLinecap="round"/>
      <text x="36" y="30" textAnchor="middle" fill="var(--coral)" fontFamily="var(--font-display)" fontWeight="800" fontSize="10">?</text>
    </svg>
  );
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
    <main className="min-h-screen grain bg-paper">
      <div className="flex-1 flex items-center justify-center px-4 pt-12 sm:pt-20 pb-10">
        <div className="max-w-2xl w-full">
          <h1
            className="font-display text-title-xl sm:text-[4.2rem] md:text-[5rem] leading-[0.88] misregister text-coral"
            data-text="LIVE LIGHTLY"
          >
            LIVE LIGHTLY
          </h1>

          <p className="text-tag uppercase text-teal mt-3 mb-2">
            Your Planet-Friendly Neighborhood Map
          </p>

          <p className="text-body-sm text-faded max-w-[300px] mb-6">
            Find the places near you that make it easier to walk, bike,
            compost, repair, and shop locally.
          </p>

          <form onSubmit={handleSubmit} className="max-w-[440px] mb-10">
            <div className="flex" ref={wrapperRef}>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => {
                    if (predictions.length > 0) setShowDropdown(true);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter a NYC address..."
                  className="w-full px-3 py-2.5 tape-border border-r-0 bg-transparent font-body text-[0.65rem] text-ink placeholder:text-faded focus:outline-none focus:ring-2 focus:ring-coral"
                  autoComplete="off"
                />
                {showDropdown && predictions.length > 0 && (
                  <ul className="absolute z-50 left-0 right-0 mt-0 bg-paper border border-ink shadow-[3px_3px_0_var(--buff)] max-h-60 overflow-y-auto text-left">
                    {predictions.map((p, i) => (
                      <li
                        key={p.place_id}
                        onClick={() => selectPrediction(p.description)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={`px-3 py-2 text-body-sm cursor-pointer transition-colors border-b border-dashed border-buff ${
                          i === activeIndex
                            ? "bg-buff text-ink"
                            : "text-faded hover:bg-buff/50"
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
                className="px-4 py-2.5 bg-coral text-paper font-display font-bold text-[0.72rem] tracking-wider hover:brightness-110 transition-all"
              >
                EXPLORE
              </button>
            </div>
          </form>

          <div className="flex gap-3 flex-wrap">
            <div className="stamp flex-1 min-w-[140px] p-3" data-n="01">
              <MapIllustration />
              <h3 className="font-display text-label uppercase text-coral mb-1">
                We map what matters
              </h3>
              <p className="text-body-sm text-faded">
                Transit, bike lanes, composting, thrift - everything nearby.
              </p>
            </div>
            <div className="stamp flex-1 min-w-[140px] p-3" data-n="02">
              <GaugeIllustration />
              <h3 className="font-display text-label uppercase text-coral mb-1">
                We score the access
              </h3>
              <p className="text-body-sm text-faded">
                Five categories. One number. Zero judgment.
              </p>
            </div>
            <div className="stamp flex-1 min-w-[140px] p-3" data-n="03">
              <GapsIllustration />
              <h3 className="font-display text-label uppercase text-coral mb-1">
                We show the gaps
              </h3>
              <p className="text-body-sm text-faded">
                What&apos;s missing, and what the city&apos;s doing about it.
              </p>
            </div>
          </div>

          <p className="mt-8 text-tag text-faded">
            Curious how it all works?{" "}
            <Link href="/methodology" className="text-teal underline underline-offset-2">
              Read our methodology
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
