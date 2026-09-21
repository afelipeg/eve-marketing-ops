import { defineTool } from "eve/tools";
import { z } from "zod";
import { mulberry32, randomNormal } from "../lib/random";
import { loadSegments } from "../lib/data";
import { evaluateBundle, optimizeTwoPartTariff } from "../lib/optimize";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Design a multi-part tariff (fixed fee plus per-unit price) or evaluate bundling (pure versus mixed versus standalone) against a willingness-to-pay distribution. Reports the WTP correlation, which is what decides whether bundling pays: bundling gains come from negatively correlated WTP and collapse toward zero as correlation rises.",
  inputSchema: z.object({
    structure: z.enum(["bundle", "two_part"]),
    unitCosts: z.array(z.number().min(0)).min(1),
    bundle: z
      .object({
        wtpMeans: z.array(z.number().min(0)).min(2),
        wtpStdDevs: z.array(z.number().min(0)).min(2),
        correlation: z.number().min(-1).max(1).default(0),
        customers: z.number().int().min(50).max(5_000).default(800),
        priceGridSteps: z.number().int().min(5).max(60).default(30),
        seed: z.number().int().default(7),
      })
      .optional(),
    twoPart: z
      .object({
        marketSize: z.number().min(1).default(10_000),
        usageBase: z.number().min(0).default(20),
        usageSlope: z.number().min(0).default(2),
        feeMax: z.number().min(0).default(40),
        priceMax: z.number().min(0).default(10),
        steps: z.number().int().min(10).max(60).default(30),
      })
      .optional(),
  }),
  label: { start: ({ structure }) => `Design ${structure === "bundle" ? "bundle" : "two-part tariff"}` },
  async execute(input) {
    if (input.structure === "two_part") {
      const config = input.twoPart ?? {
        marketSize: 10_000,
        usageBase: 20,
        usageSlope: 2,
        feeMax: 40,
        priceMax: 10,
        steps: 30,
      };
      const segments = await loadSegments();
      const result = optimizeTwoPartTariff({
        segments: segments.rows,
        unitCost: input.unitCosts[0]!,
        marketSize: config.marketSize,
        usageBase: config.usageBase,
        usageSlope: config.usageSlope,
        feeMax: config.feeMax,
        priceMax: config.priceMax,
        steps: config.steps,
      });

      return {
        provenance: segments.provenance,
        warning: segments.warning,
        structure: "two_part",
        optimum: result.optimum,
        topGrid: result.grid,
        theory:
          "With one homogeneous segment the optimum is a per-unit price at marginal cost and a fee equal to the whole consumer surplus. With heterogeneous segments that fee excludes the low-WTP segment, so the optimum trades participation against extraction — which is why this is solved numerically.",
        marginalCostNote: result.marginalCostNote,
        cautions: [
          `Participating segments at the optimum: ${result.optimum.participatingSegments.join(", ") || "none"}. A fee that excludes a segment is a decision to not serve them; say so explicitly.`,
          "A high fixed fee raises churn risk and regulatory attention in consumer markets. The margin gain is immediate; the participation loss shows up later.",
        ],
      };
    }

    const config = input.bundle;
    if (!config) throw new Error("structure 'bundle' needs a bundle configuration.");
    if (config.wtpMeans.length !== input.unitCosts.length) {
      throw new Error("wtpMeans and unitCosts must have the same length.");
    }

    // Draw correlated WTP by a shared latent factor.
    const rng = mulberry32(config.seed);
    const rho = config.correlation;
    const wtpMatrix = Array.from({ length: config.customers }, () => {
      const common = randomNormal(rng);
      return config.wtpMeans.map((mean, j) => {
        const idiosyncratic = randomNormal(rng);
        const sign = j === 0 ? 1 : Math.sign(rho) || 1;
        const loading = Math.sqrt(Math.abs(rho));
        const z = sign * loading * common + Math.sqrt(1 - Math.abs(rho)) * idiosyncratic;
        return Math.max(0, mean + config.wtpStdDevs[j]! * z);
      });
    });

    const maxTotal = Math.max(...wtpMatrix.map((row) => row.reduce((s, v) => s + v, 0)));
    const bundleGrid = Array.from(
      { length: config.priceGridSteps },
      (_, i) => ((i + 1) * maxTotal) / config.priceGridSteps,
    );
    const standaloneGrids = config.wtpMeans.map((mean, j) =>
      Array.from({ length: 14 }, (_, i) => Math.max(input.unitCosts[j]!, (mean * (i + 3)) / 10)),
    );

    const result = evaluateBundle({
      wtpMatrix,
      unitCosts: input.unitCosts,
      bundlePriceGrid: bundleGrid,
      standalonePriceGrids: standaloneGrids,
    });

    const bundleGain = result.bestPureBundle.margin - result.bestStandalone.margin;

    return {
      structure: "bundle",
      requestedCorrelation: config.correlation,
      realizedWtpCorrelation: result.wtpCorrelation,
      standalone: result.bestStandalone,
      pureBundle: result.bestPureBundle,
      mixedBundle: result.bestMixedBundle,
      bundleGainOverStandalone: Math.round(bundleGain * 100) / 100,
      recommendation: result.recommendation,
      theory:
        "Bundling aggregates willingness to pay. When WTP across items is negatively correlated, aggregation shrinks the variance of total WTP, so a single bundle price captures a larger share of the population than separate prices can. With positively correlated WTP the bundle mostly discounts to customers who would have bought both anyway.",
      cautions: [
        "Mixed bundling (bundle plus standalone) usually dominates pure bundling in practice, because it keeps the single-item buyers. It is also harder to communicate at shelf.",
        "A bundle that is cheaper than one component's standalone price cannibalizes that component. Check the standalone prices against the bundle before launch.",
        "WTP distributions here are assumptions, not measurements. Their shape drives the answer: state where they came from, and prefer a conjoint or a price test over a guess.",
      ],
    };
  },
});
