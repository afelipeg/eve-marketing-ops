import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Package a price change as a measurement request: design, arms, the metrics that decide it (margin, revenue, units, sell-through, stockouts), and the minimum detectable effect the store or user counts support. The measurement agent is a sibling specialist, so this returns the request for the orchestrator to route. Use it instead of claiming a price change worked.",
  inputSchema: z.object({
    changeId: z.string().min(1),
    skus: z.array(z.string()).min(1),
    description: z.string().min(1).describe("What changes, from what price to what price."),
    design: z.enum(["store-randomized", "geo-holdout", "switchback", "ab-ecommerce", "observational"]).default("store-randomized"),
    treatmentUnits: z.number().int().min(1).describe("Stores, geos or users in treatment."),
    controlUnits: z.number().int().min(1),
    baselineWeeklyUnitsPerUnit: z.number().min(0),
    baselineUnitVariance: z.number().min(0).optional(),
    expectedUnitChangePct: z.number(),
    windowWeeks: z.number().int().min(1).default(8),
    expectedMarginChange: z.number().optional(),
  }),
  label: { start: ({ changeId }) => `Measurement handoff · ${changeId}` },
  execute(input) {
    const nPerArm = Math.min(input.treatmentUnits, input.controlUnits);
    const mean = input.baselineWeeklyUnitsPerUnit * input.windowWeeks;
    // Poisson-ish default when no variance is supplied.
    const variance = input.baselineUnitVariance ?? mean;
    // Zero baseline volume means zero variance and an MDE of NaN, which the
    // underpowered comparison then silently reads as "powered".
    if (!(mean > 0) || !(variance > 0)) {
      return {
        unresolvable: true,
        reason: `Baseline volume over the window is ${mean} with variance ${variance}. Without baseline volume there is no effect size to detect — supply real baseline units before designing the test.`,
        power: { nPerArm, minimumDetectableEffectPct: null, underpowered: null },
      };
    }
    const se = Math.sqrt((2 * variance) / nPerArm);
    const mdeRelativePct = mean === 0 ? Number.NaN : Math.round(((1.645 + 0.842) * se / mean) * 1000) / 10;
    const underpowered = Math.abs(input.expectedUnitChangePct) < mdeRelativePct;

    return {
      measurementRequest: {
        changeId: input.changeId,
        service: "pricing",
        skus: input.skus,
        description: input.description,
        design: input.design,
        unit: input.design === "ab-ecommerce" ? "user" : input.design === "geo-holdout" ? "geo" : "store",
        primaryMetric: "gross_margin",
        secondaryMetrics: ["revenue", "units", "sell_through", "stockout_weeks", "competitor_price_response"],
        windowWeeks: input.windowWeeks,
        arms: { treatment: { n: input.treatmentUnits }, control: { n: input.controlUnits } },
      },
      power: {
        nPerArm,
        baselineUnitsPerUnitOverWindow: Math.round(mean * 100) / 100,
        minimumDetectableEffectPct: mdeRelativePct,
        underpowered,
      },
      expected: {
        unitChangePct: input.expectedUnitChangePct,
        marginChange: input.expectedMarginChange ?? null,
      },
      designNote:
        input.design === "observational"
          ? "No randomization: prices were set where the analyst expected them to work, so a before/after comparison confounds the price move with the reason it was made. Report as association with the assumption stated."
          : input.design === "switchback"
            ? "Switchback alternates price by time block on the same units, which controls unit differences but confounds with day-of-week and competitor timing. Randomize the block order."
            : input.design === "geo-holdout"
              ? "Matched markets held at the old price. The unit of analysis is the geo, not the transaction — the effective sample is the number of geos."
              : "Store-level randomization. Check pre-period balance on baseline units and traffic before trusting the read.",
      cautions: [
        underpowered
          ? `The expected unit change of ${input.expectedUnitChangePct}% is below the ${mdeRelativePct}% this design can resolve. Report it as unreadable at this size rather than interpreting a null later.`
          : `The design can resolve unit effects of about ${mdeRelativePct}% or larger.`,
        "Margin, not revenue, is the primary metric. A price cut that grows revenue and shrinks margin is a loss reported as a win.",
        "Competitor response inside the window contaminates the read. Log competitor prices for both arms over the whole window.",
        "Price changes have a memory: reference-price effects and stockpiling show up after the window closes. A clean in-window result is not a clean annual result.",
      ],
      routing: "Return to the orchestrator, which routes it to the measurement agent.",
    };
  },
});
