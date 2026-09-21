import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadItems, popularityMap } from "../lib/data";
import { topsis } from "../lib/rank";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Rank candidates against several objectives at once with TOPSIS: relevance, margin, stock cover, popularity (as a cost), price fit, and sponsorship. Vector-normalizes each criterion, weights it, and ranks by closeness to the ideal and distance from the anti-ideal. Returns the accuracy-only ranking beside the multi-objective one so the trade-off is visible rather than silent.",
  inputSchema: z.object({
    candidates: z
      .array(z.object({ itemId: z.string(), relevance: z.number() }))
      .min(2)
      .describe("Scored candidates, typically candidatePool from recommend_hybrid."),
    weights: z
      .object({
        relevance: z.number().min(0).default(0.5),
        margin: z.number().min(0).default(0.2),
        stock: z.number().min(0).default(0.15),
        popularity: z.number().min(0).default(0.1),
        sponsored: z.number().min(0).default(0.05),
      })
      .default({ relevance: 0.5, margin: 0.2, stock: 0.15, popularity: 0.1, sponsored: 0.05 }),
    maxSponsoredShare: z.number().min(0).max(1).default(0.2),
    slots: z.number().int().min(1).max(50).default(10),
  }),
  label: { start: ({ candidates }) => `TOPSIS over ${candidates.length} candidates` },
  async execute(input) {
    const { rows, provenance, warning } = await loadItems();
    const itemById = new Map(rows.map((i) => [i.id, i]));
    const popularity = popularityMap(rows);

    const usable = input.candidates.filter((c) => itemById.has(c.itemId));
    if (usable.length < 2) throw new Error("Fewer than two candidates exist in the catalog.");

    const matrixRows = usable.map((candidate) => {
      const item = itemById.get(candidate.itemId)!;
      return {
        id: candidate.itemId,
        values: {
          relevance: candidate.relevance,
          margin: item.margin,
          stock: item.stockCoverWeeks,
          popularity: popularity.get(candidate.itemId) ?? 0,
          sponsored: item.sponsored ? 1 : 0,
        },
      };
    });

    const result = topsis(matrixRows, [
      { name: "relevance", weight: input.weights.relevance, benefit: true },
      { name: "margin", weight: input.weights.margin, benefit: true },
      { name: "stock", weight: input.weights.stock, benefit: true },
      // Popularity as a COST criterion: the head of the catalog does not need help.
      { name: "popularity", weight: input.weights.popularity, benefit: false },
      { name: "sponsored", weight: input.weights.sponsored, benefit: true },
    ]);

    // Enforce the sponsored cap on the final slate.
    const maxSponsored = Math.floor(input.slots * input.maxSponsoredShare);
    const selected: typeof result.ranked = [];
    let sponsoredUsed = 0;
    for (const row of result.ranked) {
      if (selected.length >= input.slots) break;
      const item = itemById.get(row.id)!;
      if (item.sponsored) {
        if (sponsoredUsed >= maxSponsored) continue;
        sponsoredUsed++;
      }
      selected.push(row);
    }

    const accuracyOnly = [...usable].sort((a, b) => b.relevance - a.relevance).slice(0, input.slots);
    const mean = (ids: string[], pick: (id: string) => number) =>
      ids.length === 0 ? 0 : Math.round((ids.reduce((s, id) => s + pick(id), 0) / ids.length) * 1e4) / 1e4;
    const selectedIds = selected.map((s) => s.id);
    const accuracyIds = accuracyOnly.map((a) => a.itemId);

    return {
      provenance,
      warning,
      criteria: result.criteria,
      sponsoredCap: { maxShare: input.maxSponsoredShare, used: sponsoredUsed },
      ranked: selected.map((row) => {
        const item = itemById.get(row.id)!;
        return {
          itemId: row.id,
          closeness: row.closeness,
          margin: item.margin,
          stockCoverWeeks: item.stockCoverWeeks,
          sponsored: item.sponsored,
          popularity: popularity.get(row.id) ?? 0,
        };
      }),
      tradeOff: {
        accuracyOnly: {
          items: accuracyIds,
          meanMargin: mean(accuracyIds, (id) => itemById.get(id)!.margin),
          meanPopularity: mean(accuracyIds, (id) => popularity.get(id) ?? 0),
          lowStockItems: accuracyIds.filter((id) => itemById.get(id)!.stockCoverWeeks < 2).length,
        },
        multiObjective: {
          items: selectedIds,
          meanMargin: mean(selectedIds, (id) => itemById.get(id)!.margin),
          meanPopularity: mean(selectedIds, (id) => popularity.get(id) ?? 0),
          lowStockItems: selectedIds.filter((id) => itemById.get(id)!.stockCoverWeeks < 2).length,
        },
        overlap: selectedIds.filter((id) => accuracyIds.includes(id)).length,
      },
      caution:
        "Secondary objectives are paid for in relevance. Report the overlap and the relevance given up; a slate optimized for margin that the customer ignores earns nothing. Sponsored placement is capped so it cannot quietly take over the slate.",
    };
  },
});
