import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Package an advertising campaign as a measurement request: geo-holdout or PSA-control design, arms, spend, realized CPA and per-channel CPA_a, and the minimum detectable effect the exposure supports. The measurement agent is a sibling specialist, so this returns the request for the orchestrator to route. Use it instead of claiming incrementality from attribution shares.",
  inputSchema: z.object({
    campaignId: z.string().min(1),
    creativeId: z.string().min(1),
    design: z.enum(["geo-holdout", "psa-control", "ghost-ads", "switchback", "observational"]).default("geo-holdout"),
    treatmentExposures: z.number().int().min(1),
    controlExposures: z.number().int().min(1),
    baselineConversionRate: z.number().min(0).max(1),
    spend: z.number().min(0),
    conversions: z.number().min(0),
    channelCpa: z
      .array(z.object({ channel: z.string(), spend: z.number().min(0), attributedConversions: z.number().min(0) }))
      .default([]),
    windowDays: z.number().int().min(1).default(28),
    territory: z.string().default("all"),
  }),
  label: { start: ({ campaignId }) => `Measurement handoff · ${campaignId}` },
  execute(input) {
    const nPerArm = Math.min(input.treatmentExposures, input.controlExposures);
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

    const cpa = input.conversions <= 0 ? null : Math.round((input.spend / input.conversions) * 100) / 100;
    const perChannel = input.channelCpa.map((c) => ({
      channel: c.channel,
      spend: c.spend,
      attributedConversions: c.attributedConversions,
      cpaAttributed: c.attributedConversions <= 0 ? null : Math.round((c.spend / c.attributedConversions) * 100) / 100,
    }));

    return {
      measurementRequest: {
        campaignId: input.campaignId,
        service: "advertisements",
        creativeId: input.creativeId,
        design: input.design,
        unit: input.design === "geo-holdout" ? "geo" : "user",
        metric: "conversion_rate",
        territory: input.territory,
        windowDays: input.windowDays,
        arms: {
          treatment: { n: input.treatmentExposures },
          control: { n: input.controlExposures },
        },
      },
      reported: { spend: input.spend, conversions: input.conversions, cpaBlended: cpa, cpaAttributed: perChannel },
      power: { nPerArm, baselineConversionRate: p, minimumDetectableEffectPct: mdeRelativePct },
      designNote:
        input.design === "observational"
          ? "No randomized control: report as association with the identifying assumption stated. Exposed users self-select by browsing behaviour, which biases naive exposed-vs-unexposed comparisons upward."
          : input.design === "psa-control"
            ? "PSA control holds auction participation constant, so the control group is matched on winnability rather than on browsing behaviour."
            : input.design === "ghost-ads"
              ? "Ghost ads log the impressions the campaign would have won for control users, giving the cleanest exposed-vs-would-have-been-exposed comparison available in RTB."
              : "Geo-holdout: matched markets held out for the full window; the unit of analysis is the geo, not the user.",
      routing:
        "Return this to the orchestrator, which routes it to the measurement agent. Attribution shares are not incrementality; only the holdout read settles that.",
    };
  },
});
