import { mulberry32, randomNormal, round } from "./random";

/**
 * Resource allocation / revenue management for fixed, perishable capacity.
 *
 * Littlewood's rule (two classes): accept a low-fare booking while
 *
 *     p_low  >=  p_high · P(D_high > protected)
 *
 * so the protection level for the high fare is
 *
 *     y* = F_high^{-1}( 1 - p_low / p_high )
 *
 * EMSR-a and EMSR-b extend this to n nested classes. EMSR-b is the standard
 * production heuristic: it aggregates the demand of all classes above the one
 * being opened and protects against that aggregate at a revenue-weighted fare.
 * EMSR-a sums pairwise protections and is more conservative — it protects more
 * seats and usually leaves revenue on the table.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — resource
 * allocation and revenue management under finite capacity.
 */

/** Inverse standard normal CDF (Acklam), used for protection levels. */
function invNorm(p: number): number {
  if (p <= 0 || p >= 1) throw new Error("p must be in (0,1)");
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pLow = 0.02425;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p > 1 - pLow) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

export type FareClass = {
  name: string;
  /** Price / fare for this class. */
  price: number;
  /** Normal demand forecast for this class. */
  demandMean: number;
  demandStdDev: number;
};

export function littlewood(input: {
  highFare: number;
  lowFare: number;
  highDemandMean: number;
  highDemandStdDev: number;
  capacity: number;
}): { protectionLevel: number; bookingLimitLowFare: number; criticalRatio: number; note: string } {
  const { highFare, lowFare, highDemandMean, highDemandStdDev, capacity } = input;
  if (lowFare >= highFare) {
    throw new Error("The low fare must be below the high fare; otherwise there is nothing to protect.");
  }
  const criticalRatio = 1 - lowFare / highFare;
  const z = invNorm(Math.min(0.999999, Math.max(0.000001, criticalRatio)));
  const protection = Math.max(0, Math.min(capacity, highDemandMean + z * highDemandStdDev));

  return {
    protectionLevel: round(protection, 2),
    bookingLimitLowFare: round(Math.max(0, capacity - protection), 2),
    criticalRatio: round(criticalRatio, 4),
    note: `Protect ${round(protection, 1)} units for the ${highFare} fare; sell at most ${round(
      capacity - protection,
      1,
    )} at ${lowFare}. Accept a low-fare unit only while its certain revenue beats the expected revenue of holding it.`,
  };
}

export function emsr(input: {
  /** Classes ordered from highest to lowest fare. */
  classes: FareClass[];
  capacity: number;
  method?: "emsr-a" | "emsr-b";
}): {
  method: string;
  protectionLevels: { class: string; cumulativeProtection: number; bookingLimit: number }[];
  capacity: number;
  expectedRevenue: number;
  expectedUnsoldCapacity: number;
  revenueEvaluation: string;
} {
  const method = input.method ?? "emsr-b";
  const classes = [...input.classes];
  for (let i = 1; i < classes.length; i++) {
    if (classes[i]!.price > classes[i - 1]!.price) {
      throw new Error("Classes must be ordered from highest fare to lowest.");
    }
  }

  const protections: { class: string; cumulativeProtection: number; bookingLimit: number }[] = [];

  for (let j = 0; j < classes.length - 1; j++) {
    const nextFare = classes[j + 1]!.price;
    let protection = 0;

    if (method === "emsr-b") {
      // Aggregate classes 1..j, protect against the aggregate at the
      // revenue-weighted average fare.
      const aggregate = classes.slice(0, j + 1);
      const mean = aggregate.reduce((s, c) => s + c.demandMean, 0);
      const variance = aggregate.reduce((s, c) => s + Math.pow(c.demandStdDev, 2), 0);
      const weightedFare =
        aggregate.reduce((s, c) => s + c.price * c.demandMean, 0) / Math.max(1e-9, mean);
      const ratio = 1 - nextFare / weightedFare;
      const z = invNorm(Math.min(0.999999, Math.max(0.000001, ratio)));
      protection = mean + z * Math.sqrt(variance);
    } else {
      // EMSR-a: sum pairwise protections against each higher class separately.
      for (let i = 0; i <= j; i++) {
        const ratio = 1 - nextFare / classes[i]!.price;
        if (ratio <= 0) continue;
        const z = invNorm(Math.min(0.999999, Math.max(0.000001, ratio)));
        protection += classes[i]!.demandMean + z * classes[i]!.demandStdDev;
      }
    }

    protection = Math.max(0, Math.min(input.capacity, protection));
    protections.push({
      class: classes[j + 1]!.name,
      cumulativeProtection: round(protection, 2),
      bookingLimit: round(Math.max(0, input.capacity - protection), 2),
    });
  }

  // Expected revenue of the nested policy, by simulation over the demand
  // distribution — NOT by plugging in mean demand.
  //
  // Two things have to be right here, and the deterministic version got both
  // wrong. First, booking order is LOW fare first: that is the entire reason
  // protection levels exist, since the cheap request arrives before the
  // expensive one. Second, and less obvious, a protection level is a hedge
  // against demand *variance*. Evaluating it at the mean charges the policy
  // for every seat it holds back while crediting it with none of the upside
  // it is holding them for, which makes a correct EMSR policy look wasteful
  // (protecting 76.8 seats for a class expected to want 60 reads as 16.8
  // empty seats, when in fact those seats sell whenever demand runs high).
  const revenueSimulations = 4_000;
  const rng = mulberry32(20260924);
  let revenueTotal = 0;
  let unsoldTotal = 0;
  for (let s = 0; s < revenueSimulations; s++) {
    let remaining = input.capacity;
    let revenue = 0;
    for (let i = classes.length - 1; i >= 0; i--) {
      const cls = classes[i]!;
      const draw = Math.max(0, cls.demandMean + cls.demandStdDev * randomNormal(rng));
      const limit = i === 0 ? input.capacity : protections[i - 1]?.bookingLimit ?? input.capacity;
      const sold = Math.max(0, Math.min(draw, Math.min(remaining, limit)));
      revenue += sold * cls.price;
      remaining -= sold;
    }
    revenueTotal += revenue;
    unsoldTotal += remaining;
  }
  const revenue = revenueTotal / revenueSimulations;
  const expectedUnsold = unsoldTotal / revenueSimulations;

  return {
    method,
    protectionLevels: protections,
    capacity: input.capacity,
    expectedRevenue: round(revenue, 2),
    expectedUnsoldCapacity: round(expectedUnsold, 2),
    revenueEvaluation: `Monte Carlo over ${revenueSimulations} demand draws, booking low fare first under the nested limits. A deterministic mean-demand evaluation understates a protection policy, because protection is a hedge against variance.`,
  };
}
