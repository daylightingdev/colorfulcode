"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type mapboxgl from "mapbox-gl";
import { CATEGORY_META, type ScoreResult } from "@/lib/mock-data";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// ── Category colors (hex for Mapbox, CSS vars for components) ───────────

const CATEGORY_HEX: Record<string, string> = {
  transit: "#0B6E6F",
  activeMobility: "#B5604E",
  dailyNeeds: "#8B6D2E",
  circularEconomy: "#6B5B95",
  localFood: "#3A7D44",
};

const CATEGORY_CSS: Record<string, string> = {
  transit: "var(--cat-transit)",
  activeMobility: "var(--cat-mobility)",
  dailyNeeds: "var(--cat-daily)",
  circularEconomy: "var(--cat-circular)",
  localFood: "var(--cat-food)",
};

const AMENITY_TO_CATEGORY: Record<string, string> = {
  transitStops: "transit",
  bikeShares: "activeMobility",
  bikeLanes: "activeMobility",
  groceries: "dailyNeeds",
  pharmacies: "dailyNeeds",
  clinics: "dailyNeeds",
  laundromats: "dailyNeeds",
  thriftStores: "circularEconomy",
  compostSites: "circularEconomy",
  refillShops: "circularEconomy",
  communityGardens: "localFood",
  coops: "localFood",
  csaPickups: "localFood",
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
  refillShops: "Refill Shops",
  communityGardens: "Community Gardens",
  coops: "Food Co-ops",
  csaPickups: "CSA Pickups",
};

const LAYER_TO_CATEGORY: Record<string, string> = {
  farmersMarkets: "localFood",
  gardens: "localFood",
  parks: "localFood",
  libraries: "dailyNeeds",
  donateNyc: "circularEconomy",
  repairCafes: "circularEconomy",
};

const LAYER_LABELS: Record<string, string> = {
  farmersMarkets: "Farmers Markets",
  gardens: "Community Gardens",
  parks: "Parks",
  libraries: "Libraries",
  donateNyc: "Donation Centers",
  repairCafes: "Repair Cafes",
};

// ── Score helpers ────────────────────────────────────────────────────────

function getScoreLabel(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 50) return "Moderate";
  if (score >= 25) return "Limited";
  return "Severely underserved";
}

function getScoreBandDef(score: number): string {
  if (score >= 75) return "Your neighborhood makes it easy to live lightly.";
  if (score >= 50) return "Good foundation with room to grow.";
  if (score >= 25) return "Some infrastructure exists, but significant gaps remain.";
  return "Very little planet-friendly infrastructure nearby.";
}

function getScoreColor(score: number): string {
  if (score >= 75) return "#1A6B4B";
  if (score >= 50) return "#2D8A8B";
  if (score >= 25) return "#B5604E";
  return "#C0392B";
}

// ── Custom marker shapes per category ───────────────────────────────────

function createMarkerElement(categoryKey: string): HTMLElement {
  const color = CATEGORY_HEX[categoryKey] || CATEGORY_HEX.dailyNeeds;
  const shapes: Record<string, string> = {
    transit: `<rect x="2" y="2" width="16" height="16" rx="3" fill="${color}" stroke="#F2EBD9" stroke-width="1.5"/>`,
    activeMobility: `<polygon points="10,1 19,10 10,19 1,10" fill="${color}" stroke="#F2EBD9" stroke-width="1.5"/>`,
    dailyNeeds: `<circle cx="10" cy="10" r="8" fill="${color}" stroke="#F2EBD9" stroke-width="1.5"/>`,
    circularEconomy: `<polygon points="10,2 18,14 2,14" fill="${color}" stroke="#F2EBD9" stroke-width="1.5"/>`,
    localFood: `<polygon points="10,1 18,7 15,17 5,17 2,7" fill="${color}" stroke="#F2EBD9" stroke-width="1.5"/>`,
  };
  const el = document.createElement("div");
  el.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">${shapes[categoryKey] || shapes.dailyNeeds}</svg>`;
  el.style.cursor = "pointer";
  return el;
}

function createHomeMarker(): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="#E24B3A"/>
    <circle cx="14" cy="14" r="6" fill="#F2EBD9"/>
  </svg>`;
  el.style.cursor = "pointer";
  return el;
}

// ── Category icon components ────────────────────────────────────────────

function TransitIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-shrink-0">
      <rect x="4" y="5" width="12" height="10" rx="2" stroke="var(--cat-transit)" strokeWidth="1.3" />
      <circle cx="10" cy="10" r="2.5" fill="var(--cat-transit)" opacity="0.35" />
      <line x1="7" y1="3" x2="7" y2="5" stroke="var(--cat-transit)" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="13" y1="3" x2="13" y2="5" stroke="var(--cat-transit)" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="4" y1="17" x2="16" y2="17" stroke="var(--cat-transit)" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function MobilityIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-shrink-0">
      <circle cx="5.5" cy="14" r="3" stroke="var(--cat-mobility)" strokeWidth="1.2" />
      <circle cx="14.5" cy="14" r="3" stroke="var(--cat-mobility)" strokeWidth="1.2" />
      <path d="M5.5 11L9 5L14.5 11" stroke="var(--cat-mobility)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="9" y1="5" x2="9" y2="9" stroke="var(--cat-mobility)" strokeWidth="1.2" />
    </svg>
  );
}

function DailyNeedsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-shrink-0">
      <path d="M5 7L5 16L15 16L15 7" stroke="var(--cat-daily)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7L10 3L17 7" stroke="var(--cat-daily)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="8" y="11" width="4" height="5" stroke="var(--cat-daily)" strokeWidth="0.9" />
    </svg>
  );
}

function CircularIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-shrink-0">
      <path d="M10 3A7 7 0 0117 10" stroke="var(--cat-circular)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M17 10A7 7 0 0110 17" stroke="var(--cat-circular)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10 17A7 7 0 013 10" stroke="var(--cat-circular)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3 10A7 7 0 0110 3" stroke="var(--cat-circular)" strokeWidth="1.2" strokeLinecap="round" />
      <polygon points="15,4 17,2.5 15.5,5.5" fill="var(--cat-circular)" opacity="0.6" />
    </svg>
  );
}

function LocalFoodIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-shrink-0">
      <path d="M10 16L10 8" stroke="var(--cat-food)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10 8C10 4.5 5.5 2.5 5.5 5.5C5.5 8 10 8 10 8" fill="var(--cat-food)" opacity="0.2" stroke="var(--cat-food)" strokeWidth="1" />
      <path d="M10 10C10 7 14.5 5.5 14.5 8C14.5 10 10 10 10 10" fill="var(--cat-food)" opacity="0.15" stroke="var(--cat-food)" strokeWidth="1" />
      <line x1="7.5" y1="16" x2="12.5" y2="16" stroke="var(--cat-food)" strokeWidth="1.2" strokeLinecap="round" />
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

// ── Autocomplete types ──────────────────────────────────────────────────

interface Prediction {
  description: string;
  place_id: string;
}

// ── Merged category config ──────────────────────────────────────────────

const MERGED_CATEGORIES = [
  {
    key: "transit",
    label: "Transit",
    amenityKeys: ["transitStops"],
    description: (counts: Record<string, number>, amenities?: ScoreResult["amenities"]) => {
      const total = counts.transitStops || 0;
      if (total === 0) return "No transit stops within walking distance.";
      if (amenities?.transitStops) {
        const subways = amenities.transitStops.filter((s) => s.type === "subway").length;
        const buses = amenities.transitStops.filter((s) => s.type === "bus").length;
        const parts: string[] = [];
        if (subways > 0) parts.push(`${subways} subway`);
        if (buses > 0) parts.push(`${buses} bus`);
        const other = total - subways - buses;
        if (other > 0) parts.push(`${other} other`);
        return `${total} transit stop${total > 1 ? "s" : ""} (${parts.join(", ")}) within walking distance.`;
      }
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

// ── Persistent nav ──────────────────────────────────────────────────────

function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="border-b-2 border-ink bg-paper sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
        <Link href="/" className="font-display font-extrabold text-[1rem] text-coral tracking-tight">
          LIVE LIGHTLY
        </Link>

        <div className="hidden sm:flex items-center gap-4">
          <Link href="/map" className="text-body-sm uppercase tracking-wide text-faded hover:text-ink transition-colors font-display font-bold">
            Gap Map
          </Link>
          <Link href="/methodology" className="text-body-sm uppercase tracking-wide text-faded hover:text-ink transition-colors font-display font-bold">
            How We Score
          </Link>
          <Link
            href="/suggest"
            className="border-2 border-ink px-3 py-1.5 text-body-sm uppercase tracking-wide font-display font-bold hover:bg-ink hover:text-paper transition-colors"
          >
            Add to the Map
          </Link>
        </div>

        <button
          className="sm:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round">
            {menuOpen ? (
              <>
                <line x1="4" y1="4" x2="16" y2="16" />
                <line x1="16" y1="4" x2="4" y2="16" />
              </>
            ) : (
              <>
                <line x1="3" y1="5" x2="17" y2="5" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="15" x2="17" y2="15" />
              </>
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="sm:hidden border-t border-dashed border-buff px-4 py-3 space-y-3 bg-paper">
          <Link href="/map" className="block text-body-sm uppercase tracking-wide text-faded hover:text-ink font-display font-bold" onClick={() => setMenuOpen(false)}>
            Gap Map
          </Link>
          <Link href="/methodology" className="block text-body-sm uppercase tracking-wide text-faded hover:text-ink font-display font-bold" onClick={() => setMenuOpen(false)}>
            How We Score
          </Link>
          <Link
            href="/suggest"
            className="block border-2 border-ink px-3 py-2.5 text-body-sm uppercase tracking-wide font-display font-bold text-center hover:bg-ink hover:text-paper transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            Add to the Map
          </Link>
        </div>
      )}
    </nav>
  );
}

// ── Landing illustrations ───────────────────────────────────────────────

function MapIllustration() {
  return (
    <svg className="w-[72px] h-[52px] mx-auto mb-2 mt-3" viewBox="0 0 72 52" fill="none" aria-hidden="true">
      <rect x="6" y="10" width="60" height="36" rx="2" stroke="var(--teal)" strokeWidth="1.2" strokeDasharray="3 2" />
      <path d="M6 28Q18 24 30 28Q42 32 54 28Q60 26 66 28" stroke="var(--teal)" strokeWidth="0.8" opacity="0.3" />
      <circle cx="24" cy="24" r="3.5" fill="var(--coral)" opacity="0.6" />
      <circle cx="42" cy="20" r="3" fill="var(--teal)" opacity="0.5" />
      <circle cx="52" cy="30" r="2.5" fill="var(--cat-circular)" opacity="0.5" />
      <circle cx="18" cy="34" r="2" fill="var(--cat-food)" opacity="0.4" />
      <circle cx="38" cy="36" r="2" fill="var(--cat-daily)" opacity="0.4" />
      <path d="M30 14L30 10L33 12Z" fill="var(--coral)" opacity="0.8" />
      <line x1="30" y1="14" x2="30" y2="20" stroke="var(--coral)" strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

function GaugeIllustration() {
  return (
    <svg className="w-[72px] h-[52px] mx-auto mb-2 mt-3" viewBox="0 0 72 52" fill="none" aria-hidden="true">
      <path d="M16 40A20 20 0 0156 40" stroke="var(--buff)" strokeWidth="6" strokeLinecap="round" />
      <path d="M16 40A20 20 0 0142 21" stroke="var(--teal)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="36" cy="40" r="3.5" fill="var(--coral)" />
      <line x1="36" y1="40" x2="42" y2="24" stroke="var(--coral)" strokeWidth="2" strokeLinecap="round" />
      <text x="36" y="50" textAnchor="middle" fill="var(--ink)" fontFamily="var(--font-display)" fontWeight="800" fontSize="8">48</text>
    </svg>
  );
}

function GapsIllustration() {
  return (
    <svg className="w-[72px] h-[52px] mx-auto mb-2 mt-3" viewBox="0 0 72 52" fill="none" aria-hidden="true">
      <line x1="8" y1="32" x2="26" y2="32" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" />
      <line x1="46" y1="32" x2="64" y2="32" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="32" x2="44" y2="32" stroke="var(--coral)" strokeWidth="1.5" strokeDasharray="2 3" opacity="0.5" />
      <circle cx="36" cy="26" r="11" stroke="var(--coral)" strokeWidth="1.5" />
      <line x1="44" y1="34" x2="52" y2="42" stroke="var(--coral)" strokeWidth="2" strokeLinecap="round" />
      <text x="36" y="30" textAnchor="middle" fill="var(--coral)" fontFamily="var(--font-display)" fontWeight="800" fontSize="10">?</text>
    </svg>
  );
}

// ── Search bar (shared between landing and results) ─────────────────────

function SearchBar({
  onSearch,
  compact = false,
  initialValue = "",
}: {
  onSearch: (address: string) => void;
  compact?: boolean;
  initialValue?: string;
}) {
  const [address, setAddress] = useState(initialValue);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setShowDropdown(false);
    onSearch(address.trim());
  }

  function selectPrediction(description: string) {
    setAddress(description);
    setShowDropdown(false);
    setPredictions([]);
    onSearch(description);
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
        const res = await fetch(`/api/autocomplete?input=${encodeURIComponent(value)}`);
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
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <form onSubmit={handleSubmit} className={compact ? "w-full" : "max-w-[440px] mb-10"}>
      <div className="flex" ref={wrapperRef}>
        <div className="flex-1 relative">
          <input
            type="text"
            value={address}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (predictions.length > 0) setShowDropdown(true); }}
            onKeyDown={handleKeyDown}
            placeholder="Enter a NYC address..."
            className={`w-full px-3 bg-transparent font-body text-ink placeholder:text-faded focus:outline-none focus:ring-2 focus:ring-coral ${
              compact
                ? "py-2 text-body-sm tape-border border-r-0"
                : "py-2.5 text-body-sm tape-border border-r-0"
            }`}
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
                    i === activeIndex ? "bg-buff text-ink" : "text-faded hover:bg-buff/50"
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
          className="px-4 py-2.5 bg-coral text-paper font-display font-bold text-body-sm tracking-wider hover:brightness-110 transition-all min-h-[44px]"
        >
          EXPLORE
        </button>
      </div>
    </form>
  );
}

// ── Landing view ────────────────────────────────────────────────────────

function LandingView({ onSearch }: { onSearch: (address: string) => void }) {
  return (
    <div className="flex-1 flex items-center justify-center px-4 pt-12 sm:pt-20 pb-10">
      <div className="max-w-2xl w-full">
        <h1
          className="font-display text-title-xl sm:text-[4.2rem] md:text-[5rem] leading-[0.88] misregister text-coral"
          data-text="LIVE LIGHTLY"
        >
          LIVE LIGHTLY
        </h1>

        <p className="text-body-sm uppercase text-teal mt-3 mb-2 font-display font-bold tracking-wide">
          Your Planet-Friendly Neighborhood Map
        </p>

        <p className="text-body-base font-text text-faded max-w-[340px] mb-6">
          Find the places near you that make it easier to walk, bike,
          compost, repair, and shop locally.
        </p>

        <SearchBar onSearch={onSearch} />

        <div className="flex gap-3 flex-wrap">
          <div className="stamp zine-tilt-1 flex-1 min-w-[140px] p-3 shadow-[2px_2px_0_var(--buff)]" data-n="01">
            <MapIllustration />
            <h3 className="font-display text-label uppercase text-coral mb-1">
              We map what matters
            </h3>
            <p className="text-body-sm font-text text-faded">
              Transit, bike lanes, composting, thrift stores, and more.
            </p>
          </div>
          <div className="stamp zine-tilt-2 flex-1 min-w-[140px] p-3 bg-buff/30 shadow-[2px_2px_0_var(--buff)]" data-n="02">
            <GaugeIllustration />
            <h3 className="font-display text-label uppercase text-coral mb-1">
              We score the access
            </h3>
            <p className="text-body-sm font-text text-faded">
              Five categories. One number. Zero judgment.
            </p>
          </div>
          <div className="stamp zine-tilt-3 flex-1 min-w-[140px] p-3 shadow-[2px_2px_0_var(--buff)]" data-n="03">
            <GapsIllustration />
            <h3 className="font-display text-label uppercase text-coral mb-1">
              We show the gaps
            </h3>
            <p className="text-body-sm font-text text-faded">
              What&apos;s missing, and what the city&apos;s doing about it.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
          <Link
            href="/suggest"
            className="inline-block border-2 border-ink px-4 py-2.5 font-display font-bold text-body-sm uppercase tracking-wide hover:bg-ink hover:text-paper transition-colors min-h-[44px] flex items-center justify-center"
          >
            Add to the Map
          </Link>
          <p className="text-body-sm font-text text-faded">
            Curious how it all works?{" "}
            <Link href="/methodology" className="text-teal underline underline-offset-2">
              Read our methodology
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Custom basemap colors ───────────────────────────────────────────────

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

// ── Amenity map ─────────────────────────────────────────────────────────

function AmenityMap({
  result,
  layers,
}: {
  result: ScoreResult;
  layers: Record<string, Array<Record<string, unknown>>> | null;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mbRef = useRef<typeof mapboxgl | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    new Set([...Object.keys(AMENITY_LABELS), ...Object.keys(LAYER_LABELS)])
  );

  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    let mounted = true;
    import("mapbox-gl").then((mb) => {
      if (!mounted || !mapContainer.current) return;
      mb.default.accessToken = MAPBOX_TOKEN;
      mbRef.current = mb.default;

      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const m = new mb.default.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [result.lng, result.lat],
        zoom: 14,
      });

      mapRef.current = m;

      m.on("style.load", () => {
        applyBrandBasemap(m);
      });

      m.on("load", () => {
        const gmapsLink = (item: { name?: string; address?: string; lat: number; lng: number }) => {
          const query = item.name && item.address
            ? `${item.name}, ${item.address}`
            : item.name || item.address || `${item.lat},${item.lng}`;
          return `<br/><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer" style="color:#0B6E6F;font-size:14px;">View on Google Maps</a>`;
        };

        const homeEl = createHomeMarker();
        new mb.default.Marker({ element: homeEl })
          .setLngLat([result.lng, result.lat])
          .setPopup(new mb.default.Popup().setText(result.address))
          .addTo(m);

        const amenities = result.amenities as unknown as Record<string, Array<{ name: string; lat: number; lng: number }>>;
        for (const [category, items] of Object.entries(amenities)) {
          if (category === "bikeLanes") continue;
          const catKey = AMENITY_TO_CATEGORY[category] || "dailyNeeds";
          for (const item of items) {
            const el = createMarkerElement(catKey);
            const marker = new mb.default.Marker({ element: el })
              .setLngLat([item.lng, item.lat])
              .setPopup(
                new mb.default.Popup({ offset: 15 }).setHTML(
                  `<strong>${item.name}</strong><br/><span style="color:${CATEGORY_HEX[catKey]};font-size:14px;">${AMENITY_LABELS[category] || category}</span>${gmapsLink(item)}`
                )
              )
              .addTo(m);
            marker.getElement().dataset.category = category;
          }
        }

        // Walking radius circle
        const radiusKm = 0.8047;
        const points = 64;
        const coords: [number, number][] = [];
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * 2 * Math.PI;
          const dx = radiusKm * Math.cos(angle);
          const dy = radiusKm * Math.sin(angle);
          const lat = result.lat + dy / 111.32;
          const lng = result.lng + dx / (111.32 * Math.cos((result.lat * Math.PI) / 180));
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
          id: "radius-fill",
          type: "fill",
          source: "radius",
          paint: {
            "fill-color": "#0B6E6F",
            "fill-opacity": 0.04,
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

        const labelLat = result.lat + radiusKm / 111.32;
        m.addSource("radius-label", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: { label: "0.5 mi walking radius" },
            geometry: { type: "Point", coordinates: [result.lng, labelLat] },
          },
        });
        m.addLayer({
          id: "radius-label-text",
          type: "symbol",
          source: "radius-label",
          layout: {
            "text-field": ["get", "label"],
            "text-size": 12,
            "text-offset": [0, -0.8],
            "text-anchor": "bottom",
          },
          paint: {
            "text-color": "#9A9183",
            "text-halo-color": "#F2EBD9",
            "text-halo-width": 1.5,
          },
        });

        // Community resource layers
        if (layers) {
          const addLayerMarkers = (
            items: Array<Record<string, unknown>>,
            categoryKey: string,
            layerCat: string,
            popupFn: (item: Record<string, unknown>) => string
          ) => {
            for (const item of items) {
              if (item.lat == null || item.lng == null) continue;
              const el = createMarkerElement(layerCat);
              const marker = new mb.default.Marker({ element: el })
                .setLngLat([item.lng as number, item.lat as number])
                .setPopup(new mb.default.Popup({ offset: 15 }).setHTML(popupFn(item)))
                .addTo(m);
              marker.getElement().dataset.category = categoryKey;
            }
          };

          addLayerMarkers(
            (layers.farmersMarkets as Array<Record<string, unknown>>) || [],
            "farmersMarkets",
            LAYER_TO_CATEGORY.farmersMarkets,
            (item) => {
              let html = `<strong>${item.name || "Farmers Market"}</strong>`;
              if (item.daysHours) html += `<br/>${item.daysHours}`;
              if (item.acceptsEBT) html += `<br/><span style="background:#0B6E6F;color:#F2EBD9;padding:1px 6px;font-size:14px;">Accepts EBT</span>`;
              html += `<br/><span style="color:${CATEGORY_HEX.localFood};font-size:14px;">Farmers Market</span>`;
              return html;
            }
          );

          addLayerMarkers(
            (layers.gardens as Array<Record<string, unknown>>) || [],
            "gardens",
            LAYER_TO_CATEGORY.gardens,
            (item) => `<strong>${item.name || "Community Garden"}</strong><br/><span style="color:${CATEGORY_HEX.localFood};font-size:14px;">Community Garden</span>`
          );

          addLayerMarkers(
            (layers.parks as Array<Record<string, unknown>>) || [],
            "parks",
            LAYER_TO_CATEGORY.parks,
            (item) => `<strong>${item.name || "Park"}</strong><br/><span style="color:${CATEGORY_HEX.localFood};font-size:14px;">Park</span>`
          );

          addLayerMarkers(
            (layers.libraries as Array<Record<string, unknown>>) || [],
            "libraries",
            LAYER_TO_CATEGORY.libraries,
            (item) => `<strong>${item.name || "Library"}</strong><br/><span style="color:${CATEGORY_HEX.dailyNeeds};font-size:14px;">Library</span>`
          );

          addLayerMarkers(
            (layers.donateNyc as Array<Record<string, unknown>>) || [],
            "donateNyc",
            LAYER_TO_CATEGORY.donateNyc,
            (item) => `<strong>${item.name || "Donation Center"}</strong><br/><span style="color:${CATEGORY_HEX.circularEconomy};font-size:14px;">Donation Center</span>`
          );

          addLayerMarkers(
            (layers.repairCafes as Array<Record<string, unknown>>) || [],
            "repairCafes",
            LAYER_TO_CATEGORY.repairCafes,
            (item) => `<strong>${item.name || "Repair Cafe"}</strong><br/><span style="color:${CATEGORY_HEX.circularEconomy};font-size:14px;">Repair Cafe</span>`
          );
        }
      });

      return () => {
        mounted = false;
        m.remove();
      };
    });

    return () => {
      mounted = false;
      if (mapRef.current) mapRef.current.remove();
    };
  }, [result, layers]);

  useEffect(() => {
    if (!mapRef.current) return;
    const markers = mapRef.current.getContainer().querySelectorAll(".mapboxgl-marker");
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
          {Object.entries(AMENITY_LABELS).map(([key, label]) => {
            const catKey = AMENITY_TO_CATEGORY[key];
            const color = CATEGORY_HEX[catKey];
            return (
              <button
                key={key}
                onClick={() => toggleLayer(key)}
                className={`text-body-sm px-3 py-2 min-h-[44px] transition-colors font-display font-bold uppercase tracking-wide ${
                  visibleLayers.has(key)
                    ? "text-paper"
                    : "border border-dashed border-faded text-faded"
                }`}
                style={visibleLayers.has(key) ? { backgroundColor: color } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
        {layers && (
          <>
            <p className="text-body-sm text-faded mt-2.5 mb-1.5 uppercase tracking-wide font-display font-bold">
              Community Resources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(LAYER_LABELS).map(([key, label]) => {
                const catKey = LAYER_TO_CATEGORY[key];
                const color = CATEGORY_HEX[catKey];
                return (
                  <button
                    key={key}
                    onClick={() => toggleLayer(key)}
                    className={`text-body-sm px-3 py-2 min-h-[44px] transition-colors font-display font-bold uppercase tracking-wide ${
                      visibleLayers.has(key)
                        ? "text-paper"
                        : "border border-dashed border-faded text-faded"
                    }`}
                    style={visibleLayers.has(key) ? { backgroundColor: color } : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      {MAPBOX_TOKEN ? (
        <div ref={mapContainer} className="h-[350px] sm:h-[450px] w-full" />
      ) : (
        <div className="h-[350px] sm:h-[450px] w-full flex items-center justify-center bg-buff text-faded font-display text-body-sm uppercase tracking-wide">
          Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the map
        </div>
      )}
    </div>
  );
}

// ── Merged breakdown (What's Nearby + Category Breakdown) ───────────────

function MergedBreakdown({
  result,
}: {
  result: ScoreResult;
}) {
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(result.amenities)) {
    if (Array.isArray(value)) counts[key] = value.length;
  }

  return (
    <div>
      <h2 className="font-display font-bold text-section uppercase border-b-2 border-ink pb-1 mb-2">
        What&apos;s Nearby
      </h2>
      <div className="space-y-0">
        {MERGED_CATEGORIES.map((cat) => {
          const total = cat.amenityKeys.reduce((sum, k) => sum + (counts[k] || 0), 0);
          const meta = CATEGORY_META[cat.key];
          const points = result.breakdown[cat.key as keyof typeof result.breakdown] || 0;
          const pct = meta ? (points / meta.max) * 100 : 0;
          const Icon = CATEGORY_ICONS[cat.key];
          const color = CATEGORY_CSS[cat.key];

          return (
            <div key={cat.key} className="py-3 border-b border-dashed border-buff">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {Icon && <Icon size={22} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-display font-bold text-body-sm uppercase tracking-wide">
                      {cat.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-display font-extrabold text-lg"
                        style={{ color }}
                      >
                        {total}
                      </span>
                      {meta && (
                        <span className="text-body-sm text-faded">
                          {points}/{meta.max} pts
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-body-sm font-text text-faded mb-1.5">
                    {cat.description(counts, result.amenities)}
                  </p>
                  <div className="score-bar rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Score section (below breakdown) ─────────────────────────────────────

function ScoreNarrative({ result }: { result: ScoreResult }) {
  const parts: string[] = [];
  const a = result.amenities;

  const transitTotal = a?.transitStops?.length || 0;
  if (transitTotal > 0) {
    const subways = a.transitStops.filter((s) => s.type === "subway").length;
    const buses = a.transitStops.filter((s) => s.type === "bus").length;
    const breakdown: string[] = [];
    if (subways > 0) breakdown.push(`${subways} subway`);
    if (buses > 0) breakdown.push(`${buses} bus`);
    if (breakdown.length > 0) {
      parts.push(`${transitTotal} transit stop${transitTotal > 1 ? "s" : ""} (${breakdown.join(", ")})`);
    } else {
      parts.push(`${transitTotal} transit stop${transitTotal > 1 ? "s" : ""}`);
    }
  }

  const bikeShares = a?.bikeShares?.length || 0;
  if (bikeShares > 0) parts.push(`${bikeShares} bike share dock${bikeShares > 1 ? "s" : ""}`);

  const groceries = a?.groceries?.length || 0;
  if (groceries > 0) parts.push(`${groceries} grocery store${groceries > 1 ? "s" : ""}`);

  const gardens = a?.communityGardens?.length || 0;
  if (gardens > 0) parts.push(`${gardens} community garden${gardens > 1 ? "s" : ""}`);

  const compost = a?.compostSites?.length || 0;
  if (compost > 0) parts.push("a composting drop-off");

  if (parts.length === 0) {
    return (
      <p className="text-body-base font-text text-faded mt-3 max-w-[460px] mx-auto leading-relaxed">
        This area has limited planet-friendly infrastructure right now. Every
        neighborhood deserves access to sustainable options, and knowing the
        gaps is the first step toward change.
      </p>
    );
  }

  const listed =
    parts.length <= 2
      ? parts.join(" and ")
      : parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];

  return (
    <p className="text-body-base font-text text-faded mt-3 max-w-[460px] mx-auto leading-relaxed">
      Your neighborhood has {listed} within walking distance, a foundation
      for living lightly. The score reflects both what&apos;s already here
      and where there&apos;s room to grow.
    </p>
  );
}

function ScoreSection({ result }: { result: ScoreResult }) {
  const label = getScoreLabel(result.score);
  const color = getScoreColor(result.score);
  const bandDef = getScoreBandDef(result.score);
  const [shared, setShared] = useState(false);

  function handleShare() {
    const text = `My neighborhood scored ${result.score}/100 on Live Lightly.`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: "Live Lightly Score", text, url: window.location.href }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).then(() => {
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      });
    }
  }

  return (
    <div className="text-center py-6 border-2 border-ink grain relative">
      <span className="absolute -top-3 left-4 bg-paper px-2 font-display font-bold text-body-sm tracking-[0.1em] uppercase text-faded">
        Your Score
      </span>
      <div className="flex items-baseline justify-center gap-1">
        <span
          className="font-display font-extrabold text-score-hero misregister"
          style={{ color }}
          data-text={result.score.toString()}
        >
          {result.score}
        </span>
        <span className="font-display font-extrabold text-[2rem] text-faded opacity-40">
          / 100
        </span>
      </div>
      <div className="mt-2">
        <span
          className="inline-block px-3 py-1 border-2 border-dashed text-body-sm uppercase tracking-[0.12em] font-display font-bold"
          style={{ borderColor: color, color }}
        >
          {label}
        </span>
      </div>
      <p className="text-body-sm font-text text-faded mt-2">{bandDef}</p>
      <p className="text-body-sm font-text text-faded mt-1">{result.address}</p>
      <ScoreNarrative result={result} />
      <button
        onClick={handleShare}
        className="mt-4 inline-flex items-center gap-2 border border-ink px-4 py-2 text-body-sm font-display font-bold uppercase tracking-wide hover:bg-ink hover:text-paper transition-colors min-h-[44px]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 8L8 4L12 8" />
          <line x1="8" y1="4" x2="8" y2="14" />
          <path d="M2 10V13H14V10" />
        </svg>
        {shared ? "Link copied!" : "Share score"}
      </button>
    </div>
  );
}

// ── Reference neighborhood ──────────────────────────────────────────────

function ReferenceNeighborhood({ result }: { result: ScoreResult }) {
  if (!result.referenceNeighborhood || !result.borough) return null;
  const ref = result.referenceNeighborhood;
  const diff = ref.score - result.score;

  return (
    <div className="border-2 border-ink p-4 relative torn-edge shadow-[3px_3px_0_var(--buff)]">
      <span className="absolute -top-2.5 left-3 bg-paper px-1.5 font-display font-bold text-body-sm tracking-[0.1em] uppercase text-faded">
        How You Compare
      </span>
      <div className="flex items-center justify-center gap-4">
        <div className="flex-1 text-center">
          <div className="text-body-sm font-display font-bold uppercase tracking-wide text-faded mb-1">
            Your Neighborhood
          </div>
          <div
            className="font-display font-extrabold text-[2.6rem] leading-none"
            style={{ color: getScoreColor(result.score) }}
          >
            {result.score}
          </div>
        </div>
        <span className="font-display font-extrabold text-body-base text-buff select-none">VS</span>
        <div className="flex-1 text-center">
          <div className="text-body-sm font-display font-bold uppercase tracking-wide text-faded mb-1">
            {ref.name}
          </div>
          <div
            className="font-display font-extrabold text-[2.6rem] leading-none"
            style={{ color: getScoreColor(ref.score) }}
          >
            {ref.score}
          </div>
        </div>
      </div>
      <p className="text-center text-body-sm font-text text-faded mt-2">
        Highest-scoring neighborhood in {result.borough}
        {diff > 0 && `, ${diff} point${diff !== 1 ? "s" : ""} ahead`}
      </p>
      {diff > 0 && (
        <p className="text-center text-body-sm font-text text-faded mt-1">
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

// ── Equity panel ────────────────────────────────────────────────────────

function EquityPanel({ equity }: { equity: ScoreResult["equity"] }) {
  const incomePct = Math.round((equity.median_income / equity.nyc_median_income) * 100);
  return (
    <div>
      <h2 className="font-display font-bold text-section uppercase border-b-2 border-ink pb-1 mb-2">
        Equity Context
      </h2>
      <p className="text-body-base font-text text-faded mb-3">
        Who lives here matters. Scores mean different things in different communities.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border border-ink p-3 shadow-[3px_3px_0_var(--buff)] zine-tilt-1">
          <p className="text-body-sm uppercase text-faded font-display font-bold">Median Household Income</p>
          <p className="font-display font-extrabold text-xl">${equity.median_income.toLocaleString()}</p>
          <p className="text-body-sm font-text text-faded">{incomePct}% of NYC median (${equity.nyc_median_income.toLocaleString()})</p>
        </div>
        <div className="border-2 border-dashed border-coral p-3 bg-coral/5 zine-tilt-2">
          <p className="text-body-sm uppercase text-faded font-display font-bold">Displacement Risk</p>
          <p className="font-display font-extrabold text-xl capitalize">{equity.displacement_risk}</p>
        </div>
        <div className="tape-border p-3 zine-tilt-3">
          <p className="text-body-sm uppercase text-faded font-display font-bold">Rent Burden</p>
          <p className="font-display font-extrabold text-xl">{equity.rent_burden_pct}%</p>
          <p className="text-body-sm font-text text-faded">of households paying &gt;30% of income on rent</p>
        </div>
        <div className="border border-dashed border-faded p-3 cut-corner bg-buff/30">
          <p className="text-body-sm uppercase text-faded font-display font-bold">% White Population</p>
          <p className="font-display font-extrabold text-xl">{equity.pct_white}%</p>
        </div>
      </div>
    </div>
  );
}

// ── Gap list ────────────────────────────────────────────────────────────

function GapList({ gaps }: { gaps: string[] }) {
  return (
    <div>
      <h2 className="font-display font-bold text-section uppercase border-b-2 border-ink pb-1 mb-1">
        What&apos;s Missing
      </h2>
      {gaps.length === 0 ? (
        <p className="text-body-sm font-text text-faded py-2">No major gaps identified.</p>
      ) : (
        <div>
          {gaps.map((gap, i) => (
            <div key={i} className="flex items-start gap-2 py-2 border-t border-dashed border-buff text-body-sm font-text">
              <span className="w-[7px] h-[7px] rounded-full bg-coral flex-shrink-0 mt-1.5" />
              <span className="text-faded">{gap}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 pt-3 border-t border-dashed border-buff text-body-sm font-text text-faded">
        <p>
          Report infrastructure needs via{" "}
          <a href="https://portal.311.nyc.gov/" target="_blank" rel="noopener noreferrer" className="text-teal underline underline-offset-2">
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

// ── Policy section ──────────────────────────────────────────────────────

interface Initiative {
  title: string;
  description: string;
  timeline: string;
  matchesGap: (gap: string) => boolean;
}

const INITIATIVES: Initiative[] = [
  {
    title: "NYC Streets Plan: Protected Bike Lanes Expansion",
    description: "The city is required to build 250 miles of protected bike lanes by 2026 under the Streets Plan law, with a focus on high-injury corridors and transit deserts.",
    timeline: "Ongoing through 2026",
    matchesGap: (g) => /bike lane/i.test(g),
  },
  {
    title: "Curbside Composting: Citywide Rollout",
    description: "DSNY's curbside composting program is expanding borough by borough. All five boroughs now have curbside food scrap collection.",
    timeline: "Citywide",
    matchesGap: (g) => /compost/i.test(g),
  },
  {
    title: "MTA Fast Forward Plan: Subway Accessibility and Frequency",
    description: "The MTA's capital plan includes signal modernization on key lines, bus network redesigns, and new ADA-accessible stations to improve transit frequency and coverage.",
    timeline: "Through 2029",
    matchesGap: (g) => /subway|bus|transit/i.test(g),
  },
  {
    title: "FRESH Program: Grocery Store Incentives",
    description: "The Food Retail Expansion to Support Health (FRESH) program offers tax incentives and zoning flexibility to attract grocery stores to underserved neighborhoods.",
    timeline: "Ongoing",
    matchesGap: (g) => /grocery/i.test(g),
  },
  {
    title: "Community Health Center Expansion",
    description: "NYC Health + Hospitals is expanding Federally Qualified Health Centers in underserved areas, with several new sites planned in Brooklyn and the Bronx.",
    timeline: "New sites opening 2025 to 2027",
    matchesGap: (g) => /clinic|health/i.test(g),
  },
  {
    title: "GreenThumb: Community Garden Support",
    description: "NYC Parks' GreenThumb program supports 500+ community gardens citywide and is actively helping neighborhoods start new gardens on vacant lots.",
    timeline: "Ongoing, new gardens each season",
    matchesGap: (g) => /community garden/i.test(g),
  },
  {
    title: "Zero Waste NYC: Reuse and Refill Infrastructure",
    description: "The city's zero-waste goals include expanding reuse centers, supporting refill shops, and piloting water bottle refill stations at parks and transit hubs.",
    timeline: "Pilots through 2026",
    matchesGap: (g) => /refill|zero-waste|water/i.test(g),
  },
];

function PolicySection({ gaps }: { gaps: string[] }) {
  const relevant = INITIATIVES.filter((init) => gaps.some((gap) => init.matchesGap(gap)));
  if (relevant.length === 0) return null;

  return (
    <div>
      <h2 className="font-display font-bold text-section uppercase border-b-2 border-ink pb-1 mb-1">
        What&apos;s Being Done
      </h2>
      <p className="text-body-sm font-text text-faded mb-3">
        City initiatives working to close these gaps.
      </p>
      <div className="space-y-3">
        {relevant.map((init, i) => (
          <div key={i} className="border-l-2 border-teal pl-3 py-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display font-bold text-body-sm uppercase">{init.title}</h3>
              <span className="text-body-sm text-teal border border-dashed border-teal px-1.5 py-0.5 whitespace-nowrap font-display font-bold">
                {init.timeline}
              </span>
            </div>
            <p className="text-body-sm font-text text-faded mt-1">{init.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Results view ────────────────────────────────────────────────────────

function ResultsView({
  address,
  onSearch,
}: {
  address: string;
  onSearch: (address: string) => void;
}) {
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [layers, setLayers] = useState<Record<string, Array<Record<string, unknown>>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setResult(null);
    setLayers(null);

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
          if (layersRes.ok) setLayers(await layersRes.json());
        } catch {
          // Layers are optional
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [address]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-5">
      <div className="mb-4">
        <SearchBar onSearch={onSearch} compact initialValue={address} />
      </div>

      {loading && (
        <div className="text-center py-20">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-coral border-t-transparent" />
          <p className="mt-4 text-faded text-body-base font-text">Mapping your neighborhood...</p>
        </div>
      )}

      {error && (
        <div className="text-center py-20">
          <p className="text-coral text-section font-display">{error}</p>
          <button
            onClick={() => onSearch("")}
            className="text-teal underline underline-offset-2 mt-2 inline-block text-body-sm font-text"
          >
            Try another address
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <AmenityMap result={result} layers={layers} />
          <MergedBreakdown result={result} />

          <div className="tape-border p-5 text-center grain zine-tilt-2 bg-buff/20">
            <p className="font-display font-bold text-body-sm uppercase tracking-wide text-coral mb-1">
              Something missing?
            </p>
            <p className="text-body-base font-text text-faded mb-3">
              Know a spot that should be on the map?
            </p>
            <Link
              href="/suggest"
              className="inline-block border-2 border-ink px-4 py-2.5 font-display font-bold text-body-sm uppercase tracking-wide hover:bg-ink hover:text-paper transition-colors min-h-[44px]"
            >
              Add to the Map
            </Link>
          </div>

          <ScoreSection result={result} />
          <ReferenceNeighborhood result={result} />
          {result.equity && <EquityPanel equity={result.equity} />}
          <GapList gaps={result.gaps} />
          <PolicySection gaps={result.gaps} />
        </div>
      )}
    </div>
  );
}

// ── Page content (switches between landing and results) ─────────────────

function PageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const addressParam = searchParams.get("address");

  function handleSearch(address: string) {
    if (!address) {
      router.push("/");
      return;
    }
    router.push(`/?address=${encodeURIComponent(address)}`);
  }

  return (
    <main className="min-h-screen grain bg-paper">
      <Nav />
      {addressParam ? (
        <ResultsView address={decodeURIComponent(addressParam)} onSearch={handleSearch} />
      ) : (
        <LandingView onSearch={handleSearch} />
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen grain bg-paper">
          <div className="border-b-2 border-ink bg-paper sticky top-0 z-50">
            <div className="max-w-4xl mx-auto px-4 py-2.5">
              <span className="font-display font-extrabold text-[1rem] text-coral">LIVE LIGHTLY</span>
            </div>
          </div>
        </main>
      }
    >
      <PageContent />
    </Suspense>
  );
}
