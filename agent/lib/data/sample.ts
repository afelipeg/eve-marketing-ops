import type { BudgetEnvelope, KpiRecord } from "../types";

/**
 * SAMPLE DATA — not the client's numbers.
 *
 * Exists so the orchestrator is runnable before a warehouse is connected.
 * Every tool that serves these rows stamps `provenance: "sample"`, and the
 * instructions require the agent to disclose that before reasoning on them.
 *
 * Point MARKETING_DATA_DIR at a directory holding `kpi-history.json` and
 * `budget.json` to serve real data instead.
 */

export const SAMPLE_KPI_HISTORY: KpiRecord[] = [
  { period: "2026-Q2", brand: "Andina", category: "beverages", territory: "CO-Bogota", service: "advertisements", currency: "USD", spend: 180_000, revenue: 742_000, grossMargin: 260_000, units: 410_000, orders: 96_000, newCustomers: 21_400, returningCustomers: 74_600, upliftPct: 6.1, significance: "significant" },
  { period: "2026-Q2", brand: "Andina", category: "beverages", territory: "CO-Bogota", service: "promotions", currency: "USD", spend: 145_000, revenue: 690_000, grossMargin: 188_000, units: 470_000, orders: 103_000, newCustomers: 9_800, returningCustomers: 93_200, upliftPct: 1.2, significance: "not-significant" },
  { period: "2026-Q2", brand: "Andina", category: "beverages", territory: "CO-Bogota", service: "pricing", currency: "USD", spend: 20_000, revenue: 810_000, grossMargin: 322_000, units: 398_000, orders: 99_000, newCustomers: 7_100, returningCustomers: 91_900, upliftPct: 4.4, significance: "significant" },
  { period: "2026-Q2", brand: "Andina", category: "beverages", territory: "CO-Bogota", service: "baseline", currency: "USD", spend: 0, revenue: 2_140_000, grossMargin: 735_000, units: 1_290_000, orders: 288_000, newCustomers: 24_000, returningCustomers: 264_000, upliftPct: null, significance: "untested" },
  { period: "2026-Q2", brand: "Sierra", category: "snacks", territory: "CO-Bogota", service: "recommendations", currency: "USD", spend: 62_000, revenue: 388_000, grossMargin: 151_000, units: 205_000, orders: 61_000, newCustomers: 4_200, returningCustomers: 56_800, upliftPct: 8.7, significance: "significant" },
  { period: "2026-Q2", brand: "Sierra", category: "snacks", territory: "CO-Bogota", service: "baseline", currency: "USD", spend: 0, revenue: 1_020_000, grossMargin: 352_000, units: 596_000, orders: 168_000, newCustomers: 15_600, returningCustomers: 152_400, upliftPct: null, significance: "untested" },
  { period: "2026-Q1", brand: "Andina", category: "beverages", territory: "CO-Bogota", service: "advertisements", currency: "USD", spend: 165_000, revenue: 651_000, grossMargin: 224_000, units: 372_000, orders: 88_000, newCustomers: 18_900, returningCustomers: 69_100, upliftPct: 5.4, significance: "significant" },
  { period: "2026-Q1", brand: "Andina", category: "beverages", territory: "CO-Bogota", service: "promotions", currency: "USD", spend: 152_000, revenue: 705_000, grossMargin: 181_000, units: 489_000, orders: 108_000, newCustomers: 10_200, returningCustomers: 97_800, upliftPct: 1.6, significance: "not-significant" },
  { period: "2026-Q1", brand: "Sierra", category: "snacks", territory: "CO-Bogota", service: "recommendations", currency: "USD", spend: 55_000, revenue: 331_000, grossMargin: 128_000, units: 177_000, orders: 53_000, newCustomers: 3_700, returningCustomers: 49_300, upliftPct: 7.9, significance: "significant" },
  { period: "2026-Q2", brand: "Andina", category: "beverages", territory: "CO-Medellin", service: "advertisements", currency: "USD", spend: 96_000, revenue: 352_000, grossMargin: 121_000, units: 196_000, orders: 44_000, newCustomers: 9_900, returningCustomers: 34_100, upliftPct: 4.8, significance: "significant" },
  { period: "2026-Q2", brand: "Andina", category: "beverages", territory: "CO-Medellin", service: "promotions", currency: "USD", spend: 88_000, revenue: 341_000, grossMargin: 88_000, units: 232_000, orders: 51_000, newCustomers: 4_400, returningCustomers: 46_600, upliftPct: 0.7, significance: "not-significant" },
  { period: "2026-Q2", brand: "Sierra", category: "snacks", territory: "CO-Medellin", service: "recommendations", currency: "USD", spend: 31_000, revenue: 182_000, grossMargin: 71_000, units: 97_000, orders: 29_000, newCustomers: 2_000, returningCustomers: 27_000, upliftPct: 9.2, significance: "significant" },
  { period: "2026-Q2", brand: "Sierra", category: "snacks", territory: "CO-Medellin", service: "baseline", currency: "USD", spend: 0, revenue: 486_000, grossMargin: 168_000, units: 284_000, orders: 80_000, newCustomers: 7_400, returningCustomers: 72_600, upliftPct: null, significance: "untested" },
];

export const SAMPLE_BUDGET: BudgetEnvelope[] = [
  { period: "2026-Q3", territory: "CO-Bogota", service: "advertisements", currency: "USD", planned: 210_000, committed: 40_000, spent: 0 },
  { period: "2026-Q3", territory: "CO-Bogota", service: "promotions", currency: "USD", planned: 150_000, committed: 15_000, spent: 0 },
  { period: "2026-Q3", territory: "CO-Bogota", service: "recommendations", currency: "USD", planned: 70_000, committed: 0, spent: 0 },
  { period: "2026-Q3", territory: "CO-Bogota", service: "pricing", currency: "USD", planned: 45_000, committed: 0, spent: 0 },
  { period: "2026-Q3", territory: "CO-Bogota", service: "measurement", currency: "USD", planned: 60_000, committed: 5_000, spent: 0 },
  { period: "2026-Q3", territory: "CO-Medellin", service: "advertisements", currency: "USD", planned: 110_000, committed: 0, spent: 0 },
  { period: "2026-Q3", territory: "CO-Medellin", service: "promotions", currency: "USD", planned: 80_000, committed: 0, spent: 0 },
  { period: "2026-Q3", territory: "CO-Medellin", service: "recommendations", currency: "USD", planned: 40_000, committed: 0, spent: 0 },
  { period: "2026-Q3", territory: "CO-Medellin", service: "measurement", currency: "USD", planned: 30_000, committed: 0, spent: 0 },
];
