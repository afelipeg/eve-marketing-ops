import { defineTool } from "eve/tools";
import { z } from "zod";
import { FEATURE_NAMES, featuresOf, loadCustomers } from "../lib/data";
import { classifyResponse, fitUplift, predictUplift } from "../lib/models";
import { applyHardConditions, offerValue, optimizeDepth } from "../lib/targeting";
import { capsSchema, hardConditionsSchema, objectiveSchema, offerSchema } from "../lib/types";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Run the full targeting pipeline for one campaign: hard conditions, uplift scoring, offer economics, depth optimization by ROI, and frequency/pressure caps. Returns the selected audience, the expected incremental margin, the expected cost including discount paid to redeemers, the ROI curve by decile, and a send/do-not-send gate. Call this before issue_offers — the gate must pass.",
  inputSchema: z.object({
    objective: objectiveSchema,
    offer: offerSchema,
    hardConditions: hardConditionsSchema,
    caps: capsSchema,
    upliftPositiveThreshold: z.number().default(0.05),
    upliftNegativeThreshold: z.number().default(-0.01),
    highBaselineThreshold: z.number().default(0.4),
    excludeSureThings: z.boolean().default(true),
    minNetValuePerContact: z.number().default(0),
  }),
  label: {
    start: ({ objective, offer }) => `Optimize depth · ${objective} · ${offer.type} ${offer.depth}`,
  },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadCustomers();

    const hard = applyHardConditions(rows, input.hardConditions, input.caps);
    if (hard.eligible.length === 0) {
      return {
        provenance,
        warning,
        refused: true,
        reason: "No customer survives the hard conditions.",
        excluded: hard.excluded,
        startingCount: hard.startingCount,
      };
    }

    const model = fitUplift(
      rows.map((c) => ({
        features: featuresOf(c),
        label: c.history.responded ? 1 : 0,
        treated: c.history.treated,
      })),
      [...FEATURE_NAMES],
    );

    const thresholds = {
      upliftPositive: input.upliftPositiveThreshold,
      upliftNegative: input.upliftNegativeThreshold,
      highBaseline: input.highBaselineThreshold,
    };

    const scored = hard.eligible.map((customer) => {
      const prediction = predictUplift(model, featuresOf(customer));
      const responseType = classifyResponse(
        prediction.treatedProbability,
        prediction.controlProbability,
        thresholds,
      );
      const discountValue = offerValue(input.offer, customer.avgOrderValue);
      // The discount is paid by everyone who redeems, not only by those the
      // offer moved. That is why sure things destroy campaign economics.
      const expectedCost =
        input.offer.costPerContact + prediction.treatedProbability * discountValue;
      const expectedIncrementalMargin = prediction.uplift * customer.monetary;
      return {
        customerId: customer.id,
        upliftScore: prediction.uplift,
        treatedProbability: prediction.treatedProbability,
        controlProbability: prediction.controlProbability,
        expectedIncrementalMargin,
        expectedCost,
        netValue: expectedIncrementalMargin - expectedCost,
        responseType,
      };
    });

    const sleepingDogs = scored.filter((s) => s.responseType === "sleeping_dog");
    const sureThings = scored.filter((s) => s.responseType === "sure_thing");
    let candidates = scored.filter((s) => s.responseType !== "sleeping_dog");
    if (input.excludeSureThings) {
      candidates = candidates.filter((s) => s.responseType !== "sure_thing");
    }

    const depth = optimizeDepth(candidates, {
      budget: input.caps.budget,
      maxAudienceShare: input.caps.maxAudienceShare,
      minNetValuePerContact: input.minNetValuePerContact,
    });

    const mix = ["persuadable", "sure_thing", "lost_cause"].map((type) => ({
      responseType: type,
      selected: depth.selected.filter((s) => s.responseType === type).length,
    }));

    return {
      provenance,
      source,
      warning,
      objective: input.objective,
      offer: input.offer,
      funnel: {
        base: hard.startingCount,
        afterHardConditions: hard.eligible.length,
        excludedByRule: hard.excluded,
        suppressedSleepingDogs: sleepingDogs.length,
        excludedSureThings: input.excludeSureThings ? sureThings.length : 0,
        scoredCandidates: candidates.length,
        selected: depth.cutoffRank,
      },
      audienceShare: depth.audienceShare,
      economics: depth.totals,
      roiCurve: depth.curve,
      bindingConstraint: depth.binding,
      selectedMix: mix,
      gate: depth.gate,
      audienceIds: depth.selected.map((s) => s.customerId),
      nextStep: depth.gate.passed
        ? "Gate passed. Hold back a randomized control before sending, then call issue_offers with holdoutPct set, and prepare_measurement_handoff for the read."
        : "Gate failed. Do not send. Report the failure and the reason; reduce depth, change the offer, or narrow the conditions.",
    };
  },
});
