import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Package a recommender change as a measurement request: design, arms, the primary business metric, the offline metrics that motivated it (precision@k, recall@k, NDCG, coverage, novelty, serendipity), and the minimum detectable effect the traffic supports. The measurement agent is a sibling specialist, so this returns the request for the orchestrator to route.",
  inputSchema: z.object({
    experimentId: z.string().min(1),
    variant: z.string().min(1).describe("What changed, e.g. 'timeSVD++ with MMR 0.7 vs item-kNN'."),
    surface: z.enum(["web", "mobile", "email", "pdp"]),
    design: z.enum(["randomized", "interleaving", "switchback", "observational"]).default("randomized"),
    treatmentUsers: z.number().int().min(1),
    controlUsers: z.number().int().min(1),
    baselineConversionRate: z.number().min(0).max(1),
    primaryMetric: z.string().default("conversion_rate"),
    offlineMetrics: z
      .object({
        precisionAtK: z.number().optional(),
        recallAtK: z.number().optional(),
        ndcgAtK: z.number().optional(),
        coverage: z.number().optional(),
        novelty: z.number().optional(),
        serendipity: z.number().optional(),
      })
      .default({}),
    windowDays: z.number().int().min(1).default(28),
  }),
  label: { start: ({ experimentId }) => `Measurement handoff · ${experimentId}` },
  execute(input) {
    const nPerArm = Math.min(input.treatmentUsers, input.controlUsers);
    const p = input.baselineConversionRate;
    // A baseline of exactly 0 or 1 makes the standard error degenerate: the
    // MDE comes out NaN (or 0), and `underpowered` then compares against NaN
    // and returns false — reporting an unresolvable design as adequately
    // powered. Refuse instead of publishing a confident nonsense number.
    if (!(p > 0 && p < 1)) {
      return {
        unresolvable: true,
        reason: `baselineConversionRate is ${p}. A baseline of exactly 0 or 1 gives no variance to detect against, so no minimum detectable effect exists. Supply the real baseline rate before designing the test.`,
        power: { nPerArm, minimumDetectableEffectPct: null, underpowered: null },
      };
    }
    const se = Math.sqrt((2 * p * (1 - p)) / nPerArm);
    const mdeRelativePct = p === 0 ? Number.NaN : Math.round(((1.645 + 0.842) * se / p) * 1000) / 10;

    return {
      measurementRequest: {
        experimentId: input.experimentId,
        service: "recommendations",
        variant: input.variant,
        surface: input.surface,
        design: input.design,
        unit: input.design === "interleaving" ? "impression" : "user",
        metric: input.primaryMetric,
        windowDays: input.windowDays,
        arms: { treatment: { n: input.treatmentUsers }, control: { n: input.controlUsers } },
        guardrailMetrics: ["catalog_coverage", "mean_item_popularity", "margin_per_session"],
      },
      offlineEvidence: input.offlineMetrics,
      power: { nPerArm, baselineConversionRate: p, minimumDetectableEffectPct: mdeRelativePct },
      designNote:
        input.design === "interleaving"
          ? "Interleaving mixes both rankers' results in one list and compares clicks within the same user. Far more sensitive than an A/B split, but it measures ranking preference, not downstream business effect."
          : input.design === "observational"
            ? "No randomization: users who engage with recommendations differ from those who do not. Report as association with the assumption stated."
            : "User-level randomization with the variant held for the full window.",
      caution:
        "Offline gains in precision@k routinely fail to reproduce online: logged interactions carry the previous recommender's bias, and a novel slate is penalized by metrics computed on what the old policy showed. Only the online read settles it.",
      routing: "Return to the orchestrator, which routes it to the measurement agent.",
    };
  },
});
