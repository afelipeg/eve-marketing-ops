import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadItems } from "../lib/data";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Read the item catalog: category, brand, content tags, price, margin, stock cover, sponsored flag, popularity and seasonality. Returns the catalog profile including the popularity concentration that any accuracy-only ranking will amplify. Always report the returned `provenance`.",
  inputSchema: z.object({
    category: z.string().optional(),
    brand: z.string().optional(),
    occasion: z.string().optional(),
    minStockCoverWeeks: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    limit: z.number().int().min(0).max(200).default(20),
  }),
  label: { start: () => "Read catalog" },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadItems();
    const filtered = rows.filter(
      (i) =>
        (!input.category || i.category === input.category) &&
        (!input.brand || i.brand === input.brand) &&
        (!input.occasion || i.seasonality.includes(input.occasion as never)) &&
        (input.minStockCoverWeeks === undefined || i.stockCoverWeeks >= input.minStockCoverWeeks) &&
        (input.maxPrice === undefined || i.price <= input.maxPrice),
    );

    const sorted = [...filtered].sort((a, b) => b.popularity - a.popularity);
    const totalPopularity = filtered.reduce((s, i) => s + i.popularity, 0);
    const headCount = Math.max(1, Math.ceil(sorted.length * 0.1));
    const headShare =
      totalPopularity === 0
        ? 0
        : sorted.slice(0, headCount).reduce((s, i) => s + i.popularity, 0) / totalPopularity;

    return {
      provenance,
      source,
      warning,
      items: filtered.length,
      categories: [...new Set(rows.map((i) => i.category))].sort(),
      brands: [...new Set(rows.map((i) => i.brand))].sort(),
      tags: [...new Set(rows.flatMap((i) => i.tags))].sort(),
      economics: {
        meanPrice: Math.round((filtered.reduce((s, i) => s + i.price, 0) / Math.max(1, filtered.length)) * 100) / 100,
        meanMargin: Math.round((filtered.reduce((s, i) => s + i.margin, 0) / Math.max(1, filtered.length)) * 100) / 100,
        sponsoredShare: Math.round((filtered.filter((i) => i.sponsored).length / Math.max(1, filtered.length)) * 1e4) / 1e4,
        lowStockItems: filtered.filter((i) => i.stockCoverWeeks < 2).length,
      },
      popularityConcentration: {
        top10PctItemsShareOfInteractions: Math.round(headShare * 1e4) / 1e4,
        note: "An accuracy-optimal list converges on this head. Coverage and novelty are what keep the tail addressable.",
      },
      head: sorted.slice(0, input.limit),
    };
  },
});
