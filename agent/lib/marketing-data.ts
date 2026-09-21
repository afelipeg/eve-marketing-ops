import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { SAMPLE_BUDGET, SAMPLE_KPI_HISTORY } from "./data/sample";
import {
  budgetEnvelopeSchema,
  kpiRecordSchema,
  type BudgetEnvelope,
  type KpiRecord,
  type Provenance,
} from "./types";

/**
 * Data access for the orchestrator.
 *
 * Resolution order:
 *  1. MARKETING_DATA_DIR — a directory holding `kpi-history.json` and
 *     `budget.json`. Served as provenance "external".
 *  2. Bundled sample rows. Served as provenance "sample".
 *
 * Swap step 1 for a warehouse/MCP client when the real source is chosen; the
 * tool surface does not change.
 */

export type DataSet<T> = {
  rows: T[];
  provenance: Provenance;
  source: string;
  warning?: string;
};

const dataDir = () => process.env.MARKETING_DATA_DIR?.trim() || null;

async function loadJson<T>(
  fileName: string,
  schema: z.ZodType<T>,
  fallback: T[],
): Promise<DataSet<T>> {
  const dir = dataDir();
  if (!dir) {
    return {
      rows: fallback,
      provenance: "sample",
      source: "bundled sample dataset",
      warning:
        "SAMPLE DATA — not the client's real numbers. Set MARKETING_DATA_DIR to serve real data. Disclose this before using any figure below.",
    };
  }

  const path = join(dir, fileName);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(
      `MARKETING_DATA_DIR is set but ${path} could not be read: ${
        error instanceof Error ? error.message : String(error)
      }. Fix the path or unset MARKETING_DATA_DIR to fall back to sample data.`,
    );
  }

  const parsed = z.array(schema).safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(
      `${path} does not match the expected schema: ${parsed.error.message}`,
    );
  }

  return { rows: parsed.data, provenance: "external", source: path };
}

export const loadKpiHistory = () =>
  loadJson<KpiRecord>("kpi-history.json", kpiRecordSchema, SAMPLE_KPI_HISTORY);

export const loadBudget = () =>
  loadJson<BudgetEnvelope>("budget.json", budgetEnvelopeSchema, SAMPLE_BUDGET);

const round2 = (n: number) => Math.round(n * 100) / 100;
const safeDiv = (a: number, b: number) => (b === 0 ? null : round2(a / b));

/** Aggregate a KPI slice into the metrics a brief is written against. */
export function summarizeKpis(rows: KpiRecord[]) {
  const totals = rows.reduce(
    (acc, r) => ({
      spend: acc.spend + r.spend,
      revenue: acc.revenue + r.revenue,
      grossMargin: acc.grossMargin + r.grossMargin,
      units: acc.units + r.units,
      orders: acc.orders + r.orders,
      newCustomers: acc.newCustomers + r.newCustomers,
      returningCustomers: acc.returningCustomers + r.returningCustomers,
    }),
    {
      spend: 0,
      revenue: 0,
      grossMargin: 0,
      units: 0,
      orders: 0,
      newCustomers: 0,
      returningCustomers: 0,
    },
  );

  const customers = totals.newCustomers + totals.returningCustomers;

  return {
    ...totals,
    roas: safeDiv(totals.revenue, totals.spend),
    roi: totals.spend === 0 ? null : round2((totals.grossMargin - totals.spend) / totals.spend),
    grossMarginPct: safeDiv(totals.grossMargin, totals.revenue),
    aov: safeDiv(totals.revenue, totals.orders),
    cac: safeDiv(totals.spend, totals.newCustomers),
    repeatRate: safeDiv(totals.returningCustomers, customers),
    testedShareOfSpend: safeDiv(
      rows.filter((r) => r.significance === "significant").reduce((s, r) => s + r.spend, 0),
      totals.spend,
    ),
  };
}

/** Services whose measured uplift came back not-significant in the slice. */
export function notSignificantServices(rows: KpiRecord[]): string[] {
  return [
    ...new Set(
      rows
        .filter((r) => r.significance === "not-significant" && r.service !== "baseline")
        .map((r) => r.service),
    ),
  ];
}
