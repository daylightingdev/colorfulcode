export interface ScoreResult {
  address: string;
  lat: number;
  lng: number;
  tract: string;
  score: number;
  breakdown: {
    transit: number;
    activeMobility: number;
    dailyNeeds: number;
    circularEconomy: number;
    localFood: number;
    cleanEnergy: number;
  };
  amenities: {
    transitStops: Amenity[];
    bikeLanes: BikeLane[];
    bikeShares: Amenity[];
    groceries: Amenity[];
    pharmacies: Amenity[];
    clinics: Amenity[];
    laundromats: Amenity[];
    thriftStores: Amenity[];
    compostSites: Amenity[];
    refillShops: Amenity[];
    communityGardens: Amenity[];
    coops: Amenity[];
    csaPickups: Amenity[];
    evCharging: Amenity[];
    waterStations: Amenity[];
  };
  equity: {
    median_income: number;
    nyc_median_income: number;
    displacement_risk: string;
    rent_burden_pct: number;
    pct_white: number;
  };
  gaps: string[];
}

export interface Amenity {
  name: string;
  lat: number;
  lng: number;
  type?: string;
  distance?: number;
}

export interface BikeLane {
  protection_level: "protected" | "painted" | "shared";
  coords: [number, number][];
}

export const CATEGORY_META: Record<
  string,
  { label: string; max: number; color: string }
> = {
  transit: { label: "Transit", max: 30, color: "#3b82f6" },
  activeMobility: { label: "Active Mobility", max: 20, color: "#8b5cf6" },
  dailyNeeds: { label: "Daily Needs", max: 20, color: "#f59e0b" },
  circularEconomy: { label: "Circular Economy", max: 15, color: "#10b981" },
  localFood: { label: "Local Food", max: 10, color: "#ef4444" },
  cleanEnergy: { label: "Clean Energy", max: 5, color: "#06b6d4" },
};

export const MOCK_RESULT: ScoreResult = {
  address: "793 Franklin Ave, Brooklyn, NY 11238",
  lat: 40.6714,
  lng: -73.9577,
  tract: "36047029500",
  score: 48,
  breakdown: {
    transit: 21,
    activeMobility: 6,
    dailyNeeds: 11,
    circularEconomy: 3,
    localFood: 5,
    cleanEnergy: 2,
  },
  amenities: {
    transitStops: [
      { name: "Franklin Ave (C)", lat: 40.6706, lng: -73.9579, type: "subway" },
      { name: "Nostrand Ave (A/C)", lat: 40.6699, lng: -73.9505, type: "subway" },
      { name: "Clinton-Washington (C)", lat: 40.6832, lng: -73.9659, type: "subway" },
      { name: "B65 Bus - Franklin Ave", lat: 40.6720, lng: -73.9582, type: "bus" },
    ],
    bikeLanes: [
      { protection_level: "painted", coords: [[-73.958, 40.670], [-73.958, 40.675]] },
      { protection_level: "shared", coords: [[-73.955, 40.668], [-73.960, 40.668]] },
    ],
    bikeShares: [
      { name: "Citi Bike - Franklin Ave & Eastern Pkwy", lat: 40.6710, lng: -73.9585 },
      { name: "Citi Bike - Classon Ave & Lafayette Ave", lat: 40.6890, lng: -73.9600 },
    ],
    groceries: [
      { name: "Associated Supermarket", lat: 40.6725, lng: -73.9555, distance: 0.15 },
      { name: "C-Town Supermarkets", lat: 40.6680, lng: -73.9520, distance: 0.35 },
    ],
    pharmacies: [
      { name: "Rite Aid", lat: 40.6730, lng: -73.9560, distance: 0.12 },
    ],
    clinics: [
      { name: "SUNY Downstate Urgent Care", lat: 40.6560, lng: -73.9440, distance: 0.9 },
    ],
    laundromats: [
      { name: "Crown Heights Laundromat", lat: 40.6700, lng: -73.9590, distance: 0.08 },
    ],
    thriftStores: [
      { name: "Goodwill - Flatbush", lat: 40.6620, lng: -73.9610, distance: 0.6 },
    ],
    compostSites: [],
    refillShops: [],
    communityGardens: [
      { name: "Hattie Carthan Community Garden", lat: 40.6780, lng: -73.9490, distance: 0.4 },
      { name: "Jackie Robinson Garden", lat: 40.6750, lng: -73.9530, distance: 0.25 },
    ],
    coops: [],
    csaPickups: [
      { name: "Crown Heights CSA", lat: 40.6730, lng: -73.9500, distance: 0.3 },
    ],
    evCharging: [
      { name: "ChargePoint - Pacific St", lat: 40.6810, lng: -73.9700, distance: 0.7 },
    ],
    waterStations: [],
  },
  equity: {
    median_income: 38400,
    nyc_median_income: 70600,
    displacement_risk: "high",
    rent_burden_pct: 54,
    pct_white: 18,
  },
  gaps: [
    "No protected bike lanes within 0.25 miles",
    "No composting drop-off site within 0.5 miles",
    "No refill/zero-waste shop within 1 mile",
    "No food co-op within 0.5 miles",
    "Only one health clinic within 1 mile",
    "No public water refill station nearby",
  ],
};

// Mock tract scores for gap map choropleth
export const MOCK_TRACT_SCORES: Record<string, { score: number; lat: number; lng: number }> = {
  "36047029500": { score: 48, lat: 40.6714, lng: -73.9577 },
  "36047029300": { score: 52, lat: 40.6750, lng: -73.9500 },
  "36047029700": { score: 38, lat: 40.6680, lng: -73.9620 },
  "36047029900": { score: 61, lat: 40.6830, lng: -73.9580 },
  "36047023900": { score: 72, lat: 40.6880, lng: -73.9770 },
  "36047024100": { score: 67, lat: 40.6900, lng: -73.9710 },
  "36047030100": { score: 33, lat: 40.6640, lng: -73.9550 },
  "36047030300": { score: 29, lat: 40.6600, lng: -73.9480 },
  "36047028500": { score: 55, lat: 40.6790, lng: -73.9650 },
  "36047028700": { score: 44, lat: 40.6760, lng: -73.9700 },
  "36061006500": { score: 85, lat: 40.7580, lng: -73.9855 },
  "36061006900": { score: 82, lat: 40.7620, lng: -73.9800 },
  "36061009300": { score: 78, lat: 40.7500, lng: -73.9900 },
  "36061015500": { score: 45, lat: 40.7300, lng: -73.9950 },
  "36061016100": { score: 41, lat: 40.7200, lng: -74.0000 },
  "36081050100": { score: 35, lat: 40.7160, lng: -73.8260 },
  "36081050300": { score: 28, lat: 40.7100, lng: -73.8200 },
  "36081045700": { score: 53, lat: 40.7450, lng: -73.8900 },
  "36081042900": { score: 62, lat: 40.7550, lng: -73.8800 },
  "36005003600": { score: 22, lat: 40.8300, lng: -73.8500 },
  "36005003800": { score: 18, lat: 40.8350, lng: -73.8450 },
  "36005012100": { score: 31, lat: 40.8600, lng: -73.8900 },
  "36085002600": { score: 25, lat: 40.5820, lng: -74.1160 },
  "36085002800": { score: 20, lat: 40.5750, lng: -74.1200 },
  "36085014200": { score: 37, lat: 40.6300, lng: -74.0770 },
};
