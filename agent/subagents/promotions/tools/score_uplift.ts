import { defineTool } from "eve/tools";
import { z } from "zod";
import { FEATURE_NAMES, featuresOf, loadCustomers } from "../lib/data";
import { classifyResponse, fitUplift, predictUplift, qini } from "../lib/models";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Fit a two-model (T-learner) uplift model on the treated and control arms of the historical campaign frame and score every customer's incremental response: uplift, treated and control probabilities, and response type (persuadable, sure_thing, lost_cause, sleeping_dog). Returns the Qini curve and coefficient as evidence the model beats random targeting. This is the score targeting decisions are made on.",
  inputSchema: z.object({
    territories: z.array(z.string()).optional(),
    upliftPositiveThreshold: z.number().default(0.05).describe("Uplift at or above this is a persuadable."),
    upliftNegativeThreshold: z.number().default(-0.01).describe("Uplift at or below this is a sleeping dog."),
    highBaselineThreshold: z.number().default(0.4).describe("Control probability at or above this is a sure thing."),
    iterations: z.number().int().min(50).max(3_000).default(400),
    topN: z.number().int().min(0).max(200).default(10),
  }),
  label: { start: () => "Fit uplift model (T-learner)" },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadCustomers();
    const pool = input.territories?.length
      ? rows.filter((c) => input.territories!.includes(c.territory))
      : rows;

    const model = fitUplift(
      pool.map((c) => ({
        features: featuresOf(c),
        label: c.history.responded ? 1 : 0,
        treated: c.history.treated,
      })),
      [...FEATURE_NAMES],
      { iterations: input.iterations },
    );

    const thresholds = {
      upliftPositive: input.upliftPositiveThreshold,
      upliftNegative: input.upliftNegativeThreshold,
      highBaseline: input.highBaselineThreshold,
    };

    const scored = pool.map((c) => {
      const prediction = predictUplift(model, featuresOf(c));
      return {
        customerId: c.id,
        uplift: Math.round(prediction.uplift * 1e6) / 1e6,
        treatedProbability: Math.round(prediction.treatedProbability * 1e6) / 1e6,
        controlProbability: Math.round(prediction.controlProbability * 1e6) / 1e6,
        responseType: classifyResponse(prediction.treatedProbability, prediction.controlProbability, thresholds),
        marginPerOrder: c.monetary,
        treated: c.history.treated,
        responded: c.history.responded,
      };
    });

    const qiniResult = qini(
      scored.map((s) => ({ upliftScore: s.uplift, treated: s.treated, responded: s.responded })),
    );

    const mix = ["persuadable", "sure_thing", "lost_cause", "sleeping_dog"].map((type) => {
      const members = scored.filter((s) => s.responseType === type);
      return {
        responseType: type,
        customers: members.length,
        share: Math.round((members.length / scored.length) * 1e4) / 1e4,
        meanUplift:
          members.length === 0
            ? 0
            : Math.round((members.reduce((s, m) => s + m.uplift, 0) / members.length) * 1e6) / 1e6,
      };
    });

    return {
      provenance,
      source,
      warning,
      model: {
        treatedN: model.treatedN,
        controlN: model.controlN,
        observedTreatedRate: model.observedTreatedRate,
        observedControlRate: model.observedControlRate,
        observedAverageUplift: model.observedAverageUplift,
        treatedAuc: model.treatedModel.auc,
        controlAuc: model.controlModel.auc,
      },
      thresholds,
      responseMix: mix,
      qini: qiniResult,
      modelValue:
        qiniResult.qiniCoefficient > 0.1
          ? `Qini ${qiniResult.qiniCoefficient}: the model orders incremental response materially better than random targeting.`
          : `Qini ${qiniResult.qiniCoefficient}: the model barely beats random targeting. Targeting on it adds little; say so rather than presenting it as precision.`,
      topPersuadables: scored
        .filter((s) => s.responseType === "persuadable")
        .sort((a, b) => b.uplift - a.uplift)
        .slice(0, input.topN),
      sleepingDogsExcluded: scored.filter((s) => s.responseType === "sleeping_dog").length,
      caution:
        "Sleeping dogs must be suppressed, not merely deprioritized: contacting them reduces demand. Sure things are excluded on economics, since the discount is paid on a purchase that would have happened anyway.",
    };
  },
});
