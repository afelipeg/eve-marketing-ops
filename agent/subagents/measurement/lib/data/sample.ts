import type { ExperimentLog, JourneyLog } from "../data";

/**
 * SAMPLE DATA — not the client's numbers.
 *
 * Served with `provenance: "sample"` so the agent discloses it before quoting
 * any interval. Point MARKETING_DATA_DIR at a directory containing
 * `experiments.json` and `journeys.json` to serve real logs.
 */

export const SAMPLE_EXPERIMENTS: ExperimentLog[] = [
  {
    id: "exp-promo-2026q2-bogota",
    service: "promotions",
    hypothesis: "20% off multipack lifts purchase rate among lapsed buyers.",
    design: "randomized",
    unit: "customer",
    period: "2026-Q2",
    brand: "Andina",
    territory: "CO-Bogota",
    metric: "purchase_rate",
    cells: [
      { label: "CO-Bogota", control: { n: 42_000, conversions: 2_940, revenue: 411_600 }, treatment: { n: 41_500, conversions: 2_988, revenue: 403_650 } },
    ],
    notes: "Randomized at customer level, 50/50 split, two-week exposure window.",
  },
  {
    id: "exp-reco-2026q2-multi",
    service: "recommendations",
    hypothesis: "Cross-sell slot on checkout lifts attach rate.",
    design: "randomized",
    unit: "session",
    period: "2026-Q2",
    brand: "Sierra",
    territory: "multi",
    metric: "attach_rate",
    cells: [
      { label: "CO-Bogota", control: { n: 18_400, conversions: 1_104, revenue: 88_320 }, treatment: { n: 18_600, conversions: 1_302, revenue: 106_764 } },
      { label: "CO-Medellin", control: { n: 7_200, conversions: 396, revenue: 30_888 }, treatment: { n: 7_100, conversions: 468, revenue: 37_908 } },
      { label: "CO-Cali", control: { n: 2_100, conversions: 105, revenue: 8_190 }, treatment: { n: 2_050, conversions: 133, revenue: 10_374 } },
      { label: "CO-Barranquilla", control: { n: 640, conversions: 29, revenue: 2_262 }, treatment: { n: 655, conversions: 41, revenue: 3_198 } },
    ],
    notes: "Session-level randomization; small cells need pooling.",
  },
  {
    id: "exp-ads-2026q2-medellin",
    service: "advertisements",
    hypothesis: "Geo-held display campaign drives incremental new buyers.",
    design: "geo-holdout",
    unit: "geo",
    period: "2026-Q2",
    brand: "Andina",
    territory: "CO-Medellin",
    metric: "new_buyer_rate",
    cells: [
      { label: "CO-Medellin", control: { n: 26_000, conversions: 1_040, revenue: 83_200 }, treatment: { n: 26_400, conversions: 1_214, revenue: 97_120 } },
    ],
    notes: "Four holdout zones matched on pre-period trend.",
  },
  {
    id: "exp-pricing-2026q2-bogota",
    service: "pricing",
    hypothesis: "Price step on the 1.5L pack holds volume and lifts margin.",
    design: "observational",
    unit: "store",
    period: "2026-Q2",
    brand: "Andina",
    territory: "CO-Bogota",
    metric: "unit_sell_through",
    cells: [
      { label: "CO-Bogota", control: { n: 12_300, conversions: 4_182, revenue: 292_740 }, treatment: { n: 11_900, conversions: 4_165, revenue: 316_540 } },
    ],
    notes: "No randomization: stores self-selected into the new ladder. Confounded by traffic.",
  },
];

export const SAMPLE_JOURNEYS: JourneyLog[] = [
  { path: ["search"], converted: true, count: 820, value: 28.4 },
  { path: ["search"], converted: false, count: 9_100 },
  { path: ["advertisements"], converted: true, count: 410, value: 31.2 },
  { path: ["advertisements"], converted: false, count: 12_400 },
  { path: ["advertisements", "search"], converted: true, count: 620, value: 34.8 },
  { path: ["advertisements", "search"], converted: false, count: 4_300 },
  { path: ["search", "recommendations"], converted: true, count: 540, value: 41.9 },
  { path: ["search", "recommendations"], converted: false, count: 2_100 },
  { path: ["advertisements", "search", "recommendations"], converted: true, count: 380, value: 47.5 },
  { path: ["advertisements", "search", "recommendations"], converted: false, count: 1_450 },
  { path: ["promotions", "search"], converted: true, count: 290, value: 22.6 },
  { path: ["promotions", "search"], converted: false, count: 3_050 },
  { path: ["promotions"], converted: true, count: 160, value: 19.8 },
  { path: ["promotions"], converted: false, count: 6_700 },
  { path: ["advertisements", "promotions", "search", "recommendations"], converted: true, count: 210, value: 52.3 },
  { path: ["advertisements", "promotions", "search", "recommendations"], converted: false, count: 980 },
];
