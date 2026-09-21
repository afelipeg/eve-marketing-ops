import { round } from "./random";

/**
 * Response (propensity) and uplift models.
 *
 * Response model: regularized logistic regression fitted by gradient descent on
 * standardized features. It answers "who is likely to buy".
 *
 * Uplift model: the two-model (T-learner) approach — one response model on the
 * treated arm, one on the control arm, uplift = p_treated - p_control. It
 * answers the question that actually matters, "who buys *because of* the
 * promotion", which is what separates persuadables from sure things.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — response and
 * uplift (incremental response) modeling for promotions.
 */

export type Row = { features: number[]; label: number };

export type LogisticModel = {
  weights: number[];
  intercept: number;
  featureNames: string[];
  means: number[];
  sds: number[];
  iterations: number;
  logLoss: number;
  auc: number;
  baseRate: number;
  n: number;
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function standardize(rows: Row[], featureCount: number) {
  const means = new Array(featureCount).fill(0);
  const sds = new Array(featureCount).fill(0);
  for (const row of rows) {
    for (let j = 0; j < featureCount; j++) means[j]! += row.features[j]! / rows.length;
  }
  for (const row of rows) {
    for (let j = 0; j < featureCount; j++) {
      sds[j]! += Math.pow(row.features[j]! - means[j]!, 2) / rows.length;
    }
  }
  for (let j = 0; j < featureCount; j++) {
    sds[j] = Math.sqrt(sds[j]!);
    if (!Number.isFinite(sds[j]!) || sds[j]! < 1e-9) sds[j] = 1;
  }
  return { means, sds };
}

export function fitLogistic(
  rows: Row[],
  featureNames: string[],
  options: { iterations?: number; learningRate?: number; l2?: number } = {},
): LogisticModel {
  const { iterations = 400, learningRate = 0.5, l2 = 1e-3 } = options;
  if (rows.length === 0) throw new Error("No rows to fit.");
  const d = featureNames.length;
  for (const row of rows) {
    if (row.features.length !== d) {
      throw new Error(`Feature length mismatch: expected ${d}, got ${row.features.length}.`);
    }
  }

  const { means, sds } = standardize(rows, d);
  const x = rows.map((r) => r.features.map((v, j) => (v - means[j]!) / sds[j]!));
  const y = rows.map((r) => r.label);
  const baseRate = y.reduce((s, v) => s + v, 0) / y.length;

  const weights = new Array(d).fill(0);
  let intercept = Math.log(Math.max(1e-6, baseRate) / Math.max(1e-6, 1 - baseRate));

  for (let iter = 0; iter < iterations; iter++) {
    const gradW = new Array(d).fill(0);
    let gradB = 0;
    for (let i = 0; i < x.length; i++) {
      let z = intercept;
      for (let j = 0; j < d; j++) z += weights[j]! * x[i]![j]!;
      const error = sigmoid(z) - y[i]!;
      gradB += error / x.length;
      for (let j = 0; j < d; j++) gradW[j]! += (error * x[i]![j]!) / x.length;
    }
    for (let j = 0; j < d; j++) weights[j]! -= learningRate * (gradW[j]! + l2 * weights[j]!);
    intercept -= learningRate * gradB;
  }

  const model: LogisticModel = {
    weights: weights.map((w) => round(w, 6)),
    intercept: round(intercept, 6),
    featureNames,
    means,
    sds,
    iterations,
    logLoss: 0,
    auc: 0,
    baseRate: round(baseRate, 6),
    n: rows.length,
  };

  const scores = rows.map((r) => predictLogistic(model, r.features));
  model.logLoss = round(logLoss(scores, y), 6);
  model.auc = round(auc(scores, y), 4);
  return model;
}

export function predictLogistic(model: LogisticModel, features: number[]): number {
  let z = model.intercept;
  for (let j = 0; j < model.weights.length; j++) {
    z += model.weights[j]! * ((features[j]! - model.means[j]!) / model.sds[j]!);
  }
  return sigmoid(z);
}

export function logLoss(scores: number[], labels: number[]): number {
  let total = 0;
  for (let i = 0; i < scores.length; i++) {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, scores[i]!));
    total += -(labels[i]! * Math.log(p) + (1 - labels[i]!) * Math.log(1 - p));
  }
  return total / scores.length;
}

/** Mann-Whitney AUC, ties counted at half weight. */
export function auc(scores: number[], labels: number[]): number {
  const pos = scores.filter((_, i) => labels[i] === 1);
  const neg = scores.filter((_, i) => labels[i] === 0);
  if (pos.length === 0 || neg.length === 0) return Number.NaN;
  const sortedNeg = [...neg].sort((a, b) => a - b);
  let total = 0;
  for (const p of pos) {
    let lo = 0;
    let hi = sortedNeg.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedNeg[mid]! < p) lo = mid + 1;
      else hi = mid;
    }
    let ties = 0;
    let k = lo;
    while (k < sortedNeg.length && sortedNeg[k] === p) {
      ties++;
      k++;
    }
    total += lo + ties / 2;
  }
  return total / (pos.length * neg.length);
}

export type UpliftModel = {
  treatedModel: LogisticModel;
  controlModel: LogisticModel;
  featureNames: string[];
  treatedN: number;
  controlN: number;
  observedTreatedRate: number;
  observedControlRate: number;
  observedAverageUplift: number;
};

export function fitUplift(
  rows: (Row & { treated: boolean })[],
  featureNames: string[],
  options?: { iterations?: number; learningRate?: number; l2?: number },
): UpliftModel {
  const treated = rows.filter((r) => r.treated);
  const control = rows.filter((r) => !r.treated);
  if (treated.length < 30 || control.length < 30) {
    throw new Error(
      `Uplift modeling needs both arms: got ${treated.length} treated and ${control.length} control rows. Without a control arm only response can be modeled, not uplift.`,
    );
  }

  const treatedRate = treated.reduce((s, r) => s + r.label, 0) / treated.length;
  const controlRate = control.reduce((s, r) => s + r.label, 0) / control.length;

  return {
    treatedModel: fitLogistic(treated, featureNames, options),
    controlModel: fitLogistic(control, featureNames, options),
    featureNames,
    treatedN: treated.length,
    controlN: control.length,
    observedTreatedRate: round(treatedRate, 6),
    observedControlRate: round(controlRate, 6),
    observedAverageUplift: round(treatedRate - controlRate, 6),
  };
}

export function predictUplift(model: UpliftModel, features: number[]) {
  const treated = predictLogistic(model.treatedModel, features);
  const control = predictLogistic(model.controlModel, features);
  return { uplift: treated - control, treatedProbability: treated, controlProbability: control };
}

/**
 * Classify into the four response types from the two predicted probabilities.
 * Thresholds are explicit inputs, not hidden constants: they decide who gets
 * contacted, so they belong in the report.
 */
export function classifyResponse(
  treatedProbability: number,
  controlProbability: number,
  thresholds: { upliftPositive: number; upliftNegative: number; highBaseline: number },
): "persuadable" | "sure_thing" | "lost_cause" | "sleeping_dog" {
  const uplift = treatedProbability - controlProbability;
  if (uplift <= thresholds.upliftNegative) return "sleeping_dog";
  if (uplift >= thresholds.upliftPositive) return "persuadable";
  if (controlProbability >= thresholds.highBaseline) return "sure_thing";
  return "lost_cause";
}

/**
 * Qini curve and coefficient: cumulative incremental response as the audience
 * is walked down in uplift-score order, against the random-targeting diagonal.
 * The area between them is what an uplift model is worth.
 */
export function qini(
  scored: { upliftScore: number; treated: boolean; responded: boolean }[],
  buckets = 10,
): {
  points: { decile: number; share: number; cumulativeIncremental: number; randomBaseline: number }[];
  qiniCoefficient: number;
} {
  const sorted = [...scored].sort((a, b) => b.upliftScore - a.upliftScore);
  const totalTreated = sorted.filter((r) => r.treated).length;
  const totalControl = sorted.length - totalTreated;
  if (totalTreated === 0 || totalControl === 0) {
    throw new Error("Qini needs both treated and control rows.");
  }
  const overallIncremental =
    sorted.filter((r) => r.treated && r.responded).length -
    (sorted.filter((r) => !r.treated && r.responded).length * totalTreated) / totalControl;

  const points: {
    decile: number;
    share: number;
    cumulativeIncremental: number;
    randomBaseline: number;
  }[] = [];
  let area = 0;
  let previousIncremental = 0;

  for (let b = 1; b <= buckets; b++) {
    const cut = Math.floor((sorted.length * b) / buckets);
    const slice = sorted.slice(0, cut);
    const t = slice.filter((r) => r.treated);
    const c = slice.filter((r) => !r.treated);
    const tResp = t.filter((r) => r.responded).length;
    const cResp = c.filter((r) => r.responded).length;
    const incremental = c.length === 0 ? tResp : tResp - (cResp * t.length) / c.length;
    const share = b / buckets;
    const randomBaseline = overallIncremental * share;
    points.push({
      decile: b,
      share: round(share, 2),
      cumulativeIncremental: round(incremental, 3),
      randomBaseline: round(randomBaseline, 3),
    });
    // Trapezoidal area between the model curve and the random diagonal.
    area +=
      ((incremental - randomBaseline + (previousIncremental - overallIncremental * ((b - 1) / buckets))) /
        2) *
      (1 / buckets);
    previousIncremental = incremental;
  }

  return {
    points,
    qiniCoefficient: round(overallIncremental === 0 ? 0 : area / Math.abs(overallIncremental), 4),
  };
}
