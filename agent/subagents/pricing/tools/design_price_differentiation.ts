import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadProducts, loadSegments } from "../lib/data";
import { optimizeSegmentedPrices, wtpShare } from "../lib/optimize";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Design price differentiation across willingness-to-pay segments: the margin-optimal price per segment, take rate, the gain over the best uniform price, and what happens if the fences fail and everyone buys at the lowest fenced price. Differentiation without an enforceable fence is a discount to everyone.",
  inputSchema: z.object({
    sku: z.string().optional(),
    unitCost: z.number().min(0).optional(),
    marketSize: z.number().min(1).default(10_000),
    priceMin: z.number().min(0).optional(),
    priceMax: z.number().min(0).optional(),
    segments: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          share: z.number().min(0).max(1),
          wtpMean: z.number().min(0),
          wtpStdDev: z.number().min(0),
          elasticityMultiplier: z.number().min(0).default(1),
          fence: z.string(),
        }),
      )
      .optional()
      .describe("Omit to use the configured segments."),
    steps: z.number().int().min(20).max(400).default(120),
  }),
  label: { start: ({ sku }) => `Price differentiation${sku ? ` · ${sku}` : ""}` },
  async execute(input) {
    const [products, configured] = await Promise.all([loadProducts(), loadSegments()]);
    const segments = input.segments ?? configured.rows;
    if (segments.length < 2) throw new Error("Price differentiation needs at least two segments.");

    const shareTotal = segments.reduce((s, seg) => s + seg.share, 0);
    if (Math.abs(shareTotal - 1) > 0.02) {
      throw new Error(`Segment shares sum to ${Math.round(shareTotal * 100) / 100}, not 1.`);
    }

    let unitCost = input.unitCost;
    let priceMin = input.priceMin;
    let priceMax = input.priceMax;
    if (input.sku) {
      const product = products.rows.find((p) => p.sku === input.sku);
      if (!product) throw new Error(`No SKU "${input.sku}".`);
      unitCost ??= product.unitCost;
      priceMin ??= product.priceFloor ?? product.unitCost * 1.02;
      priceMax ??= product.priceCeiling ?? product.currentPrice * 2;
    }
    if (unitCost === undefined) throw new Error("Supply sku or unitCost.");
    priceMin ??= unitCost * 1.02;
    priceMax ??= Math.max(...segments.map((s) => s.wtpMean + 2 * s.wtpStdDev));

    const result = optimizeSegmentedPrices({
      segments,
      unitCost,
      marketSize: input.marketSize,
      priceMin,
      priceMax,
      steps: input.steps,
    });

    const spread =
      Math.max(...result.perSegment.map((p) => p.price)) / Math.min(...result.perSegment.map((p) => p.price));

    return {
      provenance: configured.provenance,
      warning: configured.warning,
      unitCost,
      marketSize: input.marketSize,
      perSegment: result.perSegment.map((row) => ({
        ...row,
        takeRateAtUniformPrice: wtpShare(
          segments.find((s) => s.id === row.segmentId)!,
          result.uniformBest.price,
        ),
      })),
      differentiatedMargin: result.totalMargin,
      uniformBest: result.uniformBest,
      gainOverUniform: result.gainOverUniform,
      gainPct: Math.round((result.gainOverUniform / Math.max(1e-9, result.uniformBest.margin)) * 1e4) / 100,
      fenceStressTest: {
        ...result.arbitrageIfFencesFail,
        interpretation: `If the fences fail, every segment takes the lowest fenced price (${result.arbitrageIfFencesFail.price}) and margin falls by ${result.arbitrageIfFencesFail.marginLoss}. That number is what the fences are worth — and what to spend on enforcing them.`,
      },
      priceSpread: Math.round(spread * 100) / 100,
      cautions: [
        "Every segment price needs a fence a customer cannot cross for free: pack size, channel, timing, enrolment, format or location. List the fence beside the price or the differentiation is not real.",
        spread > 2
          ? `Price spread is ${Math.round(spread * 100) / 100}x. Wide spreads invite arbitrage and, where the segments are visible to each other, a fairness problem that is a brand risk before it is a margin one.`
          : null,
        "Differentiating on inferred willingness to pay for identical goods is legally and reputationally sensitive in several markets. Differentiate on version, channel or volume — things the customer can choose — not on what a model thinks they can afford.",
      ].filter(Boolean),
    };
  },
});
