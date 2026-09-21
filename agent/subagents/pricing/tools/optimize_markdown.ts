import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadProducts, loadSales } from "../lib/data";
import { optimizeMarkdown } from "../lib/dynamic";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Solve the markdown schedule for perishable or seasonal stock by dynamic programming over (periods remaining, inventory): which price to charge each period, expected units, sell-through, leftover and salvage, against the hold-full-price counterfactual. Use when stock will outlive its shelf life or the selling season at the current rate.",
  inputSchema: z.object({
    sku: z.string().optional(),
    intercept: z.number(),
    elasticity: z.number(),
    initialInventory: z.number().min(1).optional(),
    periods: z.number().int().min(1).max(52),
    priceLadder: z.array(z.number().min(0)).min(2).optional(),
    salvageValue: z.number().min(0).optional(),
    monotoneMarkdown: z.boolean().default(true).describe("Prices may only fall, the standard retail policy."),
    inventoryBuckets: z.number().int().min(10).max(200).default(60),
  }),
  label: { start: ({ sku, periods }) => `Markdown DP · ${sku ?? "custom"} · ${periods} periods` },
  async execute(input) {
    let initialInventory = input.initialInventory;
    let salvageValue = input.salvageValue;
    let priceLadder = input.priceLadder;
    let currentPrice: number | null = null;

    if (input.sku) {
      const [products, sales] = await Promise.all([loadProducts(), loadSales()]);
      const product = products.rows.find((p) => p.sku === input.sku);
      if (!product) throw new Error(`No SKU "${input.sku}".`);
      initialInventory ??= product.inventory;
      salvageValue ??= product.salvageValue;
      currentPrice = product.currentPrice;
      priceLadder ??= [1, 0.85, 0.7, 0.55, 0.4].map((m) => Math.round(product.currentPrice * m * 100) / 100);
      void sales;
    }
    if (initialInventory === undefined || salvageValue === undefined || !priceLadder) {
      throw new Error("Supply sku, or initialInventory with salvageValue and priceLadder.");
    }

    const result = optimizeMarkdown({
      intercept: input.intercept,
      elasticity: input.elasticity,
      initialInventory,
      periods: input.periods,
      priceLadder,
      salvageValue,
      monotoneMarkdown: input.monotoneMarkdown,
      inventoryBuckets: input.inventoryBuckets,
    });

    const topPrice = Math.max(...priceLadder);
    const demandAtTop = Math.exp(input.intercept + input.elasticity * Math.log(topPrice));
    const horizonDemandAtTop = demandAtTop * input.periods;
    const clearanceRatio = horizonDemandAtTop / initialInventory;

    return {
      sku: input.sku ?? null,
      currentPrice,
      priceLadder,
      initialInventory,
      periods: input.periods,
      schedule: result.schedule,
      outcome: {
        expectedRevenue: result.expectedRevenue,
        expectedSellThrough: result.expectedSellThrough,
        expectedLeftover: result.expectedLeftover,
        expectedSalvage: result.expectedSalvage,
      },
      holdFullPriceCounterfactual: result.fullPriceComparison,
      gainOverHoldingFullPrice:
        Math.round((result.expectedRevenue - result.fullPriceComparison.expectedRevenue) * 100) / 100,
      policyGrid: result.policy,
      diagnostics: {
        demandAtTopPricePerPeriod: Math.round(demandAtTop * 100) / 100,
        horizonDemandAtTopPrice: Math.round(horizonDemandAtTop * 100) / 100,
        clearanceRatioAtTopPrice: Math.round(clearanceRatio * 1000) / 1000,
        reading:
          clearanceRatio >= 1.2
            ? "Stock clears at full price within the horizon. There is no markdown problem here — a discount would give away margin on volume that was already coming."
            : clearanceRatio < 0.35
              ? "Even the whole horizon at the lowest price cannot clear this stock. The DP will go straight to the bottom of the ladder; the real problem is upstream in buying or forecasting, and that finding belongs in the report."
              : "Stock does not clear at full price but is clearable with markdowns: the DP trades price against the risk of leftover.",
      },
      cautions: [
        "The DP assumes the demand curve holds at every rung of the ladder. Deep discounts often behave differently (stockpiling, reference-price damage) than the curve predicts.",
        "Marking down early is right when stock cannot clear at full price; marking down late is right when it might. The cost of holding a unit is the price you could have got for it earlier, not its carrying cost.",
        "Repeated deep markdowns train customers to wait. That cost lands in the next season's full-price demand, outside this horizon.",
      ],
    };
  },
});
