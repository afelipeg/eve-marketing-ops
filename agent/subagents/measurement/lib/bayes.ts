import { hashSeed, mean, mulberry32, quantile, randomBeta, randomBinomial, round } from "./random";

/**
 * Beta-binomial inference for two-arm experiments.
 *
 * Conjugate model: conversions ~ Binomial(n, p), p ~ Beta(alpha, beta).
 * Posterior is Beta(alpha + conversions, beta + n - conversions). Uplift is
 * read from the joint posterior by Monte Carlo, so the credible interval is on
 * the quantity of interest (relative lift) rather than on a normal
 * approximation of a difference of proportions.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — Bayesian methods
 * in the predictive-modeling review, and campaign uplift measurement.
 */

export type Arm = {
  label: string;
  n: number;
  conversions: number;
  /** Optional revenue attached to the arm, used for scenario value only. */
  revenue?: number;
};

export type UpliftResult = {
  control: ArmPosterior;
  treatment: ArmPosterior;
  absoluteLift: Interval;
  relativeLiftPct: Interval;
  relativeLiftDiagnostics: {
    median: number;
    mean: number;
    ratioOfPosteriorMeans: number;
    skewWarning: string | null;
  };
  probabilityTreatmentBetter: number;
  expectedLossIfShipping: number;
  significant: boolean;
  significanceRule: string;
  ciLevel: number;
  draws: number;
  seed: number;
  sampleSize: { control: number; treatment: number; total: number };
  minimumDetectableEffectPct: number;
  warnings: string[];
};

export type ArmPosterior = {
  label: string;
  n: number;
  conversions: number;
  observedRate: number;
  posteriorMean: number;
  ci: [number, number];
};

export type Interval = {
  estimate: number;
  ci: [number, number];
  ciLevel: number;
};

export type UpliftInput = {
  control: Arm;
  treatment: Arm;
  priorAlpha?: number;
  priorBeta?: number;
  ciLevel?: number;
  draws?: number;
  seed?: number;
};

const DEFAULT_DRAWS = 20_000;

export function betaBinomialUplift(input: UpliftInput): UpliftResult {
  const {
    control,
    treatment,
    priorAlpha = 1,
    priorBeta = 1,
    ciLevel = 0.9,
    draws = DEFAULT_DRAWS,
  } = input;

  validateArm(control);
  validateArm(treatment);
  if (ciLevel <= 0 || ciLevel >= 1) throw new Error("ciLevel must be between 0 and 1.");

  const seed =
    input.seed ??
    hashSeed(
      `${control.n}:${control.conversions}:${treatment.n}:${treatment.conversions}:${draws}:${ciLevel}`,
    );
  const rng = mulberry32(seed);

  const cA = priorAlpha + control.conversions;
  const cB = priorBeta + control.n - control.conversions;
  const tA = priorAlpha + treatment.conversions;
  const tB = priorBeta + treatment.n - treatment.conversions;

  const controlDraws: number[] = new Array(draws);
  const treatmentDraws: number[] = new Array(draws);
  const absolute: number[] = new Array(draws);
  const relative: number[] = new Array(draws);
  let better = 0;
  let lossSum = 0;

  for (let i = 0; i < draws; i++) {
    const pc = randomBeta(cA, cB, rng);
    const pt = randomBeta(tA, tB, rng);
    controlDraws[i] = pc;
    treatmentDraws[i] = pt;
    absolute[i] = pt - pc;
    relative[i] = pc === 0 ? 0 : ((pt - pc) / pc) * 100;
    if (pt > pc) better++;
    // Expected loss of shipping treatment when control is in fact better.
    lossSum += Math.max(0, pc - pt);
  }

  const lo = (1 - ciLevel) / 2;
  const hi = 1 - lo;

  const absoluteInterval: Interval = {
    estimate: round(mean(absolute), 6),
    ci: [round(quantile(absolute, lo), 6), round(quantile(absolute, hi), 6)],
    ciLevel,
  };
  /**
   * Relative lift is a RATIO, and the mean of a ratio is not the ratio of the
   * means. When the control rate is small, draws with a near-zero denominator
   * produce enormous relative lifts and drag the average far above anything
   * the data supports — at 2/100 vs 6/100 the mean draw reads 252% while the
   * ratio of posterior means is 133%.
   *
   * The reported estimate is therefore the posterior MEDIAN, which is robust to
   * that tail. The mean is kept beside it, explicitly labelled, so the skew is
   * visible rather than hidden.
   */
  const relativeMean = mean(relative);
  const relativeMedian = quantile(relative, 0.5);
  const plugIn =
    cA / (cA + cB) === 0 ? Number.NaN : ((tA / (tA + tB) - cA / (cA + cB)) / (cA / (cA + cB))) * 100;
  const relativeInterval: Interval = {
    estimate: round(relativeMedian, 3),
    ci: [round(quantile(relative, lo), 3), round(quantile(relative, hi), 3)],
    ciLevel,
  };

  const significant = absoluteInterval.ci[0] > 0 || absoluteInterval.ci[1] < 0;

  const warnings: string[] = [];
  if (control.n < 100 || treatment.n < 100) {
    warnings.push("Arm size under 100 exposures: the posterior is prior-dominated.");
  }
  if (control.conversions < 25 || treatment.conversions < 25) {
    warnings.push(
      "Fewer than 25 conversions in an arm: the interval is wide and the read is fragile.",
    );
  }
  const ratio = control.n / Math.max(1, treatment.n);
  if (ratio > 3 || ratio < 1 / 3) {
    warnings.push(
      `Arm imbalance ${round(ratio, 2)}:1 — check randomization and exposure logging before trusting the read.`,
    );
  }

  return {
    control: armPosterior(control, cA, cB, lo, hi, controlDraws),
    treatment: armPosterior(treatment, tA, tB, lo, hi, treatmentDraws),
    absoluteLift: absoluteInterval,
    relativeLiftPct: relativeInterval,
    relativeLiftDiagnostics: {
      median: round(relativeMedian, 3),
      mean: round(relativeMean, 3),
      ratioOfPosteriorMeans: round(plugIn, 3),
      skewWarning:
        Number.isFinite(plugIn) && Math.abs(relativeMean) > Math.abs(plugIn) * 1.25
          ? "The mean of the relative-lift draws is far above the ratio of posterior means: the control rate is thin enough that the ratio has a heavy right tail. The reported estimate is the median; do not quote the mean."
          : null,
    },
    probabilityTreatmentBetter: round(better / draws, 4),
    expectedLossIfShipping: round(lossSum / draws, 6),
    significant,
    significanceRule: `${Math.round(ciLevel * 100)}% credible interval on absolute lift excludes zero`,
    ciLevel,
    draws,
    seed,
    sampleSize: {
      control: control.n,
      treatment: treatment.n,
      total: control.n + treatment.n,
    },
    minimumDetectableEffectPct: minimumDetectableEffectPct({
      baselineRate: control.n === 0 ? 0 : control.conversions / control.n,
      nPerArm: Math.min(control.n, treatment.n),
      ciLevel,
    }),
    warnings,
  };
}

function armPosterior(
  arm: Arm,
  a: number,
  b: number,
  lo: number,
  hi: number,
  drawsArray: number[],
): ArmPosterior {
  return {
    label: arm.label,
    n: arm.n,
    conversions: arm.conversions,
    observedRate: arm.n === 0 ? 0 : round(arm.conversions / arm.n, 6),
    posteriorMean: round(a / (a + b), 6),
    ci: [round(quantile(drawsArray, lo), 6), round(quantile(drawsArray, hi), 6)],
  };
}

function validateArm(arm: Arm): void {
  if (!Number.isFinite(arm.n) || arm.n < 0) throw new Error(`${arm.label}: n must be >= 0.`);
  if (arm.conversions < 0 || arm.conversions > arm.n) {
    throw new Error(`${arm.label}: conversions must be between 0 and n.`);
  }
}

/**
 * Smallest relative lift a two-arm test of this size can resolve, from the
 * normal approximation at the stated interval width (two-sided, ~80% power).
 * Reported so a non-significant read can be qualified instead of overread.
 */
export function minimumDetectableEffectPct(input: {
  baselineRate: number;
  nPerArm: number;
  ciLevel?: number;
}): number {
  const { baselineRate, nPerArm, ciLevel = 0.9 } = input;
  // NaN here is load-bearing: callers must treat "no detectable effect exists"
  // as unresolvable rather than comparing against it, since every comparison
  // with NaN is false and silently reads as "adequately powered".
  if (baselineRate <= 0 || baselineRate >= 1 || nPerArm <= 0) return Number.NaN;
  const zAlpha = zScore(1 - (1 - ciLevel) / 2);
  const zBeta = zScore(0.8);
  const se = Math.sqrt((2 * baselineRate * (1 - baselineRate)) / nPerArm);
  const absolute = (zAlpha + zBeta) * se;
  return round((absolute / baselineRate) * 100, 2);
}

/** Acklam-style inverse normal CDF, accurate to ~1e-9 over the usable range. */
export function zScore(p: number): number {
  if (p <= 0 || p >= 1) throw new Error("p must be in (0,1)");
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p > pHigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  q = p - 0.5;
  const r = q * q;
  return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

/**
 * Simulated power: fraction of synthetic experiments whose credible interval
 * excludes zero, given a true relative lift. Answers "can this test resolve
 * the effect we care about?" before the budget is spent.
 */
export function simulatePower(input: {
  baselineRate: number;
  trueRelativeLiftPct: number;
  nPerArm: number;
  simulations?: number;
  ciLevel?: number;
  drawsPerSim?: number;
  seed?: number;
}): {
  power: number;
  simulations: number;
  falseDirectionRate: number;
  falseDirectionBase: string;
  medianRelativeLiftPct: number;
  seed: number;
} {
  const {
    baselineRate,
    trueRelativeLiftPct,
    nPerArm,
    simulations = 400,
    ciLevel = 0.9,
    drawsPerSim = 2_000,
  } = input;

  if (baselineRate <= 0 || baselineRate >= 1) throw new Error("baselineRate must be in (0,1).");
  if (nPerArm <= 0) throw new Error("nPerArm must be > 0.");

  const seed = input.seed ?? hashSeed(`${baselineRate}:${trueRelativeLiftPct}:${nPerArm}:${simulations}`);
  const rng = mulberry32(seed);
  const treatmentRate = Math.min(0.999999, baselineRate * (1 + trueRelativeLiftPct / 100));

  let detected = 0;
  let wrongDirection = 0;
  const estimates: number[] = [];

  for (let s = 0; s < simulations; s++) {
    const cConv = randomBinomial(nPerArm, baselineRate, rng);
    const tConv = randomBinomial(nPerArm, treatmentRate, rng);
    const result = betaBinomialUplift({
      control: { label: "control", n: nPerArm, conversions: cConv },
      treatment: { label: "treatment", n: nPerArm, conversions: tConv },
      ciLevel,
      draws: drawsPerSim,
      seed: Math.floor(rng() * 2147483647),
    });
    estimates.push(result.relativeLiftPct.estimate);
    if (result.significant) {
      detected++;
      const sign = Math.sign(result.relativeLiftPct.estimate);
      if (sign !== Math.sign(trueRelativeLiftPct) && trueRelativeLiftPct !== 0) wrongDirection++;
    }
  }

  return {
    power: round(detected / simulations, 4),
    simulations,
    // Type-S rate is conventionally the share of DETECTED effects that point
    // the wrong way; dividing by all simulations understates it whenever power
    // is low, which is precisely when sign errors matter.
    falseDirectionRate: round(detected === 0 ? 0 : wrongDirection / detected, 4),
    falseDirectionBase: "share of significant results with the wrong sign",
    medianRelativeLiftPct: round(quantile(estimates, 0.5), 3),
    seed,
  };
}

/** Smallest per-arm sample size reaching the target power, by bounded search. */
export function requiredSampleSize(input: {
  baselineRate: number;
  trueRelativeLiftPct: number;
  targetPower?: number;
  ciLevel?: number;
  maxPerArm?: number;
  simulations?: number;
  seed?: number;
}): { nPerArm: number | null; achievedPower: number; evaluated: number[]; seed: number } {
  const {
    baselineRate,
    trueRelativeLiftPct,
    targetPower = 0.8,
    ciLevel = 0.9,
    maxPerArm = 2_000_000,
    simulations = 200,
  } = input;

  const seed = input.seed ?? hashSeed(`ss:${baselineRate}:${trueRelativeLiftPct}:${targetPower}`);
  const evaluated: number[] = [];

  // Analytic starting point, then verify and adjust by simulation.
  const zAlpha = zScore(1 - (1 - ciLevel) / 2);
  const zBeta = zScore(targetPower);
  const absolute = baselineRate * (trueRelativeLiftPct / 100);
  if (absolute === 0) return { nPerArm: null, achievedPower: 0, evaluated, seed };
  const analytic = Math.ceil(
    (2 * baselineRate * (1 - baselineRate) * Math.pow(zAlpha + zBeta, 2)) / Math.pow(absolute, 2),
  );

  let lo = Math.max(50, Math.floor(analytic / 4));
  let hi = Math.min(maxPerArm, Math.max(lo * 2, analytic * 4));
  let best: number | null = null;
  let bestPower = 0;

  for (let step = 0; step < 8 && lo <= hi; step++) {
    const mid = Math.floor((lo + hi) / 2);
    evaluated.push(mid);
    const { power } = simulatePower({
      baselineRate,
      trueRelativeLiftPct,
      nPerArm: mid,
      simulations,
      ciLevel,
      drawsPerSim: 1_500,
      seed: seed + step,
    });
    if (power >= targetPower) {
      best = mid;
      bestPower = power;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  return { nPerArm: best, achievedPower: bestPower, evaluated, seed };
}
