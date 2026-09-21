import { round } from "./random";

/**
 * Ad response model psi_a(u): regularized logistic regression fitted by
 * gradient descent on standardized features.
 *
 * Fit it on CONVERSIONS, not clicks. Click models learn fraud: invalid traffic
 * produces clicks and no conversions, so a click-trained bidder pays a premium
 * for exactly the inventory that is worthless.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — ad response
 * modeling in the advertisements chapter.
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
