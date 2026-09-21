import { defineTool } from "eve/tools";
import { z } from "zod";
import { buildContentIndex } from "../lib/content";
import { loadInteractions, loadItems, popularityMap } from "../lib/data";
import { intraListDiversity, mmrRerank, novelty, penalizePopularity, serendipity, slateEconomics } from "../lib/rank";
import { nonPersonalized } from "../lib/content";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Final re-ranking before presentation: popularity penalty on a normalized score scale, then Maximal Marginal Relevance for intra-list diversity. Returns the before/after slate with intra-list diversity, novelty, mean popularity, category spread, and slate economics, so the cost of diversity is explicit. Never present a slate that has not been through this step.",
  inputSchema: z.object({
    candidates: z.array(z.object({ itemId: z.string(), score: z.number(), reason: z.string().optional() })).min(1),
    slots: z.number().int().min(1).max(50).default(10),
    popularityLambda: z.number().min(0).max(2).default(0.3).describe("0 = no penalty; 0.3 is a moderate head discount."),
    mmrLambda: z.number().min(0).max(1).default(0.7).describe("1 = pure relevance; lower trades relevance for diversity."),
    maxPerCategory: z.number().int().min(1).max(20).default(3),
  }),
  label: { start: ({ slots }) => `Re-rank for diversity · ${slots} slots` },
  async execute(input) {
    const [items, interactions] = await Promise.all([loadItems(), loadInteractions()]);
    const index = buildContentIndex(items.rows);
    const itemById = new Map(items.rows.map((i) => [i.id, i]));
    const popularity = popularityMap(items.rows);

    const scored = input.candidates
      .filter((c) => itemById.has(c.itemId))
      .map((c) => ({ itemId: c.itemId, score: c.score, reason: c.reason ?? "Recommended for you", source: "upstream" }));
    if (scored.length === 0) throw new Error("No candidate exists in the catalog.");

    const before = [...scored].sort((a, b) => b.score - a.score).slice(0, input.slots).map((s) => s.itemId);
    const penalized = penalizePopularity(scored, popularity, input.popularityLambda);
    const mmr = mmrRerank({ candidates: penalized, index, slots: Math.min(input.slots * 3, penalized.length), lambda: input.mmrLambda });

    // Category cap applied last, so no single category owns the slate.
    const perCategory = new Map<string, number>();
    const final: typeof mmr.selected = [];
    const cappedOut: string[] = [];
    for (const row of mmr.selected) {
      if (final.length >= input.slots) break;
      const category = itemById.get(row.itemId)!.category;
      const used = perCategory.get(category) ?? 0;
      if (used >= input.maxPerCategory) {
        cappedOut.push(row.itemId);
        continue;
      }
      perCategory.set(category, used + 1);
      final.push(row);
    }

    const after = final.map((f) => f.itemId);
    const popBaseline = nonPersonalized(items.rows, interactions.rows).slice(0, 20).map((r) => r.itemId);
    const meanPopularity = (ids: string[]) =>
      ids.length === 0 ? 0 : Math.round((ids.reduce((s, id) => s + (popularity.get(id) ?? 0), 0) / ids.length) * 100) / 100;
    const categorySpread = (ids: string[]) => new Set(ids.map((id) => itemById.get(id)!.category)).size;

    return {
      provenance: items.provenance,
      warning: items.warning,
      parameters: {
        popularityLambda: input.popularityLambda,
        mmrLambda: input.mmrLambda,
        maxPerCategory: input.maxPerCategory,
      },
      slate: final.map((row) => {
        const item = itemById.get(row.itemId)!;
        return {
          itemId: row.itemId,
          title: item.title,
          category: item.category,
          reason: row.reason,
          score: row.score,
          popularity: popularity.get(row.itemId) ?? 0,
          margin: item.margin,
        };
      }),
      comparison: {
        beforeReRank: {
          items: before,
          intraListDiversity: intraListDiversity(before, index),
          novelty: novelty(before, popularity),
          meanPopularity: meanPopularity(before),
          categorySpread: categorySpread(before),
          serendipity: serendipity(before, new Set(), popBaseline).serendipity,
          economics: slateEconomics(before, itemById),
        },
        afterReRank: {
          items: after,
          intraListDiversity: intraListDiversity(after, index),
          novelty: novelty(after, popularity),
          meanPopularity: meanPopularity(after),
          categorySpread: categorySpread(after),
          economics: slateEconomics(after, itemById),
        },
        retained: after.filter((id) => before.includes(id)).length,
        droppedForDiversity: mmr.droppedForDiversity,
        droppedByCategoryCap: cappedOut,
      },
      caution:
        "Higher novelty and diversity cost relevance. Report both sides: the trade is a business decision about the tail, not a modeling detail. Whether the diverse slate performs better is a question for measurement, not for offline metrics.",
    };
  },
});
