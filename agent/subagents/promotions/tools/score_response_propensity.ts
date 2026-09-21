import { defineTool } from "eve/tools";
import { z } from "zod";
import { FEATURE_NAMES, featuresOf, loadCustomers } from "../lib/data";
import { fitLogistic, predictLogistic } from "../lib/models";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Fit a regularized logistic response (propensity) model on the historical campaign frame and score every customer's probability of buying. Returns fit quality (AUC, log-loss), standardized coefficients, decile lift, and the top-scoring customers. Propensity answers 'who is likely to buy' — it does not answer 'who buys because of the promotion'; use score_uplift for targeting decisions.",
  inputSchema: z.object({
    territories: z.array(z.string()).optional(),
    iterations: z.number().int().min(50).max(3_000).default(400),
    l2: z.number().min(0).max(1).default(0.001),
    topN: z.number().int().min(0).max(200).default(10),
  }),
  label: { start: () => "Fit response propensity model" },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadCustomers();
    const pool = input.territories?.length
      ? rows.filter((c) => input.territories!.includes(c.territory))
      : rows;
    if (pool.length < 100) {
      throw new Error(`Only ${pool.length} customers after filtering; a response model needs at least 100 rows.`);
    }

    const model = fitLogistic(
      pool.map((c) => ({ features: featuresOf(c), label: c.history.responded ? 1 : 0 })),
      [...FEATURE_NAMES],
      { iterations: input.iterations, l2: input.l2 },
    );

    const scored = pool
      .map((c) => ({ customerId: c.id, score: predictLogistic(model, featuresOf(c)), responded: c.history.responded }))
      .sort((a, b) => b.score - a.score);

    const deciles = Array.from({ length: 10 }, (_, d) => {
      const size = Math.floor(scored.length / 10);
      const slice = scored.slice(d * size, (d + 1) * size);
      const rate = slice.filter((s) => s.responded).length / slice.length;
      return {
        decile: d + 1,
        customers: slice.length,
        responseRate: Math.round(rate * 1e4) / 1e4,
        lift: Math.round((rate / model.baseRate) * 100) / 100,
      };
    });

    return {
      provenance,
      source,
      warning,
      model: {
        n: model.n,
        auc: model.auc,
        logLoss: model.logLoss,
        baseRate: model.baseRate,
        coefficients: model.featureNames.map((name, i) => ({
          feature: name,
          standardizedWeight: model.weights[i]!,
        })).sort((a, b) => Math.abs(b.standardizedWeight) - Math.abs(a.standardizedWeight)),
      },
      fitQuality:
        model.auc >= 0.7
          ? "Usable: AUC at or above 0.70."
          : model.auc >= 0.6
            ? "Weak but usable: AUC 0.60-0.70. Widen the feature set before relying on thin slices."
            : "Not usable for targeting: AUC below 0.60 is close to random ordering.",
      deciles,
      topCustomers: scored.slice(0, input.topN),
      caution:
        "Ranking by propensity concentrates contacts on sure things. Targeting on this score alone buys demand that already exists.",
    };
  },
});
