import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadInteractions, loadItems } from "../lib/data";
import { buildMatrix, temporalSplit } from "../lib/matrix";
import { predictMf, rmse, trainMf } from "../lib/mf";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Train a latent factor model (SVD, SVD++ with implicit feedback, or timeSVD++ with drifting user and item biases) and return ranked recommendations plus holdout RMSE/MAE against the global-mean baseline. Set compareModels to fit all three on the same temporal split and report which one actually wins — the temporal model is not automatically better.",
  inputSchema: z.object({
    userId: z.string().optional(),
    model: z.enum(["svd", "svd++", "timesvd++"]).default("svd++"),
    compareModels: z.boolean().default(false),
    factors: z.number().int().min(2).max(64).default(8),
    epochs: z.number().int().min(5).max(200).default(30),
    learningRate: z.number().min(0.0001).max(0.5).default(0.008),
    regularization: z.number().min(0).max(1).default(0.05),
    timeBins: z.number().int().min(2).max(32).default(4),
    cutoffQuantile: z.number().min(0.5).max(0.95).default(0.8),
    atDay: z.number().min(0).optional().describe("Day to score for; temporal models need it."),
    slots: z.number().int().min(1).max(50).default(10),
    seed: z.number().int().default(11),
  }),
  label: { start: ({ model, userId }) => `${model} · ${userId ?? "fit only"}` },
  async execute(input) {
    const [interactions, items] = await Promise.all([loadInteractions(), loadItems()]);
    const matrix = buildMatrix(interactions.rows);
    const split = temporalSplit(interactions.rows, input.cutoffQuantile);
    const itemById = new Map(items.rows.map((i) => [i.id, i]));

    const baseMean = split.train.reduce((s, r) => s + r.rating, 0) / split.train.length;
    const baselineRmse = Math.sqrt(
      split.test.reduce((s, r) => s + Math.pow(r.rating - baseMean, 2), 0) / Math.max(1, split.test.length),
    );

    const common = {
      factors: input.factors,
      epochs: input.epochs,
      learningRate: input.learningRate,
      regularization: input.regularization,
      timeBins: input.timeBins,
      seed: input.seed,
    };
    const configs = input.compareModels
      ? ([
          { name: "svd", options: { ...common } },
          { name: "svd++", options: { ...common, implicit: true } },
          { name: "timesvd++", options: { ...common, implicit: true, temporal: true } },
        ] as const)
      : ([
          {
            name: input.model,
            options: {
              ...common,
              implicit: input.model !== "svd",
              temporal: input.model === "timesvd++",
            },
          },
        ] as const);

    const fitted = configs.map((config) => {
      const model = trainMf(matrix, split.train, config.options);
      const accuracy = rmse(model, split.test);
      return { name: config.name, model, accuracy };
    });

    const best = [...fitted].sort((a, b) => (a.accuracy.rmse ?? Infinity) - (b.accuracy.rmse ?? Infinity))[0]!;
    const chosen = input.compareModels ? best : fitted[0]!;

    const comparison = fitted.map((f) => ({
      model: f.name,
      holdoutRmse: f.accuracy.rmse,
      holdoutMae: f.accuracy.mae,
      trainRmse: f.model.trainRmse,
      scoredPairs: f.accuracy.scored,
      improvementOverBaseline:
        f.accuracy.rmse === null ? null : Math.round((1 - f.accuracy.rmse / baselineRmse) * 1e4) / 1e4,
    }));

    let recommendations: unknown[] = [];
    if (input.userId) {
      const history = matrix.byUser.get(input.userId) ?? [];
      const seen = new Set(history.map((h) => h.itemId));
      const day = input.atDay ?? split.cutoffDay + 10;
      const liked = [...history].sort((a, b) => b.rating - a.rating)[0];
      recommendations = items.rows
        .filter((i) => !seen.has(i.id))
        .map((i) => ({
          itemId: i.id,
          score: predictMf(chosen.model, input.userId!, i.id, day) ?? 0,
          reason: liked
            ? `Users with tastes like yours — who also rated ${itemById.get(liked.itemId)?.title ?? liked.itemId} — rate this highly`
            : "Matches the taste pattern in your history",
          source: chosen.name,
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => (b.score as number) - (a.score as number))
        .slice(0, input.slots);
    }

    return {
      provenance: interactions.provenance,
      warning: interactions.warning,
      chosenModel: chosen.name,
      hyperparameters: chosen.model.options,
      split: { cutoffDay: split.cutoffDay, train: split.train.length, test: split.test.length },
      baseline: { globalMeanRmse: Math.round(baselineRmse * 1e6) / 1e6 },
      comparison,
      verdict: input.compareModels
        ? `${best.name} wins on the late holdout (RMSE ${best.accuracy.rmse}). Do not assume the temporal model is better — it adds parameters and only pays when taste or item appeal actually drifts.`
        : undefined,
      recommendations,
      caution:
        "RMSE measures rating prediction, not ranking. A model that wins on RMSE can still lose on precision@k and coverage — check evaluate_recommender before shipping it.",
    };
  },
});
