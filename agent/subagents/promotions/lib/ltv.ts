import { round } from "./random";

/**
 * Survival analysis and lifetime value.
 *
 * Churn is estimated non-parametrically with Kaplan-Meier over time-to-lapse,
 * so customers still active at the cut are treated as censored rather than as
 * retained forever. LTV discounts expected future margin by the survival curve.
 *
 * Retention targeting scores on savability x LTV: the value at risk multiplied
 * by the share of that risk a promotion can actually remove. A high-LTV
 * customer who will stay anyway is not a retention target, and neither is a
 * saveable customer worth nothing.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — LTV modeling and
 * churn/retention analysis in promotions.
 */

export type SurvivalPoint = {
  time: number;
  atRisk: number;
  events: number;
  censored: number;
  survival: number;
  hazard: number;
};

export type SurvivalCurve = {
  points: SurvivalPoint[];
  medianSurvivalDays: number | null;
  survivalAt: (days: number) => number;
  n: number;
  events: number;
  censored: number;
};

/**
 * Kaplan-Meier estimator.
 * @param durations time under observation for each unit
 * @param events 1 if the unit lapsed at that time, 0 if still active (censored)
 */
export function kaplanMeier(durations: number[], events: number[]): SurvivalCurve {
  if (durations.length !== events.length) {
    throw new Error("durations and events must be the same length.");
  }
  if (durations.length === 0) throw new Error("No observations.");

  const rows = durations
    .map((time, i) => ({ time, event: events[i]! }))
    .sort((a, b) => a.time - b.time);

  const points: SurvivalPoint[] = [];
  let survival = 1;
  let atRisk = rows.length;
  let index = 0;

  while (index < rows.length) {
    const time = rows[index]!.time;
    let eventCount = 0;
    let censoredCount = 0;
    while (index < rows.length && rows[index]!.time === time) {
      if (rows[index]!.event === 1) eventCount++;
      else censoredCount++;
      index++;
    }
    const hazard = atRisk === 0 ? 0 : eventCount / atRisk;
    if (eventCount > 0) survival *= 1 - hazard;
    points.push({
      time,
      atRisk,
      events: eventCount,
      censored: censoredCount,
      survival: round(survival, 6),
      hazard: round(hazard, 6),
    });
    atRisk -= eventCount + censoredCount;
  }

  const survivalAt = (days: number): number => {
    let value = 1;
    for (const point of points) {
      if (point.time > days) break;
      value = point.survival;
    }
    return value;
  };

  const medianPoint = points.find((p) => p.survival <= 0.5);

  return {
    points,
    medianSurvivalDays: medianPoint ? medianPoint.time : null,
    survivalAt,
    n: rows.length,
    events: rows.filter((r) => r.event === 1).length,
    censored: rows.filter((r) => r.event === 0).length,
  };
}

/**
 * Probability a customer who has already survived `tenureDays` lapses within
 * `horizonDays`: the conditional complement of the survival curve.
 */
export function conditionalChurnProbability(
  curve: SurvivalCurve,
  tenureDays: number,
  horizonDays: number,
): number {
  const now = curve.survivalAt(tenureDays);
  if (now <= 0) return 1;
  const later = curve.survivalAt(tenureDays + horizonDays);
  return Math.min(1, Math.max(0, 1 - later / now));
}

export type LtvInput = {
  annualMargin: number;
  curve: SurvivalCurve;
  tenureDays: number;
  horizonYears?: number;
  annualDiscountRate?: number;
};

export type LtvResult = {
  ltv: number;
  horizonYears: number;
  annualDiscountRate: number;
  perYear: { year: number; survival: number; discountedMargin: number }[];
  churnProbability12m: number;
};

export function lifetimeValue(input: LtvInput): LtvResult {
  const { annualMargin, curve, tenureDays, horizonYears = 3, annualDiscountRate = 0.1 } = input;
  const baseline = Math.max(1e-9, curve.survivalAt(tenureDays));

  const perYear: LtvResult["perYear"] = [];
  let ltv = 0;
  for (let year = 1; year <= horizonYears; year++) {
    const conditional = Math.min(1, curve.survivalAt(tenureDays + year * 365) / baseline);
    const discounted = (annualMargin * conditional) / Math.pow(1 + annualDiscountRate, year);
    ltv += discounted;
    perYear.push({
      year,
      survival: round(conditional, 6),
      discountedMargin: round(discounted, 2),
    });
  }

  return {
    ltv: round(ltv, 2),
    horizonYears,
    annualDiscountRate,
    perYear,
    churnProbability12m: round(conditionalChurnProbability(curve, tenureDays, 365), 6),
  };
}

/**
 * Retention score = savability x LTV.
 *
 * `retentionUplift` is the modeled increase in the probability of staying if
 * treated — the saveable share of the risk, not the risk itself. Churn
 * probability is reported beside it so a high score built on a low-risk
 * customer is visible.
 */
export function savabilityScore(input: {
  churnProbability: number;
  retentionUplift: number;
  ltv: number;
}): {
  score: number;
  valueAtRisk: number;
  savablePct: number;
} {
  const valueAtRisk = input.churnProbability * input.ltv;
  return {
    score: round(input.retentionUplift * input.ltv, 4),
    valueAtRisk: round(valueAtRisk, 2),
    savablePct:
      input.churnProbability <= 0
        ? 0
        : round((input.retentionUplift / input.churnProbability) * 100, 2),
  };
}

/** LTV:CAC with the standard health thresholds stated, not implied. */
export function ltvToCac(ltv: number, cac: number) {
  if (cac <= 0) return { ratio: null, verdict: "CAC is zero or negative; ratio undefined." };
  const ratio = ltv / cac;
  const verdict =
    ratio < 1
      ? "Destroying value: each acquired customer costs more than their discounted margin."
      : ratio < 3
        ? "Below the conventional 3:1 benchmark: viable but thin."
        : ratio > 5
          ? "Above 5:1: likely underinvesting in acquisition, or LTV is overstated."
          : "Within the conventional 3:1 to 5:1 band.";
  return { ratio: round(ratio, 2), verdict };
}
