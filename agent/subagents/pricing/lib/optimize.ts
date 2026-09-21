import { round } from "./random";
import type { Segment } from "./types";

/**
 * Price structure optimization: unit, segmented, two-part and bundle.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — price
 * structures, price differentiation, and willingness-to-pay.
 */

export type PricePoint = {
  price: number;
  units: number;
  revenue: number;
  margin: number;
  contributionPerUnit: number;
};

/**
 * Unit price optimization on a constant-elasticity demand curve.
 *
 * The closed form for a monopolist facing constant elasticity is
 *
 *     p* = c · eps / (1 + eps)     valid only for eps < -1
 *
 * With |eps| < 1 demand is inelastic and the unconstrained optimum is
 * unbounded — the model has left the range where it means anything, and the
 * answer is a constraint (ceiling, competitive, legal), not a price.
 */
export function optimizeUnitPrice(input: {
  intercept: number;
  elasticity: number;
  unitCost: number;
  controls?: number;
  priceMin: number;
  priceMax: number;
  steps?: number;
  capacity?: number;
  objective?: "margin" | "revenue";
}): {
  optimum: PricePoint;
  revenueOptimum: PricePoint;
  closedForm: number | null;
  curve: PricePoint[];
  elasticityWarning: string | null;
  capacityBinding: boolean;
} {
  const steps = input.steps ?? 60;
  const objective = input.objective ?? "margin";
  if (input.priceMax <= input.priceMin) throw new Error("priceMax must exceed priceMin.");

  const demandAt = (price: number) =>
    Math.exp(input.intercept + input.elasticity * Math.log(price) + (input.controls ?? 0));

  const curve: PricePoint[] = [];
  for (let s = 0; s <= steps; s++) {
    const price = input.priceMin + ((input.priceMax - input.priceMin) * s) / steps;
    const raw = demandAt(price);
    const units = input.capacity === undefined ? raw : Math.min(raw, input.capacity);
    curve.push({
      price: round(price, 4),
      units: round(units, 4),
      revenue: round(units * price, 4),
      margin: round(units * (price - input.unitCost), 4),
      contributionPerUnit: round(price - input.unitCost, 4),
    });
  }

  const best = (key: "margin" | "revenue") =>
    curve.reduce((a, b) => (b[key] > a[key] ? b : a), curve[0]!);

  const elastic = input.elasticity < -1;
  const closedForm = elastic
    ? round((input.unitCost * input.elasticity) / (1 + input.elasticity), 4)
    : null;

  const optimum = best(objective);
  const capacityBinding =
    input.capacity !== undefined && demandAt(optimum.price) > input.capacity + 1e-9;

  return {
    optimum,
    revenueOptimum: best("revenue"),
    closedForm,
    curve,
    elasticityWarning: elastic
      ? null
      : `Estimated elasticity ${input.elasticity} is inelastic (|eps| < 1). The unconstrained margin optimum is unbounded: the binding limit is a ceiling, competition, or a legal constraint, not the demand curve. Do not report a "profit-maximizing price" from this model.`,
    capacityBinding,
  };
}

/** Normal CDF via Abramowitz-Stegun erf approximation. */
function normalCdf(x: number, mean: number, sd: number): number {
  if (sd <= 0) return x >= mean ? 1 : 0;
  const z = (x - mean) / (sd * Math.SQRT2);
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  const erf = z >= 0 ? y : -y;
  return 0.5 * (1 + erf);
}

/** Share of a segment whose reservation price is at or above `price`. */
export function wtpShare(segment: Segment, price: number): number {
  return round(1 - normalCdf(price, segment.wtpMean, segment.wtpStdDev), 6);
}

export type SegmentPrice = {
  segmentId: string;
  label: string;
  price: number;
  takeRate: number;
  volume: number;
  margin: number;
  fence: string;
};

/**
 * Price differentiation across WTP segments.
 *
 * Differentiation only holds if the fences do. Without a fence, every segment
 * buys at the lowest offered price, so the tool also computes that arbitrage
 * outcome and reports the gap as the value the fences are protecting.
 */
export function optimizeSegmentedPrices(input: {
  segments: Segment[];
  unitCost: number;
  marketSize: number;
  priceMin: number;
  priceMax: number;
  steps?: number;
}): {
  perSegment: SegmentPrice[];
  totalMargin: number;
  uniformBest: { price: number; margin: number };
  arbitrageIfFencesFail: { price: number; margin: number; marginLoss: number };
  gainOverUniform: number;
} {
  const steps = input.steps ?? 80;
  const grid = Array.from(
    { length: steps + 1 },
    (_, s) => input.priceMin + ((input.priceMax - input.priceMin) * s) / steps,
  );

  const perSegment = input.segments.map((segment) => {
    let best = { price: grid[0]!, margin: -Infinity, takeRate: 0, volume: 0 };
    for (const price of grid) {
      const takeRate = wtpShare(segment, price);
      const volume = takeRate * segment.share * input.marketSize;
      const margin = volume * (price - input.unitCost);
      if (margin > best.margin) best = { price, margin, takeRate, volume };
    }
    return {
      segmentId: segment.id,
      label: segment.label,
      price: round(best.price, 4),
      takeRate: round(best.takeRate, 6),
      volume: round(best.volume, 2),
      margin: round(best.margin, 2),
      fence: segment.fence,
    };
  });

  let uniformBest = { price: grid[0]!, margin: -Infinity };
  for (const price of grid) {
    let margin = 0;
    for (const segment of input.segments) {
      margin += wtpShare(segment, price) * segment.share * input.marketSize * (price - input.unitCost);
    }
    if (margin > uniformBest.margin) uniformBest = { price, margin };
  }

  // If fences fail, everyone takes the lowest fenced price.
  const lowest = Math.min(...perSegment.map((p) => p.price));
  let arbitrageMargin = 0;
  for (const segment of input.segments) {
    arbitrageMargin += wtpShare(segment, lowest) * segment.share * input.marketSize * (lowest - input.unitCost);
  }

  const totalMargin = perSegment.reduce((s, p) => s + p.margin, 0);

  return {
    perSegment,
    totalMargin: round(totalMargin, 2),
    uniformBest: { price: round(uniformBest.price, 4), margin: round(uniformBest.margin, 2) },
    arbitrageIfFencesFail: {
      price: round(lowest, 4),
      margin: round(arbitrageMargin, 2),
      marginLoss: round(totalMargin - arbitrageMargin, 2),
    },
    gainOverUniform: round(totalMargin - uniformBest.margin, 2),
  };
}

/**
 * Two-part tariff: fixed fee F plus per-unit price p.
 *
 * With one homogeneous segment the classic result is p = marginal cost and F =
 * the whole consumer surplus. With heterogeneous segments that fee excludes the
 * low-WTP segment, so the optimum trades participation against extraction —
 * which is why this is solved numerically over (F, p) rather than by formula.
 */
export function optimizeTwoPartTariff(input: {
  segments: Segment[];
  unitCost: number;
  marketSize: number;
  /** Units consumed per period at price p: q(p) = max(0, base - slope·p). */
  usageBase: number;
  usageSlope: number;
  feeMax: number;
  priceMax: number;
  steps?: number;
}): {
  optimum: { fee: number; unitPrice: number; margin: number; participatingSegments: string[] };
  grid: { fee: number; unitPrice: number; margin: number; participation: number }[];
  marginalCostNote: string;
} {
  const steps = input.steps ?? 30;
  const results: { fee: number; unitPrice: number; margin: number; participation: number }[] = [];

  for (let f = 0; f <= steps; f++) {
    const fee = (input.feeMax * f) / steps;
    for (let p = 0; p <= steps; p++) {
      const unitPrice = (input.priceMax * p) / steps;
      const usage = Math.max(0, input.usageBase - input.usageSlope * unitPrice);
      // Surplus from usage, approximated as the triangle above the price line.
      const surplus = (0.5 * Math.pow(Math.max(0, input.usageBase - input.usageSlope * unitPrice), 2)) / Math.max(1e-9, input.usageSlope);

      let margin = 0;
      let participation = 0;
      const participating: string[] = [];
      for (const segment of input.segments) {
        const segmentSurplus = surplus * (segment.wtpMean / Math.max(1e-9, input.usageBase));
        if (segmentSurplus < fee) continue; // segment opts out
        const members = segment.share * input.marketSize;
        participation += segment.share;
        participating.push(segment.id);
        margin += members * (fee + usage * (unitPrice - input.unitCost));
      }
      results.push({ fee: round(fee, 4), unitPrice: round(unitPrice, 4), margin: round(margin, 2), participation: round(participation, 4) });
    }
  }

  const best = results.reduce((a, b) => (b.margin > a.margin ? b : a), results[0]!);
  const participating = input.segments
    .filter((segment) => {
      const usageSurplus =
        (0.5 * Math.pow(Math.max(0, input.usageBase - input.usageSlope * best.unitPrice), 2)) /
        Math.max(1e-9, input.usageSlope);
      return usageSurplus * (segment.wtpMean / Math.max(1e-9, input.usageBase)) >= best.fee;
    })
    .map((s) => s.id);

  return {
    optimum: { fee: best.fee, unitPrice: best.unitPrice, margin: best.margin, participatingSegments: participating },
    grid: results.sort((a, b) => b.margin - a.margin).slice(0, 25),
    marginalCostNote: `Unit cost is ${input.unitCost}. A per-unit price at or near cost with the value taken in the fee maximizes usage; a per-unit price far above cost suppresses usage and signals the fee is doing too little work.`,
  };
}

/**
 * Bundling.
 *
 * Bundling pays when willingness-to-pay across the items is NEGATIVELY
 * correlated: aggregating reduces the variance of total WTP, so a single
 * bundle price captures more of the population than separate prices. With
 * positively correlated WTP, bundling mostly discounts to people who would have
 * bought both anyway.
 */
export function evaluateBundle(input: {
  /** Per-customer WTP draws per item; rows are customers, columns items. */
  wtpMatrix: number[][];
  unitCosts: number[];
  bundlePriceGrid: number[];
  standalonePriceGrids: number[][];
}): {
  bestStandalone: { prices: number[]; margin: number };
  bestPureBundle: { price: number; margin: number; takeRate: number };
  bestMixedBundle: { bundlePrice: number; standalonePrices: number[]; margin: number };
  wtpCorrelation: number;
  recommendation: string;
} {
  const customers = input.wtpMatrix.length;
  const items = input.unitCosts.length;
  if (customers === 0) throw new Error("No WTP observations.");

  const marginStandalone = (prices: number[]) => {
    let margin = 0;
    for (const row of input.wtpMatrix) {
      for (let j = 0; j < items; j++) {
        if (row[j]! >= prices[j]!) margin += prices[j]! - input.unitCosts[j]!;
      }
    }
    return margin;
  };

  // Exhaustive over the supplied standalone grids (kept small by the caller).
  let bestStandalone = { prices: input.standalonePriceGrids.map((g) => g[0]!), margin: -Infinity };
  const walk = (index: number, current: number[]) => {
    if (index === items) {
      const margin = marginStandalone(current);
      if (margin > bestStandalone.margin) bestStandalone = { prices: [...current], margin };
      return;
    }
    for (const price of input.standalonePriceGrids[index]!) walk(index + 1, [...current, price]);
  };
  walk(0, []);

  const totalCost = input.unitCosts.reduce((s, c) => s + c, 0);
  let bestPureBundle = { price: 0, margin: -Infinity, takeRate: 0 };
  for (const price of input.bundlePriceGrid) {
    let buyers = 0;
    for (const row of input.wtpMatrix) {
      if (row.reduce((s, v) => s + v, 0) >= price) buyers++;
    }
    const margin = buyers * (price - totalCost);
    if (margin > bestPureBundle.margin) {
      bestPureBundle = { price, margin, takeRate: buyers / customers };
    }
  }

  let bestMixedBundle = { bundlePrice: 0, standalonePrices: bestStandalone.prices, margin: -Infinity };
  for (const bundlePrice of input.bundlePriceGrid) {
    let margin = 0;
    for (const row of input.wtpMatrix) {
      const totalWtp = row.reduce((s, v) => s + v, 0);
      const bundleSurplus = totalWtp - bundlePrice;
      const standaloneSurplus = row.reduce(
        (s, v, j) => s + Math.max(0, v - bestStandalone.prices[j]!),
        0,
      );
      if (bundleSurplus >= standaloneSurplus && bundleSurplus >= 0) {
        margin += bundlePrice - totalCost;
      } else {
        for (let j = 0; j < items; j++) {
          if (row[j]! >= bestStandalone.prices[j]!) margin += bestStandalone.prices[j]! - input.unitCosts[j]!;
        }
      }
    }
    if (margin > bestMixedBundle.margin) {
      bestMixedBundle = { bundlePrice, standalonePrices: bestStandalone.prices, margin };
    }
  }

  // Correlation of WTP between the first two items, the driver of bundle value.
  const colA = input.wtpMatrix.map((r) => r[0]!);
  const colB = input.wtpMatrix.map((r) => r[1] ?? r[0]!);
  const meanA = colA.reduce((s, v) => s + v, 0) / customers;
  const meanB = colB.reduce((s, v) => s + v, 0) / customers;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < customers; i++) {
    cov += (colA[i]! - meanA) * (colB[i]! - meanB);
    varA += Math.pow(colA[i]! - meanA, 2);
    varB += Math.pow(colB[i]! - meanB, 2);
  }
  const correlation = varA === 0 || varB === 0 ? 0 : cov / Math.sqrt(varA * varB);

  const best = [
    { name: "standalone", margin: bestStandalone.margin },
    { name: "pure bundle", margin: bestPureBundle.margin },
    { name: "mixed bundle", margin: bestMixedBundle.margin },
  ].reduce((a, b) => (b.margin > a.margin ? b : a));

  return {
    bestStandalone: { prices: bestStandalone.prices.map((p) => round(p, 4)), margin: round(bestStandalone.margin, 2) },
    bestPureBundle: {
      price: round(bestPureBundle.price, 4),
      margin: round(bestPureBundle.margin, 2),
      takeRate: round(bestPureBundle.takeRate, 4),
    },
    bestMixedBundle: {
      bundlePrice: round(bestMixedBundle.bundlePrice, 4),
      standalonePrices: bestMixedBundle.standalonePrices.map((p) => round(p, 4)),
      margin: round(bestMixedBundle.margin, 2),
    },
    wtpCorrelation: round(correlation, 4),
    recommendation: `${best.name} maximizes margin here. WTP correlation is ${round(correlation, 3)}: bundling gains come from negative correlation, and fall toward zero as correlation rises.`,
  };
}

/**
 * Cannibalization: portfolio effect of a price change, using own- and
 * cross-price elasticities. A price cut that "worked" on one SKU while the
 * category stood still moved volume between shelves and paid for it in margin.
 */
export function cannibalizationImpact(input: {
  skus: string[];
  baselineUnits: number[];
  baselinePrices: number[];
  unitCosts: number[];
  /** priceChangePct[i] as a fraction, e.g. -0.1 for a 10% cut. */
  priceChangePct: number[];
  ownElasticity: number[];
  crossElasticity: number[][];
}) {
  const n = input.skus.length;
  const newUnits = input.baselineUnits.map((units, i) => {
    let logChange = input.ownElasticity[i]! * Math.log(1 + input.priceChangePct[i]!);
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const cross = input.crossElasticity[i]?.[j] ?? 0;
      logChange += cross * Math.log(1 + input.priceChangePct[j]!);
    }
    return units * Math.exp(logChange);
  });

  const rows = input.skus.map((sku, i) => {
    const newPrice = input.baselinePrices[i]! * (1 + input.priceChangePct[i]!);
    const baseMargin = input.baselineUnits[i]! * (input.baselinePrices[i]! - input.unitCosts[i]!);
    const margin = newUnits[i]! * (newPrice - input.unitCosts[i]!);
    return {
      sku,
      priceChangePct: round(input.priceChangePct[i]! * 100, 2),
      newPrice: round(newPrice, 4),
      baselineUnits: round(input.baselineUnits[i]!, 2),
      newUnits: round(newUnits[i]!, 2),
      unitChangePct: round((newUnits[i]! / input.baselineUnits[i]! - 1) * 100, 2),
      baselineMargin: round(baseMargin, 2),
      newMargin: round(margin, 2),
      marginChange: round(margin - baseMargin, 2),
    };
  });

  const baselineTotalMargin = rows.reduce((s, r) => s + r.baselineMargin, 0);
  const newTotalMargin = rows.reduce((s, r) => s + r.newMargin, 0);
  const baselineUnitsTotal = rows.reduce((s, r) => s + r.baselineUnits, 0);
  const newUnitsTotal = rows.reduce((s, r) => s + r.newUnits, 0);

  const changed = rows.filter((r) => r.priceChangePct !== 0);
  const untouched = rows.filter((r) => r.priceChangePct === 0);
  const gainedOnChanged = changed.reduce((s, r) => s + (r.newUnits - r.baselineUnits), 0);
  const lostOnUntouched = untouched.reduce((s, r) => s + (r.baselineUnits - r.newUnits), 0);

  return {
    rows,
    portfolio: {
      baselineMargin: round(baselineTotalMargin, 2),
      newMargin: round(newTotalMargin, 2),
      marginChange: round(newTotalMargin - baselineTotalMargin, 2),
      marginChangePct: round((newTotalMargin / baselineTotalMargin - 1) * 100, 2),
      unitChangePct: round((newUnitsTotal / baselineUnitsTotal - 1) * 100, 2),
    },
    cannibalization: {
      unitsGainedOnRepricedSkus: round(gainedOnChanged, 2),
      unitsLostOnUntouchedSkus: round(lostOnUntouched, 2),
      cannibalizationRate:
        gainedOnChanged <= 0 ? null : round(lostOnUntouched / gainedOnChanged, 4),
      note:
        "Cannibalization rate is the share of the gain that came from our own shelf. A rate near 1 means the price move relocated volume inside the portfolio and paid margin for it.",
    },
  };
}
