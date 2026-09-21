import { defineTool } from "eve/tools";
import { z } from "zod";
import { channelSchema, objectiveSchema, offerSchema } from "../lib/types";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Package a completed or in-flight campaign as a measurement request: design, arms, metric, expected effect, and the minimum detectable effect the audience size supports. The measurement agent is a sibling specialist, so this tool does not call it — it returns the request for the orchestrator to route. Use it instead of claiming any result yourself.",
  inputSchema: z.object({
    campaignId: z.string().min(1),
    objective: objectiveSchema,
    channel: channelSchema,
    offer: offerSchema,
    treatmentSize: z.number().int().min(1),
    controlSize: z.number().int().min(1),
    baselineResponseRate: z.number().min(0).max(1),
    expectedUpliftPct: z.number(),
    metric: z.string().default("purchase_rate"),
    windowDays: z.number().int().min(1).default(28),
    territory: z.string().default("all"),
  }),
  label: { start: ({ campaignId }) => `Prepare measurement handoff · ${campaignId}` },
  execute(input) {
    // Normal approximation of the smallest resolvable relative effect at 90%
    // credible level and ~80% power, for the smaller of the two arms.
    const nPerArm = Math.min(input.treatmentSize, input.controlSize);
    const p = input.baselineResponseRate;
    // A baseline of exactly 0 or 1 makes the standard error degenerate: the
    // MDE comes out NaN (or 0), and `underpowered` then compares against NaN
    // and returns false — reporting an unresolvable design as adequately
    // powered. Refuse instead of publishing a confident nonsense number.
    if (!(p > 0 && p < 1)) {
      return {
        unresolvable: true,
        reason: `baselineResponseRate is ${p}. A baseline of exactly 0 or 1 gives no variance to detect against, so no minimum detectable effect exists. Supply the real baseline rate before designing the test.`,
        power: { nPerArm, minimumDetectableEffectPct: null, underpowered: null },
      };
    }
    const se = Math.sqrt((2 * p * (1 - p)) / nPerArm);
    const mdeAbsolute = (1.645 + 0.842) * se;
    const mdeRelativePct = p === 0 ? Number.NaN : Math.round((mdeAbsolute / p) * 1000) / 10;
    const underpowered = Math.abs(input.expectedUpliftPct) < mdeRelativePct;

    return {
      measurementRequest: {
        campaignId: input.campaignId,
        service: "promotions",
        design: "randomized",
        unit: "customer",
        metric: input.metric,
        territory: input.territory,
        windowDays: input.windowDays,
        arms: {
          treatment: { n: input.treatmentSize },
          control: { n: input.controlSize },
        },
        offer: input.offer,
        objective: input.objective,
        channel: input.channel,
        expectedUpliftPct: input.expectedUpliftPct,
      },
      power: {
        nPerArm,
        baselineResponseRate: p,
        minimumDetectableEffectPct: mdeRelativePct,
        underpowered,
      },
      routing:
        "Return this to the orchestrator. It routes the request to the measurement agent, which owns the uplift read and the significance verdict.",
      caution: underpowered
        ? `The expected uplift of ${input.expectedUpliftPct}% is below the ${mdeRelativePct}% this design can resolve. Report the campaign as unreadable at this size rather than waiting to interpret a null.`
        : `The design can resolve effects of about ${mdeRelativePct}% or larger.`,
    };
  },
});
