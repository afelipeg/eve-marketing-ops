import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadProducts } from "../lib/data";
import { optimizeUnitPrice } from "../lib/optimize";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Find the margin- or revenue-maximizing unit price on an estimated constant-elasticity demand curve, with a sensitivity table across the price range, the closed-form monopoly price p* = c·eps/(1+eps), and floor/ceiling/capacity constraints applied. When demand is inelastic (|eps| < 1) the unconstrained margin optimum is unbounded, so the returned optimum is the ceiling of the supplied range, not a true profit maximum: `elasticityWarning` is populated and the price must not be quoted as profit-maximizing.",
  inputSchema: z.object({
    sku: z.string().optional().describe("Fills cost, floor and ceiling from the catalog."),
    intercept: z.number(),
    elasticity: z.number(),
    unitCost: z.number().min(0).optional(),
    priceMin: z.number().min(0).optional(),
    priceMax: z.number().min(0).optional(),
    capacity: z.number().min(0).optional().describe("Units available over the horizon."),
    objective: z.enum(["margin", "revenue"]).default("margin"),
    steps: z.number().int().min(10).max(400).default(80),
  }),
  label: { start: ({ sku, objective }) => `Optimize ${objective}${sku ? ` · ${sku}` : ""}` },
  async execute(input) {
    let unitCost = input.unitCost;
    let priceMin = input.priceMin;
    let priceMax = input.priceMax;
    let currentPrice: number | null = null;

    if (input.sku) {
      const { rows } = await loadProducts();
      const product = rows.find((p) => p.sku === input.sku);
      if (!product) throw new Error(`No SKU "${input.sku}".`);
      unitCost ??= product.unitCost;
      priceMin ??= product.priceFloor ?? product.unitCost * 1.02;
      priceMax ??= product.priceCeiling ?? product.currentPrice * 1.8;
      currentPrice = product.currentPrice;
    }
    if (unitCost === undefined || priceMin === undefined || priceMax === undefined) {
      throw new Error("Supply sku, or unitCost with priceMin and priceMax.");
    }

    const result = optimizeUnitPrice({
      intercept: input.intercept,
      elasticity: input.elasticity,
      unitCost,
      priceMin,
      priceMax,
      steps: input.steps,
      capacity: input.capacity,
      objective: input.objective,
    });

    const currentPoint =
      currentPrice === null
        ? null
        : result.curve.reduce((a, b) => (Math.abs(b.price - currentPrice!) < Math.abs(a.price - currentPrice!) ? b : a));

    // Sensitivity: margin at +/- 10% around the optimum.
    const at = (price: number) =>
      result.curve.reduce((a, b) => (Math.abs(b.price - price) < Math.abs(a.price - price) ? b : a));
    const sensitivity = [-0.1, -0.05, 0, 0.05, 0.1].map((delta) => {
      const point = at(result.optimum.price * (1 + delta));
      return {
        deltaPct: delta * 100,
        price: point.price,
        units: point.units,
        margin: point.margin,
        marginVsOptimumPct:
          result.optimum.margin === 0 ? null : Math.round((point.margin / result.optimum.margin - 1) * 1e4) / 100,
      };
    });

    return {
      objective: input.objective,
      constraints: { priceMin, priceMax, capacity: input.capacity ?? null, capacityBinding: result.capacityBinding },
      current: currentPoint,
      optimum: result.optimum,
      revenueOptimum: result.revenueOptimum,
      closedFormMonopolyPrice: result.closedForm,
      change:
        currentPoint === null
          ? null
          : {
              priceChangePct: Math.round((result.optimum.price / currentPoint.price - 1) * 1e4) / 100,
              marginChange: Math.round((result.optimum.margin - currentPoint.margin) * 100) / 100,
              unitChangePct: Math.round((result.optimum.units / currentPoint.units - 1) * 1e4) / 100,
            },
      sensitivity,
      elasticityWarning: result.elasticityWarning,
      curve: result.curve.filter((_, i) => i % Math.max(1, Math.floor(result.curve.length / 15)) === 0),
      cautions: [
        "The margin optimum and the revenue optimum differ. Naming which objective was used is part of the answer.",
        "This is a single-SKU optimum. Run analyze_cannibalization before moving a price inside a portfolio of substitutes.",
        result.capacityBinding
          ? "Capacity binds at the optimum: units are supply-limited, so use price_under_scarcity instead of this curve."
          : null,
      ].filter(Boolean),
    };
  },
});
