import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadProducts } from "../lib/data";
import { stockoutPricing } from "../lib/dynamic";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Price when stock is scarce relative to remaining demand: the margin-optimal price given limited inventory, the stockout risk and unmet demand at each price, and the lowest price that still clears the horizon without running out. Scarcity calls for a price increase, not a discount.",
  inputSchema: z.object({
    sku: z.string().optional(),
    intercept: z.number(),
    elasticity: z.number(),
    unitCost: z.number().min(0).optional(),
    inventory: z.number().min(0).optional(),
    periodsRemaining: z.number().min(1).max(104),
    priceMin: z.number().min(0).optional(),
    priceMax: z.number().min(0).optional(),
    salvageValue: z.number().min(0).optional(),
    steps: z.number().int().min(10).max(200).default(60),
  }),
  label: { start: ({ sku }) => `Scarcity pricing${sku ? ` · ${sku}` : ""}` },
  async execute(input) {
    let unitCost = input.unitCost;
    let inventory = input.inventory;
    let priceMin = input.priceMin;
    let priceMax = input.priceMax;
    let salvageValue = input.salvageValue;
    let currentPrice: number | null = null;

    if (input.sku) {
      const { rows } = await loadProducts();
      const product = rows.find((p) => p.sku === input.sku);
      if (!product) throw new Error(`No SKU "${input.sku}".`);
      unitCost ??= product.unitCost;
      inventory ??= product.inventory;
      priceMin ??= product.priceFloor ?? product.unitCost * 1.02;
      priceMax ??= product.priceCeiling ?? product.currentPrice * 2;
      salvageValue ??= product.salvageValue;
      currentPrice = product.currentPrice;
    }
    if (unitCost === undefined || inventory === undefined) {
      throw new Error("Supply sku, or unitCost with inventory.");
    }
    priceMin ??= unitCost * 1.05;
    priceMax ??= unitCost * 4;

    const result = stockoutPricing({
      intercept: input.intercept,
      elasticity: input.elasticity,
      unitCost,
      inventory,
      periodsRemaining: input.periodsRemaining,
      priceMin,
      priceMax,
      steps: input.steps,
      salvageValue,
    });

    const atCurrent =
      currentPrice === null
        ? null
        : result.rows.reduce((a, b) => (Math.abs(b.price - currentPrice!) < Math.abs(a.price - currentPrice!) ? b : a));

    return {
      sku: input.sku ?? null,
      inventory,
      periodsRemaining: input.periodsRemaining,
      current: atCurrent,
      optimum: result.optimum,
      lowestNonStockoutPrice: result.lowestNonStockoutPrice,
      guidance: result.guidance,
      sensitivity: result.rows.filter((_, i) => i % Math.max(1, Math.floor(result.rows.length / 12)) === 0),
      cautions: [
        "Raising price into a shortage is correct on margin and can be wrong on relationship: visible scarcity pricing on essentials is a reputational and, in several jurisdictions, a legal risk. Check the constraint before quoting the number.",
        "Unmet demand is not lost forever if the customer waits, and is lost twice if they switch and stay switched. The model prices the period, not the relationship.",
        "If scarcity is chronic rather than seasonal, the answer is supply, not price. Say so.",
      ],
    };
  },
});
