import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { SAMPLE_COMPETITOR_PRICES, SAMPLE_PRODUCTS, SAMPLE_SALES, SAMPLE_SEGMENTS } from "./data/sample";
import {
  competitorPriceSchema,
  productSchema,
  salesRecordSchema,
  segmentSchema,
  type CompetitorPrice,
  type Product,
  type SalesRecord,
  type Segment,
} from "./types";

export type DataSet<T> = {
  rows: T[];
  provenance: "external" | "sample";
  source: string;
  warning?: string;
};

async function load<T>(fileName: string, schema: z.ZodType<T>, fallback: T[]): Promise<DataSet<T>> {
  const dir = process.env.MARKETING_DATA_DIR?.trim();
  if (!dir) {
    return {
      rows: fallback,
      provenance: "sample",
      source: "generated sample sell-out history",
      warning:
        "SAMPLE DATA — generated sell-out history, not the client's. Disclose before quoting any elasticity, price, or margin figure.",
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
      }`,
    );
  }
  const parsed = z.array(schema).safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`${path} does not match the expected schema: ${parsed.error.message}`);
  }
  return { rows: parsed.data, provenance: "external", source: path };
}

export const loadProducts = () => load<Product>("products.json", productSchema, SAMPLE_PRODUCTS);
export const loadSales = () => load<SalesRecord>("sales.json", salesRecordSchema, SAMPLE_SALES);
export const loadCompetitorPrices = () =>
  load<CompetitorPrice>("competitor_prices.json", competitorPriceSchema, SAMPLE_COMPETITOR_PRICES);
export const loadSegments = () => load<Segment>("segments.json", segmentSchema, SAMPLE_SEGMENTS);

/**
 * Build the regression frame for one SKU.
 *
 * Stockout weeks are EXCLUDED by default: observed units are censored by
 * supply on those weeks, so including them teaches the model that a high price
 * week sold little when in fact nothing was on the shelf.
 */
export function buildDemandFrame(
  sales: SalesRecord[],
  options: { excludeStockouts?: boolean; excludeZeroUnits?: boolean } = {},
) {
  const excludeStockouts = options.excludeStockouts ?? true;
  const excludeZero = options.excludeZeroUnits ?? true;

  const usable = sales.filter(
    (row) =>
      row.price > 0 &&
      row.competitorPrice > 0 &&
      (!excludeZero || row.units > 0) &&
      (!excludeStockouts || !row.stockedOut),
  );

  const observations = usable.map((row) => ({
    y: Math.log(row.units),
    x: [
      Math.log(row.price),
      Math.log(row.competitorPrice),
      row.promoted ? 1 : 0,
      Math.sin((2 * Math.PI * row.week) / 52),
      Math.cos((2 * Math.PI * row.week) / 52),
      Math.sin((4 * Math.PI * row.week) / 52),
      Math.cos((4 * Math.PI * row.week) / 52),
      row.week / 52,
    ],
  }));

  return {
    observations,
    names: [
      "ln_price",
      "ln_competitor_price",
      "promoted",
      "sin_annual",
      "cos_annual",
      "sin_semiannual",
      "cos_semiannual",
      "trend_years",
    ],
    used: usable.length,
    dropped: sales.length - usable.length,
    droppedStockoutWeeks: sales.filter((r) => r.stockedOut).length,
  };
}
