import { defineTool } from "eve/tools";
import { z } from "zod";
import { buildDemandFrame, loadProducts, loadSales } from "../lib/data";
import { ols } from "../lib/demand";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Estimate a log-linear demand curve for one SKU by OLS and return the own-price elasticity with a 95% confidence interval, the competitor-price and promotion coefficients, seasonality, R-squared and residual error. Excludes stockout weeks by default because they censor demand. Refuses when price variation or sample size cannot identify an elasticity, instead of returning a confident-looking number.",
  inputSchema: z.object({
    sku: z.string(),
    includeStockoutWeeks: z.boolean().default(false).describe("Diagnostic only: including them biases elasticity toward zero."),
    fromWeek: z.number().min(0).optional(),
    toWeek: z.number().min(0).optional(),
    minObservations: z.number().int().min(12).max(500).default(30),
  }),
  label: { start: ({ sku }) => `Estimate demand · ${sku}` },
  async execute(input) {
    const [sales, products] = await Promise.all([loadSales(), loadProducts()]);
    const product = products.rows.find((p) => p.sku === input.sku);
    if (!product) throw new Error(`No SKU "${input.sku}".`);

    const rows = sales.rows.filter(
      (r) =>
        r.sku === input.sku &&
        (input.fromWeek === undefined || r.week >= input.fromWeek) &&
        (input.toWeek === undefined || r.week <= input.toWeek),
    );
    if (rows.length === 0) throw new Error(`No sales rows for "${input.sku}" in that window.`);

    // Identification has to be judged on the rows the REGRESSION sees. Judging
    // it on the unfiltered set can pass a gate on price variation that the
    // stockout/zero-unit filter then throws away.
    const usableRows = rows.filter(
      (r) => r.price > 0 && r.units > 0 && (input.includeStockoutWeeks || !r.stockedOut),
    );
    const prices = (usableRows.length > 0 ? usableRows : rows).map((r) => r.price);
    const meanPrice = prices.reduce((s, v) => s + v, 0) / prices.length;
    const cv = Math.sqrt(prices.reduce((s, v) => s + Math.pow(v - meanPrice, 2), 0) / prices.length) / meanPrice;
    if (cv < 0.03) {
      return {
        refused: true,
        reason: `Price varied by a coefficient of variation of ${Math.round(cv * 1000) / 1000} in this window. Elasticity is not identified without price variation — any estimate would be an artifact of the controls.`,
        remedy: "Widen the window, pool comparable SKUs in the category, or run a deliberate price test.",
      };
    }

    const frame = buildDemandFrame(rows, { excludeStockouts: !input.includeStockoutWeeks });
    if (frame.observations.length < input.minObservations) {
      return {
        refused: true,
        reason: `Only ${frame.observations.length} usable weeks after excluding ${frame.dropped} (stockouts and zero-unit weeks). Below ${input.minObservations} the elasticity interval is too wide to price on.`,
        remedy:
          "Pool with comparable SKUs in the category to borrow strength, widen the window, or price from the category elasticity and say that is what was done.",
        droppedStockoutWeeks: frame.droppedStockoutWeeks,
      };
    }

    const fit = ols(frame.observations, frame.names);
    const elasticity = fit.coefficients[1]!;
    const ci = fit.confidence[1]!;
    const competitorCoefficient = fit.coefficients[2]!;
    const promoCoefficient = fit.coefficients[3]!;

    // Intercept evaluated at mean controls, for use by the optimizers.
    const meanCompetitor =
      rows.reduce((s, r) => s + Math.log(r.competitorPrice), 0) / rows.length;
    const promoShare = rows.filter((r) => r.promoted).length / rows.length;
    const effectiveIntercept =
      fit.coefficients[0]! + competitorCoefficient * meanCompetitor + promoCoefficient * promoShare;

    const significant = Math.abs(fit.tStats[1]!) >= 1.96;
    const elastic = elasticity < -1;

    return {
      provenance: sales.provenance,
      warning: sales.warning,
      sku: input.sku,
      model: "ln(units) = a + eps·ln(price) + gamma·ln(competitor_price) + delta·promo + seasonality + trend",
      sample: {
        weeksUsed: frame.observations.length,
        weeksDropped: frame.dropped,
        stockoutWeeksInData: frame.droppedStockoutWeeks,
        stockoutTreatment: input.includeStockoutWeeks ? "INCLUDED (diagnostic)" : "excluded",
        priceCoefficientOfVariation: Math.round(cv * 1000) / 1000,
      },
      elasticity: {
        estimate: Math.round(elasticity * 1e4) / 1e4,
        ci95: [ci.lower, ci.upper],
        tStat: fit.tStats[1]!,
        significant,
        interpretation: `A 1% price increase moves volume by ${Math.round(elasticity * 100) / 100}%. ${
          elastic
            ? "Demand is elastic: a price cut can grow revenue, and a price rise shrinks it."
            : "Demand is INELASTIC (|eps| < 1): a price rise grows revenue. Cutting price here gives away margin for volume that was not at risk."
        }`,
      },
      controls: {
        competitorPriceElasticity: Math.round(competitorCoefficient * 1e4) / 1e4,
        promotionLift: Math.round((Math.exp(promoCoefficient) - 1) * 1e4) / 1e4,
        seasonalityIncluded: true,
      },
      fit: {
        r2: fit.r2,
        adjustedR2: fit.adjustedR2,
        residualStdError: fit.residualStdError,
        n: fit.n,
        k: fit.k,
      },
      forOptimizer: {
        intercept: Math.round(effectiveIntercept * 1e6) / 1e6,
        elasticity: Math.round(elasticity * 1e6) / 1e6,
        unitCost: product.unitCost,
        currentPrice: product.currentPrice,
        priceFloor: product.priceFloor ?? null,
        priceCeiling: product.priceCeiling ?? null,
        note: "Pass these into optimize_unit_price. The intercept is evaluated at mean competitor price and average promotion intensity.",
      },
      coefficients: fit.confidence,
      cautions: [
        !significant ? "Price coefficient is not statistically distinguishable from zero. Do not price on it." : null,
        input.includeStockoutWeeks
          ? "Stockout weeks are INCLUDED: censored demand biases the elasticity toward zero. This result is for diagnosis only."
          : null,
        fit.r2 < 0.5 ? `R-squared is ${fit.r2}: most variation is unexplained, so the interval understates real uncertainty.` : null,
        "Elasticity is local to the observed price range. Extrapolating a price move far outside it is not supported by this estimate.",
        "Observational estimate: prices were set by someone who knew the market. A deliberate price test is the only clean identification — route it through measurement.",
      ].filter(Boolean),
    };
  },
});
