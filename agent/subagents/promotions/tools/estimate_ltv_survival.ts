import { defineTool } from "eve/tools";
import { z } from "zod";
import { FEATURE_NAMES, featuresOf, loadCustomers } from "../lib/data";
import { fitUplift, predictUplift } from "../lib/models";
import { kaplanMeier, lifetimeValue, ltvToCac, savabilityScore } from "../lib/ltv";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Fit a Kaplan-Meier survival curve over time-to-lapse and compute per-customer lifetime value, 12-month churn probability, and the retention score savability x LTV (savability = the modeled retention uplift, i.e. the share of the risk a promotion can actually remove). Optionally returns LTV:CAC against a supplied acquisition cost. Use this to rank retention targets and to test whether acquisition spend is justified.",
  inputSchema: z.object({
    territories: z.array(z.string()).optional(),
    lapseThresholdDays: z.number().int().min(30).max(720).default(180),
    horizonYears: z.number().int().min(1).max(10).default(3),
    annualDiscountRate: z.number().min(0).max(0.5).default(0.1),
    cac: z.number().min(0).optional().describe("Acquisition cost per customer, for the LTV:CAC read."),
    topN: z.number().int().min(0).max(200).default(10),
  }),
  label: { start: () => "Estimate survival, LTV, savability" },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadCustomers();
    const pool = input.territories?.length
      ? rows.filter((c) => input.territories!.includes(c.territory))
      : rows;
    if (pool.length < 50) throw new Error("Need at least 50 customers for a survival estimate.");

    const curve = kaplanMeier(
      pool.map((c) => c.recencyDays),
      pool.map((c) => (c.recencyDays > input.lapseThresholdDays ? 1 : 0)),
    );

    // Retention uplift: the same T-learner, read as "how much does treatment
    // move this customer" — the savable share of their churn risk.
    const upliftModel = fitUplift(
      pool.map((c) => ({
        features: featuresOf(c),
        label: c.history.responded ? 1 : 0,
        treated: c.history.treated,
      })),
      [...FEATURE_NAMES],
    );

    const scored = pool.map((c) => {
      const annualMargin = c.monetary * Math.max(1, c.frequency);
      const ltv = lifetimeValue({
        annualMargin,
        curve,
        tenureDays: c.recencyDays,
        horizonYears: input.horizonYears,
        annualDiscountRate: input.annualDiscountRate,
      });
      const retentionUplift = Math.max(0, predictUplift(upliftModel, featuresOf(c)).uplift);
      const savability = savabilityScore({
        churnProbability: ltv.churnProbability12m,
        retentionUplift,
        ltv: ltv.ltv,
      });
      return {
        customerId: c.id,
        ltv: ltv.ltv,
        annualMargin: Math.round(annualMargin * 100) / 100,
        churnProbability12m: ltv.churnProbability12m,
        retentionUplift: Math.round(retentionUplift * 1e6) / 1e6,
        valueAtRisk: savability.valueAtRisk,
        savabilityScore: savability.score,
        savablePctOfRisk: savability.savablePct,
      };
    });

    const totalLtv = scored.reduce((s, c) => s + c.ltv, 0);
    const averageLtv = Math.round((totalLtv / scored.length) * 100) / 100;

    return {
      provenance,
      source,
      warning,
      survival: {
        n: curve.n,
        lapseEvents: curve.events,
        censored: curve.censored,
        medianSurvivalDays: curve.medianSurvivalDays,
        survivalAt90d: Math.round(curve.survivalAt(90) * 1e4) / 1e4,
        survivalAt180d: Math.round(curve.survivalAt(180) * 1e4) / 1e4,
        survivalAt365d: Math.round(curve.survivalAt(365) * 1e4) / 1e4,
        lapseThresholdDays: input.lapseThresholdDays,
        note: "Customers still active at the cut are censored, not counted as retained forever.",
      },
      ltv: {
        averageLtv,
        horizonYears: input.horizonYears,
        annualDiscountRate: input.annualDiscountRate,
        totalBookValue: Math.round(totalLtv * 100) / 100,
      },
      ltvToCac: input.cac === undefined ? null : ltvToCac(averageLtv, input.cac),
      topRetentionTargets: scored
        .sort((a, b) => b.savabilityScore - a.savabilityScore)
        .slice(0, input.topN),
      caution:
        "Rank retention on savability x LTV, never on LTV alone: the highest-value customers are often the least saveable because they were never leaving.",
    };
  },
});
