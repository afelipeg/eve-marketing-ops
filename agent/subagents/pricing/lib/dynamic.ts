import { round } from "./random";

/**
 * Dynamic pricing under finite, perishable capacity.
 *
 * Markdown optimization is a finite-horizon dynamic program over (weeks left,
 * inventory). At each state the value of charging price p is this period's
 * expected revenue plus the value of the inventory that survives:
 *
 *   V(t, i) = max_p  E_d[ min(d, i)·p + V(t+1, i - min(d, i)) ]
 *   V(T, i) = i · salvage
 *
 * The DP is what makes markdowns non-obvious: the cost of holding a unit is
 * not its carrying cost, it is the price you could have got for it earlier.
 * Discounting early is right when demand will not clear the stock at full
 * price; discounting late is right when it might.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — dynamic pricing
 * and markdown optimization.
 */

/**
 * Poisson pmf table, built once per lambda by the recurrence p_k = p_{k-1}·λ/k.
 *
 * The previous per-k implementation recomputed Σ log i from scratch, making the
 * DP's inner loop O(maxK²) — around 1e11 operations at a plausible λ of ~9,000,
 * which does not finish. Beyond λ ≈ 700, exp(-λ) underflows anyway, and demand
 * that far above any realistic inventory is a certainty of selling out, so that
 * case short-circuits instead.
 */
const pmfCache = new Map<number, { pmf: number[]; tail: number }>();

const poissonTable = (lambda: number): { pmf: number[]; tail: number } => {
  const key = Math.round(lambda * 1e6);
  const cached = pmfCache.get(key);
  if (cached) return cached;
  const maxK = Math.max(1, Math.ceil(lambda + 6 * Math.sqrt(lambda + 1)));
  const pmf = new Array<number>(maxK + 1);
  let p = Math.exp(-lambda);
  pmf[0] = p;
  let cumulative = p;
  for (let k = 1; k <= maxK; k++) {
    p = (p * lambda) / k;
    pmf[k] = p;
    cumulative += p;
  }
  const table = { pmf, tail: Math.max(0, 1 - cumulative) };
  if (pmfCache.size < 512) pmfCache.set(key, table);
  return table;
};

/** True when demand is so far above stock that selling out is effectively certain. */
const certainSellOut = (lambda: number, inventory: number): boolean =>
  lambda > 700 || lambda - 10 * Math.sqrt(lambda + 1) > inventory;

export type MarkdownSchedule = {
  period: number;
  inventoryStart: number;
  price: number;
  expectedUnits: number;
  expectedRevenue: number;
  expectedInventoryEnd: number;
};

export function optimizeMarkdown(input: {
  /** Demand mean at price p: lambda(p) = exp(intercept + elasticity·ln p). */
  intercept: number;
  elasticity: number;
  initialInventory: number;
  periods: number;
  priceLadder: number[];
  salvageValue: number;
  unitCost?: number;
  /** Prices may only fall (standard markdown policy). */
  monotoneMarkdown?: boolean;
  inventoryBuckets?: number;
}): {
  schedule: MarkdownSchedule[];
  expectedRevenue: number;
  expectedSellThrough: number;
  expectedLeftover: number;
  expectedSalvage: number;
  fullPriceComparison: { price: number; expectedRevenue: number; expectedSellThrough: number };
  policy: { period: number; inventory: number; price: number }[];
} {
  if (!(input.initialInventory > 0)) {
    throw new Error(
      "initialInventory must be greater than zero; there is no markdown problem without stock.",
    );
  }
  const buckets = Math.min(input.inventoryBuckets ?? 60, Math.max(2, Math.ceil(input.initialInventory)));
  const step = input.initialInventory / buckets;
  const ladder = [...input.priceLadder].sort((a, b) => b - a);
  const T = input.periods;

  const demandMean = (price: number) => Math.exp(input.intercept + input.elasticity * Math.log(price));

  // value[t][i] and the price chosen there; i indexes inventory buckets.
  /**
   * value[t][i][last] — the monotone-markdown constraint lives IN the state.
   *
   * `last` is the ladder index charged in the previous period. Solving the
   * unconstrained DP and then clipping the forward pass (the previous
   * approach) produces a schedule that is not optimal for the constrained
   * problem, and an expectedRevenue that corresponds to no value function at
   * all. Carrying `last` costs one small dimension and makes the reported
   * schedule genuinely optimal under the policy it claims to follow.
   */
  const L = ladder.length;
  const monotone = input.monotoneMarkdown !== false;
  const mk = () =>
    Array.from({ length: T + 1 }, () =>
      Array.from({ length: buckets + 1 }, () => new Array<number>(L).fill(0)),
    );
  const value = mk();
  const priceIndexChoice = mk();

  for (let i = 0; i <= buckets; i++) {
    for (let last = 0; last < L; last++) value[T]![i]![last] = i * step * input.salvageValue;
  }

  for (let t = T - 1; t >= 0; t--) {
    for (let i = 0; i <= buckets; i++) {
      const inventory = i * step;
      for (let last = 0; last < L; last++) {
        let bestValue = -Infinity;
        let bestPriceIndex = last;
        // Monotone markdown: price may fall but never rise, so the reachable
        // ladder indices start at `last`.
        const from = monotone ? last : 0;

        for (let priceIndex = from; priceIndex < L; priceIndex++) {
          const price = ladder[priceIndex]!;
          const lambda = demandMean(price);
          let expected: number;
          if (certainSellOut(lambda, inventory)) {
            expected = inventory * price + value[t + 1]![0]![priceIndex]!;
          } else {
            const { pmf, tail } = poissonTable(lambda);
            expected = 0;
            for (let k = 0; k < pmf.length; k++) {
              const p = pmf[k]!;
              const sold = Math.min(k, inventory);
              const remaining = Math.max(0, inventory - sold);
              // floor, not round: rounding up invents inventory the state never had.
              const nextBucket = Math.min(buckets, Math.floor(remaining / Math.max(1e-9, step)));
              expected += p * (sold * price + value[t + 1]![nextBucket]![priceIndex]!);
            }
            // Remaining tail: demand exceeds the table, so everything sells.
            expected += tail * (inventory * price + value[t + 1]![0]![priceIndex]!);
          }

          if (expected > bestValue) {
            bestValue = expected;
            bestPriceIndex = priceIndex;
          }
        }

        value[t]![i]![last] = bestValue;
        priceIndexChoice[t]![i]![last] = bestPriceIndex;
      }
    }
  }

  // Roll the policy forward on expected demand.
  /**
   * E[min(D, I)] for Poisson demand — NOT min(E[D], I).
   *
   * Jensen's inequality runs the wrong way here: min() is concave, so
   * substituting the mean demand overstates units sold and understates
   * leftover whenever lambda approaches the inventory on hand. The DP above
   * integrates the distribution properly; this forward roll has to as well, or
   * every reported figure disagrees with the value function that produced the
   * policy.
   */
  const expectedSold = (lambda: number, inventoryOnHand: number): number => {
    if (inventoryOnHand <= 0 || lambda <= 0) return 0;
    if (certainSellOut(lambda, inventoryOnHand)) return inventoryOnHand;
    const { pmf, tail } = poissonTable(lambda);
    let expected = 0;
    for (let k = 0; k < pmf.length; k++) expected += pmf[k]! * Math.min(k, inventoryOnHand);
    return expected + tail * inventoryOnHand;
  };

  const schedule: MarkdownSchedule[] = [];
  let inventory = input.initialInventory;
  let revenue = 0;
  let lastPriceIndex = 0;

  for (let t = 0; t < T; t++) {
    const bucket = Math.min(buckets, Math.floor(inventory / Math.max(1e-9, step)));
    // No clipping here: the constraint is already in the state, so the policy
    // read out of priceIndexChoice is feasible by construction.
    const priceIndex = priceIndexChoice[t]![bucket]![lastPriceIndex]!;
    lastPriceIndex = priceIndex;
    const price = ladder[priceIndex]!;

    const lambda = demandMean(price);
    const expectedUnits = expectedSold(lambda, inventory);
    revenue += expectedUnits * price;
    const inventoryEnd = Math.max(0, inventory - expectedUnits);

    schedule.push({
      period: t + 1,
      inventoryStart: round(inventory, 2),
      price: round(price, 4),
      expectedUnits: round(expectedUnits, 2),
      expectedRevenue: round(expectedUnits * price, 2),
      expectedInventoryEnd: round(inventoryEnd, 2),
    });
    inventory = inventoryEnd;
  }

  // Comparison: hold full price for the whole horizon.
  const fullPrice = ladder[0]!;
  let fullInventory = input.initialInventory;
  let fullRevenue = 0;
  for (let t = 0; t < T; t++) {
    const units = expectedSold(demandMean(fullPrice), fullInventory);
    fullRevenue += units * fullPrice;
    fullInventory -= units;
  }

  const salvage = inventory * input.salvageValue;
  // Policy slice at `last = 0` (nothing marked down yet), which is the branch
  // a fresh season actually enters.
  const policy: { period: number; inventory: number; price: number }[] = [];
  for (let t = 0; t < T; t++) {
    for (let i = 0; i <= buckets; i += Math.max(1, Math.floor(buckets / 6))) {
      policy.push({
        period: t + 1,
        inventory: round(i * step, 1),
        price: round(ladder[priceIndexChoice[t]![i]![0]!]!, 4),
      });
    }
  }

  return {
    schedule,
    expectedRevenue: round(revenue + salvage, 2),
    expectedSellThrough: round(1 - inventory / input.initialInventory, 4),
    expectedLeftover: round(inventory, 2),
    expectedSalvage: round(salvage, 2),
    fullPriceComparison: {
      price: round(fullPrice, 4),
      expectedRevenue: round(fullRevenue + fullInventory * input.salvageValue, 2),
      expectedSellThrough: round(1 - fullInventory / input.initialInventory, 4),
    },
    policy,
  };
}

/**
 * Stockout-aware pricing: when stock is scarce relative to remaining demand,
 * the right move is to raise price, not to discount into a shortage.
 *
 * The opportunity cost of a unit sold today is the margin it would have earned
 * later; scarcity raises that, which raises the price that clears the horizon.
 */
export function stockoutPricing(input: {
  intercept: number;
  elasticity: number;
  unitCost: number;
  inventory: number;
  periodsRemaining: number;
  priceMin: number;
  priceMax: number;
  steps?: number;
  salvageValue?: number;
}) {
  if (!(input.inventory > 0)) {
    throw new Error("inventory must be greater than zero; scarcity pricing needs stock to price.");
  }
  const steps = input.steps ?? 60;
  const salvage = input.salvageValue ?? 0;
  const demandAt = (price: number) => Math.exp(input.intercept + input.elasticity * Math.log(price));

  const rows = Array.from({ length: steps + 1 }, (_, s) => {
    const price = input.priceMin + ((input.priceMax - input.priceMin) * s) / steps;
    const perPeriod = demandAt(price);
    const horizonDemand = perPeriod * input.periodsRemaining;
    const sold = Math.min(horizonDemand, input.inventory);
    const leftover = Math.max(0, input.inventory - sold);
    const stockoutRisk = horizonDemand > input.inventory ? round(1 - input.inventory / horizonDemand, 4) : 0;
    return {
      price: round(price, 4),
      horizonDemand: round(horizonDemand, 2),
      expectedUnitsSold: round(sold, 2),
      leftover: round(leftover, 2),
      stockoutRisk,
      margin: round(sold * (price - input.unitCost) + leftover * salvage, 2),
      unmetDemand: round(Math.max(0, horizonDemand - input.inventory), 2),
    };
  });

  const best = rows.reduce((a, b) => (b.margin > a.margin ? b : a), rows[0]!);
  const clearing = rows.find((r) => r.stockoutRisk === 0);

  return {
    rows,
    optimum: best,
    lowestNonStockoutPrice: clearing ?? null,
    guidance:
      best.stockoutRisk > 0
        ? `At the margin-optimal price ${best.price}, expected demand exceeds stock by ${best.unmetDemand} units (stockout risk ${best.stockoutRisk}). Raising price is the correct response to scarcity: discounting here sells the same stock for less and leaves demand unserved.`
        : `Stock covers expected demand at the optimal price ${best.price}; leftover ${best.leftover} units. Markdown pressure comes from leftovers, not from stockouts.`,
  };
}
