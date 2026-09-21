import { defineTool } from "eve/tools";
import { z } from "zod";
import { hashSeed, mulberry32, randomBinomial, round } from "../lib/random";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Generate synthetic test/control arms from explicit assumptions, for design rehearsal when real logs are unavailable. Output is labeled synthetic and must never be reported as a measurement of a real action — only as a demonstration of what a design of that size would produce.",
  inputSchema: z.object({
    baselineRate: z.number().min(0).max(1),
    trueRelativeLiftPct: z.number(),
    nControl: z.number().int().min(1),
    nTreatment: z.number().int().min(1),
    cells: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(1)
      .describe("Split the sample into this many cells with heterogeneous true rates."),
    cellHeterogeneityPct: z
      .number()
      .min(0)
      .max(100)
      .default(0)
      .describe("Spread of true cell baselines around the population baseline."),
    seed: z.number().int().optional(),
  }),
  label: {
    start: ({ nControl, nTreatment, cells }) =>
      `Synthesize ${cells} cell(s) · ${nControl}/${nTreatment} exposures`,
  },
  execute(input) {
    const seed =
      input.seed ??
      hashSeed(`synth:${input.baselineRate}:${input.trueRelativeLiftPct}:${input.nControl}:${input.nTreatment}:${input.cells}`);
    const rng = mulberry32(seed);

    const perCellControl = Math.floor(input.nControl / input.cells);
    const perCellTreatment = Math.floor(input.nTreatment / input.cells);
    const spread = input.cellHeterogeneityPct / 100;

    const cells = Array.from({ length: input.cells }, (_, i) => {
      const offset = input.cells === 1 ? 0 : (rng() * 2 - 1) * spread;
      const cellBaseline = Math.min(0.999, Math.max(0.0001, input.baselineRate * (1 + offset)));
      const cellTreatmentRate = Math.min(
        0.999999,
        cellBaseline * (1 + input.trueRelativeLiftPct / 100),
      );
      return {
        label: `cell-${i + 1}`,
        trueControlRate: round(cellBaseline, 6),
        trueTreatmentRate: round(cellTreatmentRate, 6),
        control: {
          n: perCellControl,
          conversions: randomBinomial(perCellControl, cellBaseline, rng),
        },
        treatment: {
          n: perCellTreatment,
          conversions: randomBinomial(perCellTreatment, cellTreatmentRate, rng),
        },
      };
    });

    return {
      provenance: "synthetic",
      warning:
        "SYNTHETIC DATA generated from the stated assumptions. It measures nothing about any real action. Label every figure derived from it as synthetic.",
      assumptions: {
        baselineRate: input.baselineRate,
        trueRelativeLiftPct: input.trueRelativeLiftPct,
        cellHeterogeneityPct: input.cellHeterogeneityPct,
      },
      seed,
      cells,
      nextStep:
        input.cells > 1
          ? "Pass these cells to gibbs_hierarchical_uplift to rehearse the pooled read."
          : "Pass these counts to beta_binomial_uplift to rehearse the read.",
    };
  },
});
