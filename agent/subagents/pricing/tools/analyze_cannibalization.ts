import { defineTool } from "eve/tools";
import { z } from "zod";
import { cannibalizationImpact } from "../lib/optimize";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Compute the portfolio effect of a price move using own- and cross-price elasticities: units and margin per SKU, total portfolio margin change, the cannibalization rate (share of the volume gain taken from our own untouched SKUs), and the price/volume mix decomposition. Run this before any price cut inside a portfolio of substitutes.",
  inputSchema: z.object({
    skus: z.array(z.string()).min(2),
    baselineUnits: z.array(z.number().min(0)),
    baselinePrices: z.array(z.number().min(0)),
    unitCosts: z.array(z.number().min(0)),
    priceChangePct: z.array(z.number()).describe("Fractions: -0.1 is a 10% cut."),
    ownElasticity: z.array(z.number()),
    crossElasticity: z.array(z.array(z.number())).describe("crossElasticity[i][j]: effect of SKU j's price on SKU i."),
    priceVolumeMixThresholdPct: z
      .number()
      .default(60)
      .describe("Flag when more than this share of the margin change comes from price alone."),
  }),
  label: { start: ({ skus }) => `Cannibalization · ${skus.length} SKUs` },
  execute(input) {
    const n = input.skus.length;
    for (const [name, arr] of Object.entries({
      baselineUnits: input.baselineUnits,
      baselinePrices: input.baselinePrices,
      unitCosts: input.unitCosts,
      priceChangePct: input.priceChangePct,
      ownElasticity: input.ownElasticity,
    })) {
      if (arr.length !== n) throw new Error(`${name} must have ${n} entries, one per SKU.`);
    }
    if (input.crossElasticity.length !== n || input.crossElasticity.some((r) => r.length !== n)) {
      throw new Error(`crossElasticity must be ${n}x${n}.`);
    }

    const result = cannibalizationImpact({
      skus: input.skus,
      baselineUnits: input.baselineUnits,
      baselinePrices: input.baselinePrices,
      unitCosts: input.unitCosts,
      priceChangePct: input.priceChangePct,
      ownElasticity: input.ownElasticity,
      crossElasticity: input.crossElasticity,
    });

    // Price / volume / mix decomposition of the revenue change.
    const baseRevenue = input.baselineUnits.reduce((s, u, i) => s + u * input.baselinePrices[i]!, 0);
    const newUnits = result.rows.map((r) => r.newUnits);
    const newPrices = result.rows.map((r) => r.newPrice);
    const newRevenue = newUnits.reduce((s, u, i) => s + u * newPrices[i]!, 0);
    const volumeEffect = newUnits.reduce((s, u, i) => s + (u - input.baselineUnits[i]!) * input.baselinePrices[i]!, 0);
    const priceEffect = input.baselineUnits.reduce(
      (s, u, i) => s + u * (newPrices[i]! - input.baselinePrices[i]!),
      0,
    );
    const mixEffect = newRevenue - baseRevenue - volumeEffect - priceEffect;
    const totalAbs = Math.abs(volumeEffect) + Math.abs(priceEffect) + Math.abs(mixEffect);
    const priceShare = totalAbs === 0 ? 0 : Math.abs(priceEffect) / totalAbs;

    const round2 = (v: number) => Math.round(v * 100) / 100;

    return {
      rows: result.rows,
      portfolio: result.portfolio,
      cannibalization: result.cannibalization,
      priceVolumeMix: {
        baselineRevenue: round2(baseRevenue),
        newRevenue: round2(newRevenue),
        volumeEffect: round2(volumeEffect),
        priceEffect: round2(priceEffect),
        mixEffect: round2(mixEffect),
        priceShareOfChangePct: round2(priceShare * 100),
        exceedsThreshold: priceShare * 100 > input.priceVolumeMixThresholdPct,
      },
      verdict:
        result.portfolio.marginChange >= 0
          ? `Portfolio margin improves by ${result.portfolio.marginChange} (${result.portfolio.marginChangePct}%).`
          : `Portfolio margin FALLS by ${Math.abs(result.portfolio.marginChange)} (${result.portfolio.marginChangePct}%) even though units move ${result.portfolio.unitChangePct}%. The volume was bought with margin.`,
      cautions: [
        priceShare * 100 > input.priceVolumeMixThresholdPct
          ? `${round2(priceShare * 100)}% of the revenue change comes from the price lever alone, above the ${input.priceVolumeMixThresholdPct}% threshold. A result carried by price is not a demand result and does not repeat.`
          : null,
        result.cannibalization.cannibalizationRate !== null && result.cannibalization.cannibalizationRate > 0.5
          ? `Cannibalization rate ${result.cannibalization.cannibalizationRate}: over half the gain came off our own shelf.`
          : null,
        "Cross-elasticities are estimates with their own uncertainty, and they are the least reliable input here. Treat the portfolio number as directional and confirm with a test.",
        "Substitution toward a lower-margin SKU can raise units and lower margin at the same time. Read the margin row, not the unit row.",
      ].filter(Boolean),
    };
  },
});
