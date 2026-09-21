import { mulberry32, randomNormal, round } from "../random";
import type { CompetitorPrice, Product, SalesRecord, Segment } from "../types";

/**
 * SAMPLE DATA — generated deterministically, not the client's sell-out.
 *
 * The generator plants a known demand system so the estimator can be checked
 * against ground truth rather than trusted:
 *
 *   ln(q) = a + eps·ln(p) + gamma·ln(p_competitor) + delta·promo
 *           + seasonality(week) + noise
 *
 * Each SKU carries a true own-price elasticity `eps` in [-3.2, -1.1] and a
 * true cross-price coefficient `gamma`. `TRUE_ELASTICITIES` exposes them for
 * self-testing only — never as a finding.
 *
 * Two structures are planted on purpose:
 *  - Stockouts censor observed demand on some weeks, so an estimator that
 *    ignores censoring will read them as low demand rather than no supply.
 *  - Promotions are correlated with low prices, so omitting the promo control
 *    biases the elasticity estimate away from its true value.
 */

const SEED = 20260922;
const SKUS = 40;
const WEEKS = 104;

const CATEGORIES = ["beverages", "snacks", "home", "personal_care"] as const;
const BRANDS = ["Andina", "Sierra", "Costa", "Valle"] as const;

type Truth = { sku: string; elasticity: number; crossElasticity: number; promoLift: number; baseDemand: number };

function build() {
  const rng = mulberry32(SEED);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;

  const truths: Truth[] = [];
  const products: Product[] = Array.from({ length: SKUS }, (_, i) => {
    const category = pick(CATEGORIES);
    const unitCost = round(0.8 + rng() * 6, 2);
    const margin = 0.28 + rng() * 0.35;
    const price = round(unitCost / (1 - margin), 2);
    const perishable = category === "beverages" || category === "snacks" ? rng() < 0.45 : rng() < 0.12;
    const sku = `sku-${String(i + 1).padStart(3, "0")}`;

    truths.push({
      sku,
      // Staples are inelastic, discretionary items elastic.
      elasticity: round(-1.1 - rng() * 2.1, 3),
      crossElasticity: round(0.2 + rng() * 0.9, 3),
      promoLift: round(0.15 + rng() * 0.6, 3),
      baseDemand: round(3.2 + rng() * 2.4, 3),
    });

    return {
      sku,
      title: `${pick(BRANDS)} ${category} ${i + 1}`,
      category,
      brand: pick(BRANDS),
      packSize: [0.33, 0.5, 1, 1.5, 2][Math.floor(rng() * 5)]!,
      unitCost,
      currentPrice: price,
      priceFloor: round(unitCost * 1.05, 2),
      priceCeiling: round(price * 1.6, 2),
      inventory: Math.round(150 + rng() * 900),
      shelfLifeWeeks: perishable ? Math.round(2 + rng() * 10) : null,
      salvageValue: round(unitCost * (perishable ? 0.1 : 0.55), 2),
      perishable,
    };
  });

  const truthBySku = new Map(truths.map((t) => [t.sku, t]));
  const sales: SalesRecord[] = [];
  const competitorPrices: CompetitorPrice[] = [];

  for (const product of products) {
    const truth = truthBySku.get(product.sku)!;
    // Order-up-to (periodic review) replenishment sized on expected demand at
    // the list price. The shelf cap is what makes stockouts possible: a
    // promotion week pulls more than the shelf holds.
    const expectedWeekly = Math.exp(
      truth.baseDemand +
        truth.elasticity * Math.log(product.currentPrice) +
        truth.crossElasticity * Math.log(product.currentPrice),
    );
    const orderUpTo = Math.max(4, expectedWeekly * 3.1);
    let inventory = orderUpTo;

    for (let week = 0; week < WEEKS; week++) {
      // Price path: base price with occasional promotions and step changes.
      const promoted = rng() < 0.22;
      const stepShift = Math.floor(week / 26) * (rng() < 0.5 ? 0.02 : -0.01);
      const price = round(
        Math.max(
          product.priceFloor ?? 0.1,
          product.currentPrice * (1 + stepShift) * (promoted ? 0.75 + rng() * 0.15 : 0.97 + rng() * 0.08),
        ),
        2,
      );
      const competitorPrice = round(product.currentPrice * (0.9 + rng() * 0.28), 2);

      const seasonality = 0.18 * Math.sin((2 * Math.PI * week) / 52) + 0.08 * Math.cos((4 * Math.PI * week) / 52);
      const logDemand =
        truth.baseDemand +
        truth.elasticity * Math.log(price) +
        truth.crossElasticity * Math.log(competitorPrice) +
        truth.promoLift * (promoted ? 1 : 0) +
        seasonality +
        randomNormal(rng) * 0.12;

      const latentDemand = Math.max(0, Math.exp(logDemand));
      // Restock roughly monthly; stockouts censor demand.
      // Review every two weeks, order up to the target with forecast error.
      // Demand spikes (promotion weeks) can exceed what the shelf holds, which
      // CENSORS observed demand: an estimator that keeps those weeks reads
      // "sold little at a low price" when nothing was on the shelf.
      if (week % 2 === 0) {
        inventory = Math.max(inventory, orderUpTo * (0.85 + rng() * 0.3));
      }
      const units = Math.min(latentDemand, inventory);
      const stockedOut = units < latentDemand - 0.5;
      inventory = Math.max(0, inventory - units);

      const revenue = round(units * price, 2);
      sales.push({
        sku: product.sku,
        week,
        channel: rng() < 0.6 ? "pos" : rng() < 0.85 ? "ecommerce" : "wholesale",
        price,
        competitorPrice,
        units: round(units, 2),
        revenue,
        grossMargin: round(units * (price - product.unitCost), 2),
        promoted,
        inventoryStart: round(inventory + units, 2),
        stockedOut,
      });

      for (const competitor of ["CompA", "CompB"]) {
        competitorPrices.push({
          sku: product.sku,
          week,
          competitor,
          price: round(competitorPrice * (competitor === "CompA" ? 1 : 0.96 + rng() * 0.1), 2),
          onPromotion: rng() < 0.18,
        });
      }
    }
  }

  return { products, sales, competitorPrices, truths };
}

const generated = build();

export const SAMPLE_PRODUCTS = generated.products;
export const SAMPLE_SALES = generated.sales;
export const SAMPLE_COMPETITOR_PRICES = generated.competitorPrices;
/** Ground truth, exposed for self-testing only. Never present as a finding. */
export const TRUE_ELASTICITIES = generated.truths;

/** Willingness-to-pay segments with the fences that make them sustainable. */
export const SAMPLE_SEGMENTS: Segment[] = [
  {
    id: "value",
    label: "Value seekers",
    share: 0.45,
    wtpMean: 4.2,
    wtpStdDev: 1.1,
    elasticityMultiplier: 1.4,
    fence: "Large pack size and weekday-only promotion; requires loyalty enrolment",
  },
  {
    id: "mainstream",
    label: "Mainstream",
    share: 0.4,
    wtpMean: 6.4,
    wtpStdDev: 1.4,
    elasticityMultiplier: 1,
    fence: "Standard pack at shelf price, no enrolment",
  },
  {
    id: "premium",
    label: "Convenience / premium",
    share: 0.15,
    wtpMean: 9.1,
    wtpStdDev: 2.2,
    elasticityMultiplier: 0.6,
    fence: "Single-serve chilled format in immediate-consumption locations",
  },
];
