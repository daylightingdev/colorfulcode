// ============================================================
// Low Carbon Access Score — scoring logic
// All weights and thresholds defined here. Tune over time.
// ============================================================

export const WEIGHTS = {
  transit: { max: 30 },
  activeMobility: { max: 20 },
  dailyNeeds: { max: 20 },
  circularEconomy: { max: 15 },
  localFood: { max: 10 },
  cleanEnergy: { max: 5 },
};

// --- Types ---

export interface TransitStop {
  stop_id?: string;
  name: string;
  lat: number;
  lng: number;
  type: "subway" | "bus" | "rail" | "ferry";
  routes?: string[];
  headway_minutes?: number;
  distance?: number;
}

export interface BikeLaneSegment {
  protection_level: "protected" | "painted" | "shared";
  coords: [number, number][];
  distance?: number;
}

export interface BikeShare {
  name: string;
  lat: number;
  lng: number;
  distance?: number;
}

export interface Place {
  name: string;
  lat: number;
  lng: number;
  type?: string;
  distance?: number;
}

export interface AmenityResults {
  transitStops: TransitStop[];
  bikeLanes: BikeLaneSegment[];
  bikeShares: BikeShare[];
  groceries: Place[];
  pharmacies: Place[];
  clinics: Place[];
  laundromats: Place[];
  thriftStores: Place[];
  compostSites: Place[];
  refillShops: Place[];
  communityGardens: Place[];
  coops: Place[];
  csaPickups: Place[];
  evCharging: Place[];
  waterStations: Place[];
}

export interface ScoreBreakdown {
  transit: number;
  activeMobility: number;
  dailyNeeds: number;
  circularEconomy: number;
  localFood: number;
  cleanEnergy: number;
}

export interface ScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
  gaps: string[];
}

// --- Helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Haversine distance in miles */
export function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Distance from a point to the nearest point on a line segment, in miles */
function distanceToSegmentMiles(
  lat: number,
  lng: number,
  coords: [number, number][]
): number {
  let minDist = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    // Project point onto segment (approximate with flat-earth for short distances)
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
      t = clamp(((lng - lng1) * dx + (lat - lat1) * dy) / len2, 0, 1);
    }
    const projLng = lng1 + t * dx;
    const projLat = lat1 + t * dy;
    const d = distanceMiles(lat, lng, projLat, projLng);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// --- Category scoring functions ---

/**
 * Transit: max 30 points
 * - Subway within 0.5mi: up to 15 pts (scaled by count and headway)
 * - Bus within 0.25mi: up to 8 pts
 * - Rail/ferry within 1mi: up to 7 pts
 */
function scoreTransit(stops: TransitStop[]): { score: number; gaps: string[] } {
  const gaps: string[] = [];

  const subways = stops.filter((s) => s.type === "subway");
  const buses = stops.filter((s) => s.type === "bus");
  const other = stops.filter((s) => s.type === "rail" || s.type === "ferry");

  // Subway scoring: base points for having any, bonus for multiple and low headway
  let subwayScore = 0;
  if (subways.length === 0) {
    gaps.push("No subway station within 0.5 miles");
  } else {
    subwayScore = Math.min(subways.length * 4, 10);
    // Headway bonus: if average headway < 6 min, +5; < 10 min, +3
    const avgHeadway =
      subways.reduce((sum, s) => sum + (s.headway_minutes || 10), 0) /
      subways.length;
    if (avgHeadway < 6) subwayScore += 5;
    else if (avgHeadway < 10) subwayScore += 3;
    subwayScore = Math.min(subwayScore, 15);
  }

  // Bus scoring
  let busScore = 0;
  if (buses.length === 0) {
    gaps.push("No bus stop within 0.25 miles");
  } else {
    busScore = Math.min(buses.length * 2, 8);
  }

  // Rail/ferry
  let otherScore = 0;
  if (other.length > 0) {
    otherScore = Math.min(other.length * 3, 7);
  }

  return {
    score: clamp(subwayScore + busScore + otherScore, 0, WEIGHTS.transit.max),
    gaps,
  };
}

/**
 * Active Mobility: max 20 points
 * - Protected bike lanes within 0.25mi: up to 8 pts
 * - Painted bike lanes within 0.25mi: up to 4 pts
 * - Bike share docks within 0.25mi: up to 8 pts
 */
function scoreActiveMobility(
  bikeLanes: BikeLaneSegment[],
  bikeShares: BikeShare[]
): { score: number; gaps: string[] } {
  const gaps: string[] = [];

  const protectedLanes = bikeLanes.filter(
    (l) => l.protection_level === "protected"
  );
  const paintedLanes = bikeLanes.filter(
    (l) => l.protection_level === "painted"
  );

  let laneScore = 0;
  if (protectedLanes.length === 0) {
    gaps.push("No protected bike lanes within 0.25 miles");
    if (paintedLanes.length > 0) {
      laneScore = Math.min(paintedLanes.length * 2, 4);
    } else {
      gaps.push("No bike lanes of any type within 0.25 miles");
    }
  } else {
    laneScore = Math.min(protectedLanes.length * 4, 8);
    laneScore += Math.min(paintedLanes.length, 4);
  }

  let shareScore = 0;
  if (bikeShares.length === 0) {
    gaps.push("No bike share dock within 0.25 miles");
  } else {
    shareScore = Math.min(bikeShares.length * 3, 8);
  }

  return {
    score: clamp(laneScore + shareScore, 0, WEIGHTS.activeMobility.max),
    gaps,
  };
}

/**
 * Daily Needs: max 20 points
 * - Grocery store within 0.5mi: up to 6 pts
 * - Pharmacy within 0.5mi: up to 5 pts
 * - Clinic within 1mi: up to 5 pts
 * - Laundromat within 0.5mi: up to 4 pts
 */
function scoreDailyNeeds(
  groceries: Place[],
  pharmacies: Place[],
  clinics: Place[],
  laundromats: Place[]
): { score: number; gaps: string[] } {
  const gaps: string[] = [];

  let groceryScore = 0;
  if (groceries.length === 0) {
    gaps.push("No grocery store within 0.5 miles");
  } else {
    groceryScore = Math.min(groceries.length * 3, 6);
  }

  let pharmacyScore = 0;
  if (pharmacies.length === 0) {
    gaps.push("No pharmacy within 0.5 miles");
  } else {
    pharmacyScore = Math.min(pharmacies.length * 3, 5);
  }

  let clinicScore = 0;
  if (clinics.length === 0) {
    gaps.push("No health clinic within 1 mile");
  } else if (clinics.length === 1) {
    clinicScore = 3;
    gaps.push("Only one health clinic within 1 mile");
  } else {
    clinicScore = Math.min(clinics.length * 2, 5);
  }

  let laundryScore = 0;
  if (laundromats.length === 0) {
    gaps.push("No laundromat within 0.5 miles");
  } else {
    laundryScore = Math.min(laundromats.length * 2, 4);
  }

  return {
    score: clamp(
      groceryScore + pharmacyScore + clinicScore + laundryScore,
      0,
      WEIGHTS.dailyNeeds.max
    ),
    gaps,
  };
}

/**
 * Circular Economy: max 15 points
 * - Thrift/secondhand stores within 0.5mi: up to 5 pts
 * - Composting drop-off within 0.5mi: up to 5 pts
 * - Refill/zero-waste shops within 1mi: up to 5 pts
 */
function scoreCircularEconomy(
  thriftStores: Place[],
  compostSites: Place[],
  refillShops: Place[]
): { score: number; gaps: string[] } {
  const gaps: string[] = [];

  let thriftScore = 0;
  if (thriftStores.length === 0) {
    gaps.push("No thrift or secondhand store within 0.5 miles");
  } else {
    thriftScore = Math.min(thriftStores.length * 2, 5);
  }

  let compostScore = 0;
  if (compostSites.length === 0) {
    gaps.push("No composting drop-off site within 0.5 miles");
  } else {
    compostScore = Math.min(compostSites.length * 3, 5);
  }

  let refillScore = 0;
  if (refillShops.length === 0) {
    gaps.push("No refill/zero-waste shop within 1 mile");
  } else {
    refillScore = Math.min(refillShops.length * 3, 5);
  }

  return {
    score: clamp(
      thriftScore + compostScore + refillScore,
      0,
      WEIGHTS.circularEconomy.max
    ),
    gaps,
  };
}

/**
 * Local Food: max 10 points
 * - Community gardens within 0.5mi: up to 4 pts
 * - Food co-ops within 0.5mi: up to 3 pts
 * - CSA pickup sites within 0.5mi: up to 3 pts
 */
function scoreLocalFood(
  communityGardens: Place[],
  coops: Place[],
  csaPickups: Place[]
): { score: number; gaps: string[] } {
  const gaps: string[] = [];

  let gardenScore = 0;
  if (communityGardens.length === 0) {
    gaps.push("No community garden within 0.5 miles");
  } else {
    gardenScore = Math.min(communityGardens.length * 2, 4);
  }

  let coopScore = 0;
  if (coops.length === 0) {
    gaps.push("No food co-op within 0.5 miles");
  } else {
    coopScore = Math.min(coops.length * 2, 3);
  }

  let csaScore = 0;
  if (csaPickups.length === 0) {
    // Not a gap — CSAs are seasonal and uncommon
  } else {
    csaScore = Math.min(csaPickups.length * 2, 3);
  }

  return {
    score: clamp(
      gardenScore + coopScore + csaScore,
      0,
      WEIGHTS.localFood.max
    ),
    gaps,
  };
}

/**
 * Clean Energy: max 5 points
 * - EV charging stations within 0.5mi: up to 3 pts
 * - Public water refill stations within 0.25mi: up to 2 pts
 */
function scoreCleanEnergy(
  evCharging: Place[],
  waterStations: Place[]
): { score: number; gaps: string[] } {
  const gaps: string[] = [];

  let evScore = 0;
  if (evCharging.length === 0) {
    gaps.push("No EV charging station within 0.5 miles");
  } else {
    evScore = Math.min(evCharging.length * 1.5, 3);
  }

  let waterScore = 0;
  if (waterStations.length === 0) {
    gaps.push("No public water refill station nearby");
  } else {
    waterScore = Math.min(waterStations.length, 2);
  }

  return {
    score: clamp(
      Math.round(evScore + waterScore),
      0,
      WEIGHTS.cleanEnergy.max
    ),
    gaps,
  };
}

// --- Main scoring function ---

export function calculateScore(amenities: AmenityResults): ScoreResult {
  const transit = scoreTransit(amenities.transitStops);
  const activeMobility = scoreActiveMobility(
    amenities.bikeLanes,
    amenities.bikeShares
  );
  const dailyNeeds = scoreDailyNeeds(
    amenities.groceries,
    amenities.pharmacies,
    amenities.clinics,
    amenities.laundromats
  );
  const circularEconomy = scoreCircularEconomy(
    amenities.thriftStores,
    amenities.compostSites,
    amenities.refillShops
  );
  const localFood = scoreLocalFood(
    amenities.communityGardens,
    amenities.coops,
    amenities.csaPickups
  );
  const cleanEnergy = scoreCleanEnergy(
    amenities.evCharging,
    amenities.waterStations
  );

  const total =
    transit.score +
    activeMobility.score +
    dailyNeeds.score +
    circularEconomy.score +
    localFood.score +
    cleanEnergy.score;

  const allGaps = [
    ...transit.gaps,
    ...activeMobility.gaps,
    ...dailyNeeds.gaps,
    ...circularEconomy.gaps,
    ...localFood.gaps,
    ...cleanEnergy.gaps,
  ];

  return {
    total,
    breakdown: {
      transit: transit.score,
      activeMobility: activeMobility.score,
      dailyNeeds: dailyNeeds.score,
      circularEconomy: circularEconomy.score,
      localFood: localFood.score,
      cleanEnergy: cleanEnergy.score,
    },
    gaps: allGaps,
  };
}

// --- Proximity filtering helpers (used by /api/score) ---

export function filterByDistance<T extends { lat: number; lng: number }>(
  items: T[],
  lat: number,
  lng: number,
  radiusMiles: number
): (T & { distance: number })[] {
  return items
    .map((item) => ({
      ...item,
      distance: distanceMiles(lat, lng, item.lat, item.lng),
    }))
    .filter((item) => item.distance <= radiusMiles)
    .sort((a, b) => a.distance - b.distance);
}

export function filterBikeLanesByDistance(
  lanes: BikeLaneSegment[],
  lat: number,
  lng: number,
  radiusMiles: number
): BikeLaneSegment[] {
  return lanes
    .map((lane) => ({
      ...lane,
      distance: distanceToSegmentMiles(lat, lng, lane.coords),
    }))
    .filter((lane) => lane.distance! <= radiusMiles);
}
