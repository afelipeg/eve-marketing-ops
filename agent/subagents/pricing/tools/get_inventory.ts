import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadProducts, loadSales } from "../lib/data";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Read stock position by SKU: units on hand, weeks of cover at recent sell-out rate, shelf life, perishability, salvage value, unit cost, current price and price floor/ceiling. Flags SKUs where capacity is scarce (raise price) and where stock will outlive its shelf life (mark down).",
  inputSchema: z.object({
    sku: z.string().optional(),
    category: z.string().optional(),
    perishableOnly: z.boolean().default(false),
    limit: z.number().int().min(0).max(200).default(25),
  }),
  label: { start: () => "Read inventory position" },
  async execute(input) {
    const [products, sales] = await Promise.all([loadProducts(), loadSales()]);

    // Reduce, not spread: Math.max(...rows) throws RangeError past ~100k
    // elements and yields -Infinity on an empty table.
    const recentWeek = sales.rows.reduce((m, r) => (r.week > m ? r.week : m), Number.NEGATIVE_INFINITY);
    if (!Number.isFinite(recentWeek)) {
      throw new Error("No sales rows available, so no recent sell-rate can be computed.");
    }
    const recentWindow = sales.rows.filter((r) => r.week > recentWeek - 8);
    const weeklyRate = new Map<string, number>();
    for (const row of recentWindow) {
      weeklyRate.set(row.sku, (weeklyRate.get(row.sku) ?? 0) + row.units / 8);
    }

    const filtered = products.rows.filter(
      (p) =>
        (!input.sku || p.sku === input.sku) &&
        (!input.category || p.category === input.category) &&
        (!input.perishableOnly || p.perishable),
    );

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const rows = filtered.map((product) => {
      const rate = weeklyRate.get(product.sku) ?? 0;
      const cover = rate <= 0 ? null : product.inventory / rate;
      const expires = product.shelfLifeWeeks;
      return {
        sku: product.sku,
        title: product.title,
        category: product.category,
        inventory: product.inventory,
        weeklySellRate: round2(rate),
        weeksOfCover: cover === null ? null : round2(cover),
        shelfLifeWeeks: expires,
        perishable: product.perishable,
        unitCost: product.unitCost,
        currentPrice: product.currentPrice,
        priceFloor: product.priceFloor ?? null,
        priceCeiling: product.priceCeiling ?? null,
        salvageValue: product.salvageValue,
        situation:
          cover !== null && cover < 2
            ? "scarce"
            : expires !== null && cover !== null && cover > expires
              ? "will_expire"
              : cover !== null && cover > 12
                ? "overstocked"
                : "balanced",
      };
    });

    const counts = (situation: string) => rows.filter((r) => r.situation === situation).length;

    return {
      provenance: products.provenance,
      source: products.source,
      warning: products.warning,
      skus: rows.length,
      summary: {
        scarce: counts("scarce"),
        willExpire: counts("will_expire"),
        overstocked: counts("overstocked"),
        balanced: counts("balanced"),
      },
      routing: {
        scarce: "Capacity is the binding constraint: price up (price_under_scarcity), do not promote.",
        will_expire: "Stock outlives shelf life at the current rate: run optimize_markdown now, not in the last week.",
        overstocked: "Non-perishable overstock: markdown is one option, but check cannibalization and price-integrity cost first.",
      },
      rows: rows.slice(0, input.limit),
    };
  },
});
