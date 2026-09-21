import { defineTool } from "eve/tools";
import { z } from "zod";
import { buildContentIndex, nonPersonalized } from "../lib/content";
import { loadInteractions, loadItems, popularityMap } from "../lib/data";
import { buildMatrix, temporalSplit } from "../lib/matrix";
import { predictMf, rmse, trainMf } from "../lib/mf";
import { buildItemSimilarity, predictItemBased } from "../lib/similarity";
import {
  coverage,
  intraListDiversity,
  mmrRerank,
  ndcgAtK,
  novelty,
  penalizePopularity,
  precisionRecallAtK,
  serendipity,
} from "../lib/rank";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Offline evaluation on a temporal holdout: precision@k, recall@k, NDCG@k, catalog coverage, novelty, intra-list diversity and serendipity, plus rating-prediction RMSE, for any of the available models and for the popularity baseline. Compares a raw ranking against a diversity re-ranked one. These are the numbers to report to measurement — and they are offline proxies, not evidence of business effect.",
  inputSchema: z.object({
    models: z
      .array(z.enum(["popularity", "item_knn", "svd", "svd++", "timesvd++"]))
      .min(1)
      .default(["popularity", "item_knn", "svd++", "timesvd++"]),
    k: z.number().int().min(1).max(50).default(10),
    cutoffQuantile: z.number().min(0.5).max(0.95).default(0.8),
    relevantThreshold: z.number().min(1).max(5).default(4),
    maxUsers: z.number().int().min(10).max(500).default(150),
    withReRank: z.boolean().default(true),
    popularityLambda: z.number().min(0).max(2).default(0.3),
    mmrLambda: z.number().min(0).max(1).default(0.7),
  }),
  label: { start: ({ models, k }) => `Evaluate ${models.length} models @${k}` },
  async execute(input) {
    const [interactions, items] = await Promise.all([loadInteractions(), loadItems()]);
    const matrix = buildMatrix(interactions.rows);
    const split = temporalSplit(interactions.rows, input.cutoffQuantile);
    const trainMatrix = buildMatrix(split.train);
    const index = buildContentIndex(items.rows);
    const popularity = popularityMap(items.rows);

    const baseline = nonPersonalized(items.rows, split.train);
    const popBaselineIds = baseline.slice(0, 20).map((r) => r.itemId);
    const baseMean = split.train.reduce((s, r) => s + r.rating, 0) / Math.max(1, split.train.length);
    const baselineRmse = Math.sqrt(
      split.test.reduce((s, r) => s + Math.pow(r.rating - baseMean, 2), 0) / Math.max(1, split.test.length),
    );

    const similarity = input.models.includes("item_knn")
      ? buildItemSimilarity(trainMatrix, { topK: 40, minSupport: 3 })
      : null;
    const mfModels = new Map<string, ReturnType<typeof trainMf>>();
    for (const name of input.models) {
      if (name === "svd" || name === "svd++" || name === "timesvd++") {
        mfModels.set(
          name,
          trainMf(matrix, split.train, {
            factors: 8,
            epochs: 30,
            implicit: name !== "svd",
            temporal: name === "timesvd++",
            seed: 11,
          }),
        );
      }
    }

    const evaluationUsers = split.testUsers.slice(0, input.maxUsers);
    const results = input.models.map((name) => {
      let precision = 0;
      let recall = 0;
      let ndcg = 0;
      let serendipitySum = 0;
      let noveltySum = 0;
      let diversitySum = 0;
      let users = 0;
      const lists: string[][] = [];
      const reranked: string[][] = [];
      let rerankPrecision = 0;

      for (const userId of evaluationUsers) {
        const testRows = split.test.filter((r) => r.userId === userId);
        const relevant = new Set(testRows.filter((r) => r.rating >= input.relevantThreshold).map((r) => r.itemId));
        if (relevant.size === 0) continue;
        const trained = new Set((trainMatrix.byUser.get(userId) ?? []).map((r) => r.itemId));

        let scored: { itemId: string; score: number }[];
        if (name === "popularity") {
          scored = baseline.filter((b) => !trained.has(b.itemId)).map((b) => ({ itemId: b.itemId, score: b.bayesianScore }));
        } else if (name === "item_knn") {
          scored = items.rows
            .filter((i) => !trained.has(i.id))
            .map((i) => {
              const p = predictItemBased({ matrix: trainMatrix, similarity: similarity!, userId, itemId: i.id, k: 20 });
              return { itemId: i.id, score: p.prediction ?? 0 };
            })
            .filter((r) => r.score > 0);
        } else {
          const model = mfModels.get(name)!;
          scored = items.rows
            .filter((i) => !trained.has(i.id))
            .map((i) => ({ itemId: i.id, score: predictMf(model, userId, i.id, split.cutoffDay + 10) ?? 0 }))
            .filter((r) => r.score > 0);
        }

        const ranked = [...scored].sort((a, b) => b.score - a.score);
        const top = ranked.slice(0, input.k).map((r) => r.itemId);
        if (top.length === 0) continue;

        const pr = precisionRecallAtK(top, relevant, input.k);
        precision += pr.precision;
        recall += pr.recall;
        ndcg += ndcgAtK(top, new Map(testRows.map((r) => [r.itemId, Math.max(0, r.rating - 3)])), input.k);
        serendipitySum += serendipity(top, relevant, popBaselineIds).serendipity;
        noveltySum += novelty(top, popularity);
        diversitySum += intraListDiversity(top, index);
        lists.push(top);
        users++;

        if (input.withReRank) {
          const pool = ranked.slice(0, input.k * 4).map((r) => ({ ...r, reason: "", source: name }));
          const penalized = penalizePopularity(pool, popularity, input.popularityLambda);
          const selected = mmrRerank({ candidates: penalized, index, slots: input.k, lambda: input.mmrLambda }).selected.map(
            (s) => s.itemId,
          );
          reranked.push(selected);
          rerankPrecision += precisionRecallAtK(selected, relevant, input.k).precision;
        }
      }

      const mean = (value: number) => (users === 0 ? 0 : Math.round((value / users) * 1e4) / 1e4);
      const mfModel = mfModels.get(name);
      const accuracy = mfModel ? rmse(mfModel, split.test) : null;

      return {
        model: name,
        usersEvaluated: users,
        [`precision@${input.k}`]: mean(precision),
        [`recall@${input.k}`]: mean(recall),
        [`ndcg@${input.k}`]: mean(ndcg),
        coverage: coverage(lists, items.rows.length),
        novelty: mean(noveltySum),
        intraListDiversity: mean(diversitySum),
        serendipity: mean(serendipitySum),
        holdoutRmse: accuracy?.rmse ?? null,
        reRanked: input.withReRank
          ? {
              [`precision@${input.k}`]: mean(rerankPrecision),
              coverage: coverage(reranked, items.rows.length),
              precisionCost: Math.round((mean(precision) - mean(rerankPrecision)) * 1e4) / 1e4,
            }
          : undefined,
      };
    });

    return {
      provenance: interactions.provenance,
      warning: interactions.warning,
      split: { cutoffDay: split.cutoffDay, train: split.train.length, test: split.test.length },
      baseline: { globalMeanRmse: Math.round(baselineRmse * 1e6) / 1e6 },
      k: input.k,
      relevantThreshold: input.relevantThreshold,
      results,
      reading:
        "A model that beats the popularity baseline on precision but not on coverage has learned the best-seller list. Read accuracy, coverage, novelty and serendipity together — optimizing the first alone reproduces the catalog head.",
      caution:
        "Offline metrics are computed on logged interactions, which were themselves produced by whatever recommender was live. They are biased toward that policy and cannot measure business effect. Route the online read to measurement.",
    };
  },
});
