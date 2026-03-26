/**
 * Census tract identification and equity data lookup.
 *
 * Ideal approach: point-in-polygon on TIGER boundary GeoJSON.
 * Current approach: nearest centroid match from a pre-built tract centroid file.
 * This is accurate enough for scoring (~0.1mi precision) and avoids loading
 * a 50MB+ GeoJSON boundary file into memory.
 *
 * To upgrade: download TIGER tract boundaries, run point-in-polygon with a
 * library like @turf/boolean-point-in-polygon, and replace identifyTract().
 */

import { distanceMiles } from "./scoring";

interface TractCentroid {
  tract: string;
  lat: number;
  lng: number;
}

interface EquityData {
  median_income: number;
  nyc_median_income: number;
  pct_white: number;
  displacement_risk: string;
  rent_burden_pct: number;
}

// Load at module level
import equityByTract from "@/data/equity-by-tract.json";
import tractCentroids from "@/data/tract-centroids.json";

const EQUITY_DATA = equityByTract as Record<string, EquityData>;
const TRACT_CENTROIDS = tractCentroids as TractCentroid[];

/**
 * Find the census tract for a given lat/lng by nearest centroid.
 * Returns the FIPS code (e.g., "36047029500") or null if no tract is close enough.
 */
export function identifyTract(lat: number, lng: number): string | null {
  let bestTract: string | null = null;
  let bestDist = Infinity;

  for (const tc of TRACT_CENTROIDS) {
    const d = distanceMiles(lat, lng, tc.lat, tc.lng);
    if (d < bestDist) {
      bestDist = d;
      bestTract = tc.tract;
    }
  }

  // Only match if within ~1 mile of a known centroid
  if (bestDist > 1) return null;
  return bestTract;
}

/**
 * Look up equity data for a given census tract FIPS code.
 */
export function getEquityData(tract: string): EquityData | null {
  return EQUITY_DATA[tract] || null;
}
