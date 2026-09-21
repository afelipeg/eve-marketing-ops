import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { mulberry32 } from "../lib/random";
import { channelSchema, offerSchema } from "../lib/types";

/**
 * Coupon manifest preparation. No delivery connection is configured in this
 * project, so this tool must never claim that customer contact occurred.
 */
export default defineTool({
  outputSchema: z.looseObject({}),
  // Spending money in a customer-facing channel: never automatic.
  approval: always(),
  description:
    "Prepare (but do not deliver) an approved offer manifest for email, SMS, in-store, or e-commerce, with a randomized control group. No delivery connection is configured, so this tool always returns executed=false and a manifest handoff for an external sender.",
  inputSchema: z.object({
    campaignId: z.string().min(1),
    audienceIds: z.array(z.string()).min(1),
    channel: channelSchema,
    offer: offerSchema,
    gatePassed: z
      .boolean()
      .describe("Must be the gate.passed value returned by optimize_targeting_depth."),
    expectedIncrementalMargin: z.number(),
    expectedCost: z.number(),
    holdoutPct: z
      .number()
      .min(0)
      .max(50)
      .default(10)
      .describe("Share of the audience randomly withheld as the measurement control."),
    seed: z.number().int().default(1),
  }),
  label: {
    start: ({ campaignId, channel, audienceIds }) =>
      `Prepare ${campaignId} · ${channel} · ${audienceIds.length} contacts`,
  },
  execute(input) {
    if (!input.gatePassed) {
      return {
        executed: false,
        refused: true,
        reason:
          "The targeting gate did not pass: expected incremental margin does not exceed expected cost. No offer will be issued.",
      };
    }
    if (input.expectedIncrementalMargin <= input.expectedCost) {
      return {
        executed: false,
        refused: true,
        reason: `Expected incremental margin ${input.expectedIncrementalMargin} does not exceed expected cost ${input.expectedCost}. No offer will be issued.`,
      };
    }
    if (input.holdoutPct <= 0) {
      return {
        executed: false,
        refused: true,
        reason:
          "No holdout reserved. Without a randomized control the campaign cannot be measured, only counted. Set holdoutPct to at least 5.",
      };
    }

    // Deterministic assignment, so the control group is reproducible.
    const rng = mulberry32(input.seed);
    const assigned = input.audienceIds.map((id) => ({
      customerId: id,
      arm: rng() < input.holdoutPct / 100 ? ("control" as const) : ("treatment" as const),
    }));
    const treatment = assigned.filter((a) => a.arm === "treatment");
    const control = assigned.filter((a) => a.arm === "control");

    // Checking the PARAMETER is not checking the holdout. Assignment is
    // Bernoulli per customer, so a small audience at a small holdoutPct can
    // realize an empty control group — and this tool promises it "refuses to
    // execute unless a holdout is reserved". Verify the group that actually
    // exists, not the number that was requested.
    if (control.length === 0) {
      return {
        executed: false,
        refused: true,
        reason: `Randomization produced an empty control group: ${input.audienceIds.length} customers at ${input.holdoutPct}% holdout assigned everyone to treatment (seed ${input.seed}). Sending now would spend the budget with nothing to measure against. Raise holdoutPct, widen the audience, or change the seed.`,
        requestedHoldoutPct: input.holdoutPct,
        audienceSize: input.audienceIds.length,
      };
    }

    const manifest = treatment.map((row, index) => ({
      customerId: row.customerId,
      channel: input.channel,
      couponCode: `${input.campaignId.toUpperCase().replace(/[^A-Z0-9]/g, "")}-${String(index + 1).padStart(6, "0")}`,
      offerType: input.offer.type,
      depth: input.offer.depth,
      minimumBasket: input.offer.minimumBasket ?? null,
    }));

    return {
      executed: false,
      previewPrepared: true,
      fullManifestPrepared: false,
      deliveryConnection: null,
      deliveryStatus: "blocked:no-delivery-connection",
      campaignId: input.campaignId,
      channel: input.channel,
      contacts: treatment.length,
      holdout: {
        size: control.length,
        pct: input.holdoutPct,
        seed: input.seed,
        customerIds: control.map((c) => c.customerId),
      },
      expectedEconomics: {
        incrementalMargin: input.expectedIncrementalMargin,
        cost: input.expectedCost,
        net: Math.round((input.expectedIncrementalMargin - input.expectedCost) * 100) / 100,
      },
      manifestSample: manifest.slice(0, 10),
      manifestSize: manifest.length,
      nextStep:
        "Nothing was delivered or exported. This tool returns only a 10-row review sample and intentionally does not persist the customer-level manifest. Configure an approved delivery connection, then regenerate the assignment inside that sender using the same campaignId, audience, holdoutPct, and seed.",
    };
  },
});
