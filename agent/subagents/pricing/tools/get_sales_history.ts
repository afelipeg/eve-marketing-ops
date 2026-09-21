import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadProducts, loadSales } from "../lib/data";
import { channelSchema } from "../lib/types";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Read sell-out history by SKU, week and channel: price, competitor price, units, revenue, gross margin, promotion flag, opening inventory and stockout flag. Returns price dispersion (how much price actually varied — no variation, no elasticity) and the stockout share that censors observed demand. Always report the returned `provenance`.",
  inputSchema: z.object({
    sku: z.string().optional(),
    category: z.string().optional(),
    channel: channelSchema.optional(),
    fromWeek: z.number().min(0).optional(),
    toWeek: z.number().min(0).optional(),
    limit: z.number().int().min(0).max(300).default(20),
  }),
  label: { start: ({ sku }) => `Read sell-out history${sku ? ` · ${sku}` : ""}` },
  async execute(input) {
    const [sales, products] = await Promise.all([loadSales(), loadProducts()]);
    const bySku = new Map(products.rows.map((p) => [p.sku, p]));

    const filtered = sales.rows.filter(
      (row) =>
        (!input.sku || row.sku === input.sku) &&
        (!input.category || bySku.get(row.sku)?.category === input.category) &&
        (!input.channel || row.channel === input.channel) &&
        (input.fromWeek === undefined || row.week >= input.fromWeek) &&
        (input.toWeek === undefined || row.week <= input.toWeek),
    );
    if (filtered.length === 0) throw new Error("No sales rows match those filters.");

    const prices = filtered.map((r) => r.price).sort((a, b) => a - b);
    const meanPrice = prices.reduce((s, v) => s + v, 0) / prices.length;
    const sd = Math.sqrt(prices.reduce((s, v) => s + Math.pow(v - meanPrice, 2), 0) / prices.length);
    const units = filtered.reduce((s, r) => s + r.units, 0);
    const revenue = filtered.reduce((s, r) => s + r.revenue, 0);
    const margin = filtered.reduce((s, r) => s + r.grossMargin, 0);
    const promoRows = filtered.filter((r) => r.promoted);
    const stockoutRows = filtered.filter((r) => r.stockedOut);
    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      provenance: sales.provenance,
      source: sales.source,
      warning: sales.warning,
      rows: filtered.length,
      skus: [...new Set(filtered.map((r) => r.sku))].length,
      weeks: { from: Math.min(...filtered.map((r) => r.week)), to: Math.max(...filtered.map((r) => r.week)) },
      totals: {
        units: round2(units),
        revenue: round2(revenue),
        grossMargin: round2(margin),
        grossMarginPct: revenue === 0 ? null : round2(margin / revenue),
        averagePrice: round2(revenue / Math.max(1e-9, units)),
      },
      priceDispersion: {
        min: prices[0],
        p25: prices[Math.floor(prices.length * 0.25)],
        median: prices[Math.floor(prices.length * 0.5)],
        p75: prices[Math.floor(prices.length * 0.75)],
        max: prices[prices.length - 1],
        coefficientOfVariation: round2(sd / meanPrice),
        note:
          sd / meanPrice < 0.05
            ? "Price barely varied in this window. Elasticity is not identified from it: any estimate will be driven by the controls, not by price."
            : "Sufficient price variation to identify an elasticity, subject to the controls.",
      },
      promotions: {
        weeks: promoRows.length,
        share: round2(promoRows.length / filtered.length),
        averagePromoPrice: round2(promoRows.reduce((s, r) => s + r.price, 0) / Math.max(1, promoRows.length)),
        promotedVolumeShare: round2(promoRows.reduce((s, r) => s + r.units, 0) / Math.max(1e-9, units)),
      },
      stockouts: {
        weeks: stockoutRows.length,
        share: round2(stockoutRows.length / filtered.length),
        note: "Stockout weeks censor observed demand. estimate_demand excludes them by default; including them biases elasticity toward zero.",
      },
      history: filtered.slice(0, input.limit),
    };
  },
});
