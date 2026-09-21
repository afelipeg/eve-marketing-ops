import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadInteractions, loadItems, popularityMap } from "../lib/data";
import { buildMatrix } from "../lib/matrix";
import { buildItemSimilarity, predictItemBased } from "../lib/similarity";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Item-based neighborhood collaborative filtering with adjusted-cosine similarity and support shrinkage. Returns ranked recommendations with the neighbours that produced each one (the 'because you rated X' explanation), plus similar-item lookup for a seed item on a product detail page. Requires a user with enough history; returns a cold-start routing instruction when it does not exist.",
  inputSchema: z.object({
    userId: z.string().optional(),
    seedItemId: z.string().optional().describe("PDP mode: items similar to this one."),
    metric: z.enum(["adjusted_cosine", "pearson", "cosine"]).default("adjusted_cosine"),
    k: z.number().int().min(1).max(100).default(20),
    topK: z.number().int().min(5).max(200).default(40),
    minSupport: z.number().int().min(1).max(50).default(3),
    shrinkage: z.number().min(0).max(100).default(10),
    slots: z.number().int().min(1).max(50).default(10),
    minHistory: z.number().int().min(1).max(20).default(3),
  }),
  label: { start: ({ userId, seedItemId }) => `Item-based CF · ${seedItemId ?? userId ?? "pool"}` },
  async execute(input) {
    const [interactions, items] = await Promise.all([loadInteractions(), loadItems()]);
    const matrix = buildMatrix(interactions.rows);
    const itemById = new Map(items.rows.map((i) => [i.id, i]));

    const similarity = buildItemSimilarity(matrix, {
      metric: input.metric,
      topK: input.topK,
      minSupport: input.minSupport,
      shrinkage: input.shrinkage,
    });

    if (input.seedItemId) {
      const neighbours = similarity.neighbors.get(input.seedItemId) ?? [];
      return {
        provenance: interactions.provenance,
        warning: interactions.warning,
        mode: "similar_items",
        seedItemId: input.seedItemId,
        recommendations: neighbours.slice(0, input.slots).map((n) => ({
          itemId: n.itemId,
          score: n.similarity,
          support: n.support,
          reason: `Customers who rated ${itemById.get(input.seedItemId!)?.title ?? input.seedItemId} also rated this`,
          source: "item_knn",
        })),
        note:
          neighbours.length === 0
            ? "No neighbours clear the support threshold for this item. Fall back to content filtering for the PDP slot."
            : undefined,
      };
    }

    if (!input.userId) throw new Error("Supply userId or seedItemId.");
    const history = matrix.byUser.get(input.userId) ?? [];
    if (history.length < input.minHistory) {
      return {
        provenance: interactions.provenance,
        warning: interactions.warning,
        refused: true,
        reason: `User has ${history.length} interactions, below the ${input.minHistory} needed for collaborative filtering.`,
        routeTo: history.length === 0 ? "non_personalized" : "content_filtering",
      };
    }

    const seen = new Set(history.map((h) => h.itemId));
    const popularity = popularityMap(items.rows);

    const scored = items.rows
      .filter((item) => !seen.has(item.id))
      .map((item) => {
        const prediction = predictItemBased({
          matrix,
          similarity,
          userId: input.userId!,
          itemId: item.id,
          k: input.k,
        });
        return { item, prediction };
      })
      .filter((row) => row.prediction.prediction !== null)
      .map((row) => ({
        itemId: row.item.id,
        score: row.prediction.prediction!,
        neighbours: row.prediction.usedNeighbors,
        reason: `Because you rated ${row.prediction.contributors
          .map((id) => itemById.get(id)?.title ?? id)
          .slice(0, 2)
          .join(" and ")}`,
        source: "item_knn",
        popularity: popularity.get(row.item.id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score);

    return {
      provenance: interactions.provenance,
      source: interactions.source,
      warning: interactions.warning,
      mode: "user_recommendations",
      userId: input.userId,
      historySize: history.length,
      similarityMetric: input.metric,
      scoredCandidates: scored.length,
      recommendations: scored.slice(0, input.slots),
      caution:
        "Neighborhood CF inherits the popularity bias of the matrix: items with more co-ratings have more reliable similarities. Re-rank before presenting.",
    };
  },
});
