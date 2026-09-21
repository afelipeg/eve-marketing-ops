import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadCompetitorPrices, loadProducts } from "../lib/data";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Read competitor prices by SKU and week, with our price index against each competitor (ours ÷ theirs), gap distribution and their promotion frequency. Use to set the competitive constraint on a price move before optimizing, and to see whether an elasticity estimate is confounded by competitive response.",
  inputSchema: z.object({
    sku: z.string().optional(),
    competitor: z.string().optional(),
    fromWeek: z.number().min(0).optional(),
    limit: z.number().int().min(0).max(200).default(20),
  }),
  label: { start: ({ sku }) => `Read competitor prices${sku ? ` · ${sku}` : ""}` },
  async execute(input) {
    const [competitorPrices, products] = await Promise.all([loadCompetitorPrices(), loadProducts()]);
    const bySku = new Map(products.rows.map((p) => [p.sku, p]));

    const filtered = competitorPrices.rows.filter(
      (row) =>
        (!input.sku || row.sku === input.sku) &&
        (!input.competitor || row.competitor === input.competitor) &&
        (input.fromWeek === undefined || row.week >= input.fromWeek),
    );
    if (filtered.length === 0) throw new Error("No competitor price rows match those filters.");

    const round3 = (n: number) => Math.round(n * 1000) / 1000;
    const competitors = [...new Set(filtered.map((r) => r.competitor))];

    return {
      provenance: competitorPrices.provenance,
      source: competitorPrices.source,
      warning: competitorPrices.warning,
      rows: filtered.length,
      competitors,
      byCompetitor: competitors.map((competitor) => {
        const slice = filtered.filter((r) => r.competitor === competitor);
        const indices = slice
          .map((r) => {
            const ours = bySku.get(r.sku)?.currentPrice;
            return ours && r.price > 0 ? ours / r.price : null;
          })
          .filter((v): v is number => v !== null)
          .sort((a, b) => a - b);
        return {
          competitor,
          observations: slice.length,
          priceIndex: {
            p10: round3(indices[Math.floor(indices.length * 0.1)] ?? 0),
            median: round3(indices[Math.floor(indices.length * 0.5)] ?? 0),
            p90: round3(indices[Math.floor(indices.length * 0.9)] ?? 0),
          },
          theirPromotionShare: round3(slice.filter((r) => r.onPromotion).length / slice.length),
          averagePrice: round3(slice.reduce((s, r) => s + r.price, 0) / slice.length),
        };
      }),
      interpretation:
        "A price index above 1 means we sit above that competitor. Index alone is not a decision: pair it with elasticity, because matching a competitor on an inelastic SKU gives away margin for volume that was not at risk.",
      confounding:
        "When our price and competitor prices move together, the own-price elasticity is only identified if the competitor price is in the model. estimate_demand includes it as a control.",
      rows_sample: filtered.slice(0, input.limit),
    };
  },
});
