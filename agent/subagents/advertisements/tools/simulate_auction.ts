import { defineTool } from "eve/tools";
import { z } from "zod";
import { clearSecondPrice, pacingFactor, simulateCampaign } from "../lib/bidding";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Simulate second-price (Vickrey) clearing for a single bid or a batch: win/loss, clearing price, surplus, win rate, spend, average and median clearing CPM, and projected CPA. Also exposes the pacing multiplier for a given spend position. Use to test a bid policy before it is live — the clearing price is set by the runner-up, so raising a bid buys volume, not a better price.",
  inputSchema: z.object({
    mode: z.enum(["single", "campaign", "pacing"]),
    single: z
      .object({
        bidCpm: z.number().min(0),
        competingBids: z.array(z.number().min(0)),
        floorCpm: z.number().min(0),
      })
      .optional(),
    campaign: z
      .object({
        bids: z
          .array(
            z.object({
              bidCpm: z.number().min(0),
              floorCpm: z.number().min(0),
              expectedConversionsPerThousand: z.number().min(0),
            }),
          )
          .min(1),
        medianCompetitorCpm: z.number().min(0),
        bidders: z.number().int().min(1).max(50).default(4),
        dispersion: z.number().min(0).max(3).default(0.5),
        seed: z.number().int().default(7),
      })
      .optional(),
    pacing: z
      .object({
        budgetSpent: z.number().min(0),
        budgetTotal: z.number().min(0),
        elapsedShare: z.number().min(0).max(1),
        aggressiveness: z.number().min(0).max(2).default(0.5),
      })
      .optional(),
  }),
  label: { start: ({ mode }) => `Simulate auction · ${mode}` },
  execute(input) {
    if (input.mode === "single") {
      if (!input.single) throw new Error("mode 'single' needs a single object.");
      const outcome = clearSecondPrice(input.single);
      const higher = clearSecondPrice({ ...input.single, bidCpm: input.single.bidCpm * 1.5 });
      return {
        mode: "single",
        ...outcome,
        truthfulness: {
          bidRaised50Pct: higher.bidCpm,
          clearingPriceUnchanged: higher.clearingCpm === outcome.clearingCpm || !outcome.won,
          note: "In a second-price auction the price is the runner-up bid, so the dominant strategy is to bid true expected value. Shading below it loses impressions without lowering the price paid.",
        },
      };
    }

    if (input.mode === "campaign") {
      if (!input.campaign) throw new Error("mode 'campaign' needs a campaign object.");
      const result = simulateCampaign(input.campaign);
      return {
        mode: "campaign",
        ...result,
        reading:
          result.winRate > 0.8
            ? "Win rate above 80%: the bid is almost certainly above market. Lower it and re-check CPA."
            : result.winRate < 0.05
              ? "Win rate below 5%: either the bid is below the market or the floors are binding. Check the no-bid reasons."
              : "Win rate in a normal operating range.",
        caution:
          "Simulated competition is a model, not the exchange. Treat projected CPA as a planning number and hand the realized read to measurement.",
      };
    }

    if (!input.pacing) throw new Error("mode 'pacing' needs a pacing object.");
    const pace = pacingFactor(input.pacing);
    return {
      mode: "pacing",
      ...pace,
      note:
        "The factor multiplies every bid. Chasing an underspend with a large multiplier buys the worst inventory of the day; prefer widening targeting over raising bids.",
    };
  },
});
