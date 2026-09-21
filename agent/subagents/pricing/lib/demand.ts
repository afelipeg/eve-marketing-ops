import { round } from "./random";

/**
 * Demand estimation.
 *
 * Log-linear (constant-elasticity) model, fitted by ordinary least squares on
 * the normal equations:
 *
 *   ln(q) = a + eps·ln(p) + gamma·ln(p_competitor) + delta·promo + seasonality
 *
 * `eps` is the own-price elasticity directly: a 1% price rise moves volume by
 * eps%. The constant-elasticity form is the workhorse because it is linear in
 * logs, interpretable, and stable out of sample over the observed price range.
 *
 * Two controls are not optional. Omit the promotion flag and the price
 * coefficient absorbs the promotional lift, overstating elasticity. Omit the
 * competitor price and it absorbs competitive response.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — demand
 * prediction and price elasticity estimation.
 */

export type Observation = { y: number; x: number[] };

export type OlsResult = {
  coefficients: number[];
  standardErrors: number[];
  tStats: number[];
  names: string[];
  n: number;
  k: number;
  r2: number;
  adjustedR2: number;
  residualStdError: number;
  confidence: { name: string; estimate: number; lower: number; upper: number }[];
  /** Two-sided 95% Student-t multiplier actually used for the intervals. */
  tCritical: number;
  degreesOfFreedom: number;
};

/** Lanczos log-gamma, needed by the incomplete beta below. */
function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let a = c[0]!;
  const t = z + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i]! / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Regularized incomplete beta I_x(a,b) by the Lentz continued fraction. */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta);
  if (x > (a + 1) / (a + b + 2)) return 1 - incompleteBeta(1 - x, b, a);

  let f = 1;
  let c = 1;
  let d = 0;
  for (let i = 0; i <= 250; i++) {
    const m = Math.floor(i / 2);
    let numerator: number;
    if (i === 0) numerator = 1;
    else if (i % 2 === 0) numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else numerator = -(((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1)));

    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    const cd = c * d;
    f *= cd;
    if (Math.abs(1 - cd) < 1e-12) break;
  }
  return (front * (f - 1)) / a;
}

/**
 * Two-sided Student-t critical value at `level` with `df` degrees of freedom,
 * by bisection on the exact t CDF.
 *
 * This matters more than it looks. A normal 1.96 understates the interval
 * badly on the small samples this estimator is allowed to run on: at df = 10
 * the true multiplier is 2.228 (12% wider) and at df = 3 it is 3.182 (62%
 * wider). Using 1.96 there publishes an elasticity interval that is too narrow
 * and calls coefficients significant that are not.
 */
export function tCritical(level: number, df: number): number {
  if (!Number.isFinite(df) || df <= 0) return Number.NaN;
  if (df > 1000) return 1.959963984540054;
  const target = 1 - (1 - level) / 2;
  const cdf = (t: number) => {
    const x = df / (df + t * t);
    const tail = 0.5 * incompleteBeta(x, df / 2, 0.5);
    return t >= 0 ? 1 - tail : tail;
  };
  let lo = 0;
  let hi = 200;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Solve a symmetric positive-definite system by Gauss-Jordan with pivoting. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const pv = m[col]![col]!;
    for (let c = col; c <= n; c++) m[col]![c]! /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r]![col]!;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) m[r]![c]! -= factor * m[col]![c]!;
    }
  }
  return m.map((row) => row[n]!);
}

/** Invert a square matrix; used for the coefficient covariance. */
function invert(a: number[][]): number[][] | null {
  const n = a.length;
  const m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const pv = m[col]![col]!;
    for (let c = 0; c < 2 * n; c++) m[col]![c]! /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r]![col]!;
      if (factor === 0) continue;
      for (let c = 0; c < 2 * n; c++) m[r]![c]! -= factor * m[col]![c]!;
    }
  }
  return m.map((row) => row.slice(n));
}

export function ols(observations: Observation[], names: string[]): OlsResult {
  const n = observations.length;
  const k = (observations[0]?.x.length ?? 0) + 1;
  if (n <= k) throw new Error(`Need more observations (${n}) than parameters (${k}).`);

  // A ragged x silently produces undefined arithmetic and all-NaN
  // coefficients: the singularity check `< 1e-12` is false for NaN, so nothing
  // catches it downstream.
  for (const [index, o] of observations.entries()) {
    if (o.x.length !== k - 1 || o.x.some((v) => !Number.isFinite(v)) || !Number.isFinite(o.y)) {
      throw new Error(
        `Observation ${index} is malformed: expected ${k - 1} finite regressors and a finite y.`,
      );
    }
  }
  const design = observations.map((o) => [1, ...o.x]);
  const y = observations.map((o) => o.y);

  const xtx = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const xty = new Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      xty[a]! += design[i]![a]! * y[i]!;
      for (let b = 0; b < k; b++) xtx[a]![b]! += design[i]![a]! * design[i]![b]!;
    }
  }

  const beta = solve(
    xtx.map((row) => [...row]),
    [...xty],
  );
  if (!beta) throw new Error("Design matrix is singular: regressors are collinear. Drop one.");

  const fitted = design.map((row) => row.reduce((s, v, j) => s + v * beta[j]!, 0));
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  const ssr = y.reduce((s, v, i) => s + Math.pow(v - fitted[i]!, 2), 0);
  const sst = y.reduce((s, v) => s + Math.pow(v - meanY, 2), 0);
  const sigma2 = ssr / (n - k);

  const covariance = invert(xtx);
  const standardErrors = covariance
    ? covariance.map((row, i) => Math.sqrt(Math.max(0, sigma2 * row[i]!)))
    : new Array<number>(k).fill(Number.NaN);

  const allNames = ["intercept", ...names];
  // t(n-k), not the normal 1.96: with k parameters and as few as a dozen
  // observations the difference is the whole interval.
  const tCrit = tCritical(0.95, n - k);
  return {
    coefficients: beta.map((b) => round(b, 6)),
    standardErrors: standardErrors.map((s) => round(s, 6)),
    tStats: beta.map((b, i) => round(b / (standardErrors[i] || Number.NaN), 4)),
    names: allNames,
    n,
    k,
    r2: round(sst === 0 ? 0 : 1 - ssr / sst, 6),
    adjustedR2: round(sst === 0 ? 0 : 1 - (ssr / (n - k)) / (sst / (n - 1)), 6),
    residualStdError: round(Math.sqrt(sigma2), 6),
    confidence: beta.map((b, i) => ({
      name: allNames[i]!,
      estimate: round(b, 6),
      lower: round(b - tCrit * (standardErrors[i] ?? 0), 6),
      upper: round(b + tCrit * (standardErrors[i] ?? 0), 6),
    })),
    tCritical: round(tCrit, 6),
    degreesOfFreedom: n - k,
  };
}

/** Constant-elasticity demand: q(p) = exp(a) · p^eps · (controls). */
export function logLinearDemand(input: {
  intercept: number;
  elasticity: number;
  price: number;
  controls?: number;
}): number {
  return Math.exp(input.intercept + input.elasticity * Math.log(input.price) + (input.controls ?? 0));
}

/**
 * Multinomial logit choice model.
 *
 * U_j = alpha_j + beta·price_j ; P(j) = exp(U_j) / (1 + Σ exp(U_k))
 *
 * MNL gives cross-price effects the log-linear model cannot: raising one SKU's
 * price pushes share onto its substitutes explicitly, which is what
 * cannibalization analysis needs. Fitted here by gradient ascent on the
 * multinomial log-likelihood.
 *
 * Caveat that decides whether MNL is appropriate: independence of irrelevant
 * alternatives. Adding a near-duplicate SKU draws share proportionally from
 * every alternative, not mostly from its twin, which understates
 * cannibalization between close substitutes.
 */
export type MnlModel = {
  alternatives: string[];
  utilities: number[];
  priceCoefficient: number;
  logLikelihood: number;
  iterations: number;
  shares: (prices: number[]) => number[];
};

export function fitMnl(input: {
  alternatives: string[];
  /** Observed choice occasions: prices per alternative and the chosen index (-1 = no purchase). */
  occasions: { prices: number[]; chosen: number }[];
  iterations?: number;
  learningRate?: number;
}): MnlModel {
  const { alternatives, occasions } = input;
  const iterations = input.iterations ?? 400;
  const learningRate = input.learningRate ?? 0.05;
  const J = alternatives.length;
  if (occasions.length === 0) throw new Error("No choice occasions supplied.");

  const alpha = new Array<number>(J).fill(0);
  let beta = -0.3;

  const shareOf = (prices: number[], a: number[], b: number): number[] => {
    const exps = prices.map((p, j) => Math.exp(a[j]! + b * p));
    const total = 1 + exps.reduce((s, v) => s + v, 0); // 1 = outside option
    return exps.map((e) => e / total);
  };

  let logLikelihood = 0;
  for (let iteration = 0; iteration < iterations; iteration++) {
    const gradA = new Array<number>(J).fill(0);
    let gradB = 0;
    logLikelihood = 0;

    for (const occasion of occasions) {
      const probabilities = shareOf(occasion.prices, alpha, beta);
      const chosen = occasion.chosen;
      const pChosen = chosen < 0 ? 1 - probabilities.reduce((s, v) => s + v, 0) : probabilities[chosen]!;
      logLikelihood += Math.log(Math.max(1e-12, pChosen));

      for (let j = 0; j < J; j++) {
        const indicator = chosen === j ? 1 : 0;
        gradA[j]! += indicator - probabilities[j]!;
        gradB += (indicator - probabilities[j]!) * occasion.prices[j]!;
      }
    }

    for (let j = 0; j < J; j++) alpha[j]! += (learningRate * gradA[j]!) / occasions.length;
    beta += (learningRate * gradB) / occasions.length;
  }

  // Re-evaluate at the FINAL parameters: the loop above computes the
  // likelihood before its own last update, so the returned value otherwise
  // describes parameters that are not the ones returned.
  logLikelihood = 0;
  for (const occasion of occasions) {
    const probabilities = shareOf(occasion.prices, alpha, beta);
    const pChosen =
      occasion.chosen < 0
        ? 1 - probabilities.reduce((s, v) => s + v, 0)
        : probabilities[occasion.chosen]!;
    logLikelihood += Math.log(Math.max(1e-12, pChosen));
  }
  if (!Number.isFinite(logLikelihood)) {
    throw new Error(
      "MNL fit diverged (non-finite log-likelihood). Prices are likely on a scale the fixed learning rate cannot handle — rescale them, or lower learningRate.",
    );
  }

  return {
    alternatives,
    utilities: alpha.map((a) => round(a, 6)),
    priceCoefficient: round(beta, 6),
    logLikelihood: round(logLikelihood, 4),
    iterations,
    shares: (prices: number[]) => shareOf(prices, alpha, beta).map((s) => round(s, 6)),
  };
}

/** Own- and cross-price elasticities implied by a fitted MNL at given prices. */
export function mnlElasticities(model: MnlModel, prices: number[]) {
  const shares = model.shares(prices);
  const own = shares.map((s, j) => round(model.priceCoefficient * prices[j]! * (1 - s), 6));
  const cross = shares.map((_, j) =>
    shares.map((sk, k) => (j === k ? Number.NaN : round(-model.priceCoefficient * prices[k]! * sk, 6))),
  );
  return { shares, ownElasticity: own, crossElasticity: cross };
}
