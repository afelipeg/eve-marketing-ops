import { defineTool } from "eve/tools";
import { z } from "zod";
import { minimumDetectableEffectPct, requiredSampleSize, simulatePower } from "../lib/bayes";
import { hashSeed, mulberry32, quantile, randomBeta, round } from "../lib/random";

/**
 * Monte Carlo simulator. Three modes:
 *  - power:       can a test of this size resolve the effect we care about?
 *  - sample-size: how many exposures per arm does the target power need?
 *  - scenario:    propagate a measured posterior into outcome distributions
 *                 at different exposure volumes (maximization scenarios).
 */
export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Monte Carlo simulator for experiment planning and scenario projection. Mode 'power' returns the probability a test of a given size resolves a given effect; 'sample-size' returns the exposures per arm needed for a target power; 'scenario' propagates a measured uplift posterior into incremental conversions and value across exposure volumes, with credible intervals. Deterministic given the same seed. Reports distributions, never recommendations.",
  inputSchema: z.object({
    mode: z.enum(["power", "sample-size", "scenario"]),
    baselineRate: z.number().min(0).max(1).optional(),
    trueRelativeLiftPct: z.number().optional(),
    nPerArm: z.number().int().min(1).optional(),
    targetPower: z.number().min(0.5).max(0.99).default(0.8),
    ciLevel: z.number().min(0.5).max(0.999).default(0.9),
    simulations: z.number().int().min(50).max(5_000).default(400),
    scenario: z
      .object({
        control: z.object({ n: z.number().int().min(1), conversions: z.number().min(0) }),
        treatment: z.object({ n: z.number().int().min(1), conversions: z.number().min(0) }),
        exposureVolumes: z.array(z.number().int().min(1)).min(1),
        valuePerConversion: z.number().optional(),
        costPerExposure: z.number().optional(),
        draws: z.number().int().min(1_000).max(100_000).default(20_000),
      })
      .optional(),
    seed: z.number().int().optional(),
  }),
  label: { start: ({ mode }) => `Monte Carlo · ${mode}` },
  execute(input) {
    if (input.mode === "power") {
      if (input.baselineRate === undefined || input.trueRelativeLiftPct === undefined || input.nPerArm === undefined) {
        throw new Error("mode 'power' needs baselineRate, trueRelativeLiftPct, and nPerArm.");
      }
      const result = simulatePower({
        baselineRate: input.baselineRate,
        trueRelativeLiftPct: input.trueRelativeLiftPct,
        nPerArm: input.nPerArm,
        simulations: input.simulations,
        ciLevel: input.ciLevel,
        seed: input.seed,
      });
      return {
        mode: "power",
        ...result,
        minimumDetectableEffectPct: minimumDetectableEffectPct({
          baselineRate: input.baselineRate,
          nPerArm: input.nPerArm,
          ciLevel: input.ciLevel,
        }),
        interpretation: `With ${input.nPerArm} exposures per arm, a true relative lift of ${input.trueRelativeLiftPct}% is resolved in ${round(result.power * 100, 1)}% of simulated runs at the ${Math.round(input.ciLevel * 100)}% credible level.`,
      };
    }

    if (input.mode === "sample-size") {
      if (input.baselineRate === undefined || input.trueRelativeLiftPct === undefined) {
        throw new Error("mode 'sample-size' needs baselineRate and trueRelativeLiftPct.");
      }
      const result = requiredSampleSize({
        baselineRate: input.baselineRate,
        trueRelativeLiftPct: input.trueRelativeLiftPct,
        targetPower: input.targetPower,
        ciLevel: input.ciLevel,
        simulations: Math.min(input.simulations, 300),
        seed: input.seed,
      });
      return {
        mode: "sample-size",
        ...result,
        interpretation:
          result.nPerArm === null
            ? `No per-arm size within the search bound reached ${Math.round(input.targetPower * 100)}% power for a ${input.trueRelativeLiftPct}% lift.`
            : `About ${result.nPerArm} exposures per arm (${result.nPerArm * 2} total) reach ${Math.round(result.achievedPower * 100)}% power for a ${input.trueRelativeLiftPct}% lift at a ${Math.round(input.ciLevel * 100)}% credible level.`,
      };
    }

    const scenario = input.scenario;
    if (!scenario) throw new Error("mode 'scenario' needs a scenario object.");
    for (const [arm, counts] of [["control", scenario.control], ["treatment", scenario.treatment]] as const) {
      if (counts.conversions > counts.n) {
        throw new Error(
          `${arm}: conversions (${counts.conversions}) exceed exposures (${counts.n}). Beta parameters would be negative; check the inputs.`,
        );
      }
    }

    const seed =
      input.seed ??
      hashSeed(`scenario:${scenario.control.n}:${scenario.control.conversions}:${scenario.treatment.n}:${scenario.treatment.conversions}`);
    const rng = mulberry32(seed);
    const lo = (1 - input.ciLevel) / 2;
    const hi = 1 - lo;

    const cA = 1 + scenario.control.conversions;
    const cB = 1 + scenario.control.n - scenario.control.conversions;
    const tA = 1 + scenario.treatment.conversions;
    const tB = 1 + scenario.treatment.n - scenario.treatment.conversions;

    const absoluteLift: number[] = new Array(scenario.draws);
    for (let i = 0; i < scenario.draws; i++) {
      absoluteLift[i] = randomBeta(tA, tB, rng) - randomBeta(cA, cB, rng);
    }

    const projections = scenario.exposureVolumes.map((volume) => {
      const incremental = absoluteLift.map((d) => d * volume);
      const value =
        scenario.valuePerConversion === undefined
          ? null
          : incremental.map((c) => c * scenario.valuePerConversion!);
      const cost = scenario.costPerExposure === undefined ? null : scenario.costPerExposure * volume;
      const net = value === null || cost === null ? null : value.map((v) => v - cost);

      return {
        exposures: volume,
        incrementalConversions: {
          estimate: round(incremental.reduce((s, v) => s + v, 0) / incremental.length, 2),
          ci: [round(quantile(incremental, lo), 2), round(quantile(incremental, hi), 2)] as [number, number],
        },
        incrementalValue:
          value === null
            ? null
            : {
                estimate: round(value.reduce((s, v) => s + v, 0) / value.length, 2),
                ci: [round(quantile(value, lo), 2), round(quantile(value, hi), 2)] as [number, number],
              },
        cost,
        netValue:
          net === null
            ? null
            : {
                estimate: round(net.reduce((s, v) => s + v, 0) / net.length, 2),
                ci: [round(quantile(net, lo), 2), round(quantile(net, hi), 2)] as [number, number],
                probabilityPositive: round(net.filter((v) => v > 0).length / net.length, 4),
              },
      };
    });

    return {
      mode: "scenario",
      seed,
      ciLevel: input.ciLevel,
      draws: scenario.draws,
      posteriorAbsoluteLift: {
        estimate: round(absoluteLift.reduce((s, v) => s + v, 0) / absoluteLift.length, 6),
        ci: [round(quantile(absoluteLift, lo), 6), round(quantile(absoluteLift, hi), 6)] as [number, number],
      },
      projections,
      caution:
        "Projections assume the measured effect transfers unchanged to the new volume. Response curves saturate, so extrapolation beyond roughly 2x the tested exposure is not supported by this posterior.",
    };
  },
});
