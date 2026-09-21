import { defineTool } from "eve/tools";
import { z } from "zod";
import { emsr, littlewood } from "../lib/allocation";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Allocate fixed, perishable capacity across fare or price classes: Littlewood's rule for two classes, EMSR-a or EMSR-b nested protection levels and booking limits for many. Use when capacity cannot be replenished within the selling horizon — a promotional allocation, a limited edition, a delivery slot, an event.",
  inputSchema: z.object({
    method: z.enum(["littlewood", "emsr-a", "emsr-b"]).default("emsr-b"),
    capacity: z.number().min(1),
    classes: z
      .array(
        z.object({
          name: z.string(),
          price: z.number().min(0),
          demandMean: z.number().min(0),
          demandStdDev: z.number().min(0),
        }),
      )
      .min(2)
      .describe("Ordered from highest price to lowest."),
    compareMethods: z.boolean().default(false),
  }),
  label: { start: ({ method, capacity }) => `Allocate ${capacity} units · ${method}` },
  execute(input) {
    const sorted = [...input.classes].sort((a, b) => b.price - a.price);
    const reordered = sorted.some((c, i) => c.name !== input.classes[i]!.name);

    if (input.method === "littlewood") {
      if (sorted.length !== 2) {
        throw new Error(
          `Littlewood's rule is for exactly two classes; ${sorted.length} supplied. Use emsr-b for more.`,
        );
      }
      const result = littlewood({
        highFare: sorted[0]!.price,
        lowFare: sorted[1]!.price,
        highDemandMean: sorted[0]!.demandMean,
        highDemandStdDev: sorted[0]!.demandStdDev,
        capacity: input.capacity,
      });
      return {
        method: "littlewood",
        capacity: input.capacity,
        ...result,
        rule: "Accept a low-price unit while p_low >= p_high · P(D_high > protected). The protection level is the critical fractile of high-class demand.",
        reordered,
      };
    }

    const methods = input.compareMethods
      ? (["emsr-a", "emsr-b"] as const)
      : ([input.method] as ("emsr-a" | "emsr-b")[]);
    const results = methods.map((method) => emsr({ classes: sorted, capacity: input.capacity, method }));

    return {
      capacity: input.capacity,
      classesOrdered: sorted.map((c) => `${c.name}@${c.price}`),
      reordered,
      results,
      comparison:
        results.length === 2
          ? {
              expectedRevenueDelta: Math.round((results[1]!.expectedRevenue - results[0]!.expectedRevenue) * 100) / 100,
              note: "EMSR-a protects against each higher class separately and sums, so it is more conservative and usually leaves revenue on the table. EMSR-b aggregates the higher classes at a revenue-weighted fare and is the standard production heuristic.",
            }
          : undefined,
      cautions: [
        "Protection levels assume normally distributed, independent class demand and no cancellation or recapture. Where customers buy down (a high-value customer taking the cheap class when it is open), protection must be raised or the fences tightened.",
        "Booking limits are nested: the limit for a low class is what remains after protecting everything above it. Selling them as independent buckets over-sells the cheap classes.",
        "Demand forecasts drive this entirely. A protection level computed on a biased forecast is a precisely wrong number — report the forecast's own error beside it.",
      ],
    };
  },
});
