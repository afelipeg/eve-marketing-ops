import { mulberry32, round } from "./random";
import type { RatingMatrix } from "./matrix";
import type { Interaction } from "./types";

/**
 * Latent factor models: SVD, SVD++ and timeSVD++.
 *
 * Biased matrix factorization, fitted by stochastic gradient descent on the
 * observed entries only — never on an imputed dense matrix:
 *
 *   SVD        r̂_ui = mu + b_u + b_i + q_i · p_u
 *   SVD++      r̂_ui = mu + b_u + b_i + q_i · ( p_u + |N(u)|^-1/2 Σ_{j∈N(u)} y_j )
 *   timeSVD++  b_u(t) = b_u + alpha_u · dev_u(t) + b_{u,bin(t)}
 *              b_i(t) = b_i + b_{i,bin(t)}
 *              dev_u(t) = sign(t - t_u) · |t - t_u|^0.4
 *
 * SVD++ adds the implicit signal: *which* items a user interacted with carries
 * preference information independent of the rating value. timeSVD++ adds drift:
 * user bias and item popularity move over the life of the catalog, and a model
 * that treats a 2-year-old rating as current will mispredict the present.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — latent factor
 * models for collaborative filtering.
 */

export type MfOptions = {
  factors?: number;
  epochs?: number;
  learningRate?: number;
  regularization?: number;
  /** SVD++: include the implicit-feedback term. */
  implicit?: boolean;
  /** timeSVD++: include time-dependent biases. */
  temporal?: boolean;
  timeBins?: number;
  seed?: number;
};

export type MfModel = {
  kind: "svd" | "svd++" | "timesvd++";
  mu: number;
  userBias: Float64Array;
  itemBias: Float64Array;
  userFactors: Float64Array[];
  itemFactors: Float64Array[];
  implicitFactors: Float64Array[];
  userAlpha: Float64Array;
  userTimeBias: Float64Array[];
  itemTimeBias: Float64Array[];
  userMeanDay: Float64Array;
  /** Largest |dev(t)| observed for each user in training. */
  userMaxDev: Float64Array;
  userImplicit: number[][];
  userIndex: Map<string, number>;
  itemIndex: Map<string, number>;
  options: Required<Omit<MfOptions, "seed">> & { seed: number };
  trainRmse: number;
  epochsRun: number;
  dayRange: { min: number; max: number };
};

const dev = (day: number, meanDay: number) =>
  Math.sign(day - meanDay) * Math.pow(Math.abs(day - meanDay), 0.4);

export function trainMf(matrix: RatingMatrix, train: Interaction[], options: MfOptions = {}): MfModel {
  const factors = options.factors ?? 8;
  const epochs = options.epochs ?? 30;
  const learningRate = options.learningRate ?? 0.008;
  const regularization = options.regularization ?? 0.05;
  const implicit = options.implicit ?? false;
  const temporal = options.temporal ?? false;
  // Four bins by default, not eight: with a median of ~20 ratings per user,
  // per-user time bins are the first thing to overfit.
  const timeBins = options.timeBins ?? 4;
  const seed = options.seed ?? 11;

  if (train.length === 0) throw new Error("No training interactions.");

  const rng = mulberry32(seed);
  const userIndex = new Map(matrix.users.map((u, i) => [u, i]));
  const itemIndex = new Map(matrix.items.map((it, i) => [it, i]));
  const nUsers = matrix.users.length;
  const nItems = matrix.items.length;

  const mu = train.reduce((s, r) => s + r.rating, 0) / train.length;
  const userBias = new Float64Array(nUsers);
  const itemBias = new Float64Array(nItems);
  const userAlpha = new Float64Array(nUsers);
  const userMeanDay = new Float64Array(nUsers);
  const userMaxDev = new Float64Array(nUsers);
  const userTimeBias = Array.from({ length: nUsers }, () => new Float64Array(timeBins));
  const itemTimeBias = Array.from({ length: nItems }, () => new Float64Array(timeBins));

  const init = (n: number) =>
    Array.from({ length: n }, () => {
      const v = new Float64Array(factors);
      for (let f = 0; f < factors; f++) v[f] = (rng() - 0.5) * 0.1;
      return v;
    });
  const userFactors = init(nUsers);
  const itemFactors = init(nItems);
  const implicitFactors = init(nItems);

  // Implicit set N(u): items the user interacted with at all.
  // N(u) is a SET. Duplicate (user,item) rows would otherwise be counted twice
  // in both |N(u)|^-1/2 and the sum of y_j, corrupting the implicit term — and
  // the Interaction schema does not enforce uniqueness.
  const userImplicitSets: Set<number>[] = Array.from({ length: nUsers }, () => new Set<number>());
  const dayTotals = new Float64Array(nUsers);
  const dayCounts = new Float64Array(nUsers);
  const days = train.map((r) => r.day);
  // Reduce, not spread: the argument list blows the stack past ~125k rows.
  let dayMin = Number.POSITIVE_INFINITY;
  let dayMax = Number.NEGATIVE_INFINITY;
  for (const d of days) {
    if (d < dayMin) dayMin = d;
    if (d > dayMax) dayMax = d;
  }
  const binOf = (day: number) =>
    Math.min(timeBins - 1, Math.max(0, Math.floor(((day - dayMin) / Math.max(1, dayMax - dayMin)) * timeBins)));

  for (const row of train) {
    const u = userIndex.get(row.userId);
    const i = itemIndex.get(row.itemId);
    if (u === undefined || i === undefined) continue;
    userImplicitSets[u]!.add(i);
    dayTotals[u]! += row.day;
    dayCounts[u]! += 1;
  }
  const userImplicit: number[][] = userImplicitSets.map((s) => [...s]);
  for (let u = 0; u < nUsers; u++) {
    userMeanDay[u] = dayCounts[u]! === 0 ? (dayMin + dayMax) / 2 : dayTotals[u]! / dayCounts[u]!;
  }
  for (const row of train) {
    const u = userIndex.get(row.userId);
    if (u === undefined) continue;
    const d = Math.abs(dev(row.day, userMeanDay[u]!));
    if (d > userMaxDev[u]!) userMaxDev[u] = d;
  }

  const shuffled = [...train];
  let rmse = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    // Deterministic Fisher-Yates using the seeded rng.
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    let squaredError = 0;
    let scored = 0;
    for (const row of shuffled) {
      const u = userIndex.get(row.userId);
      const i = itemIndex.get(row.itemId);
      if (u === undefined || i === undefined) continue;

      const implicitSet = userImplicit[u]!;
      const norm = implicit && implicitSet.length > 0 ? 1 / Math.sqrt(implicitSet.length) : 0;

      // Effective user vector p_u (+ implicit term for SVD++).
      const pu = new Float64Array(factors);
      for (let f = 0; f < factors; f++) pu[f] = userFactors[u]![f]!;
      if (implicit && norm > 0) {
        for (const j of implicitSet) {
          for (let f = 0; f < factors; f++) pu[f]! += norm * implicitFactors[j]![f]!;
        }
      }

      const bin = binOf(row.day);
      const deviation = temporal ? dev(row.day, userMeanDay[u]!) : 0;
      const bu = userBias[u]! + (temporal ? userAlpha[u]! * deviation + userTimeBias[u]![bin]! : 0);
      const bi = itemBias[i]! + (temporal ? itemTimeBias[i]![bin]! : 0);

      let dot = 0;
      for (let f = 0; f < factors; f++) dot += itemFactors[i]![f]! * pu[f]!;
      const prediction = mu + bu + bi + dot;
      const error = row.rating - prediction;
      // Clamp to the rating scale, exactly as predictMf does. Measuring train
      // and test error with two different estimators flatters the test number.
      const clamped = Math.min(5, Math.max(1, prediction));
      squaredError += Math.pow(row.rating - clamped, 2);
      scored++;

      userBias[u]! += learningRate * (error - regularization * userBias[u]!);
      itemBias[i]! += learningRate * (error - regularization * itemBias[i]!);
      if (temporal) {
        // Time terms carry far more parameters than data points, so they are
        // regularized an order of magnitude harder than the static biases.
        userAlpha[u]! += learningRate * (error * deviation - regularization * 20 * userAlpha[u]!);
        userTimeBias[u]![bin]! +=
          learningRate * 0.5 * (error - regularization * 20 * userTimeBias[u]![bin]!);
        itemTimeBias[i]![bin]! +=
          learningRate * 0.5 * (error - regularization * 10 * itemTimeBias[i]![bin]!);
      }

      for (let f = 0; f < factors; f++) {
        const qi = itemFactors[i]![f]!;
        const puf = pu[f]!;
        itemFactors[i]![f]! += learningRate * (error * puf - regularization * qi);
        userFactors[u]![f]! += learningRate * (error * qi - regularization * userFactors[u]![f]!);
        if (implicit && norm > 0) {
          for (const j of implicitSet) {
            implicitFactors[j]![f]! +=
              learningRate * (error * norm * qi - regularization * implicitFactors[j]![f]!);
          }
        }
      }
    }
    // Divide by rows actually scored: unknown user/item rows `continue` above
    // and were previously counted in the denominator, understating train RMSE.
    rmse = scored === 0 ? Number.NaN : Math.sqrt(squaredError / scored);
  }

  return {
    kind: temporal ? "timesvd++" : implicit ? "svd++" : "svd",
    mu,
    userBias,
    itemBias,
    userFactors,
    itemFactors,
    implicitFactors,
    userAlpha,
    userTimeBias,
    itemTimeBias,
    userMeanDay,
    userMaxDev,
    userImplicit,
    userIndex,
    itemIndex,
    options: {
      factors,
      epochs,
      learningRate,
      regularization,
      implicit,
      temporal,
      timeBins,
      seed,
    },
    trainRmse: round(rmse, 6),
    epochsRun: epochs,
    dayRange: { min: dayMin, max: dayMax },
  };
}

export function predictMf(model: MfModel, userId: string, itemId: string, day?: number): number | null {
  const u = model.userIndex.get(userId);
  const i = model.itemIndex.get(itemId);
  if (u === undefined || i === undefined) return null;

  const factors = model.options.factors;
  const implicitSet = model.userImplicit[u]!;
  const norm = model.options.implicit && implicitSet.length > 0 ? 1 / Math.sqrt(implicitSet.length) : 0;

  const pu = new Float64Array(factors);
  for (let f = 0; f < factors; f++) pu[f] = model.userFactors[u]![f]!;
  if (norm > 0) {
    for (const j of implicitSet) {
      for (let f = 0; f < factors; f++) pu[f]! += norm * model.implicitFactors[j]![f]!;
    }
  }

  let timeUserBias = 0;
  let timeItemBias = 0;
  if (model.options.temporal && day !== undefined) {
    const { min, max } = model.dayRange;
    const bin = Math.min(
      model.options.timeBins - 1,
      Math.max(0, Math.floor(((day - min) / Math.max(1, max - min)) * model.options.timeBins)),
    );
    // Clamp the time deviation to the support seen in training. Beyond it the
    // drift term is pure extrapolation: alpha_u * dev(t) grows without bound
    // on future days, and a linear taste trend fitted on one year does not
    // continue forever. Clamping costs nothing in-sample and stops the model
    // from inventing drift it has no evidence for.
    const rawDev = dev(day, model.userMeanDay[u]!);
    const maxDev = model.userMaxDev[u]! || 0;
    const clampedDev = Math.sign(rawDev) * Math.min(Math.abs(rawDev), maxDev);
    timeUserBias = model.userAlpha[u]! * clampedDev + model.userTimeBias[u]![bin]!;
    timeItemBias = model.itemTimeBias[i]![bin]!;
  }

  let dot = 0;
  for (let f = 0; f < factors; f++) dot += model.itemFactors[i]![f]! * pu[f]!;

  return Math.min(5, Math.max(1, model.mu + model.userBias[u]! + timeUserBias + model.itemBias[i]! + timeItemBias + dot));
}

export function rmse(model: MfModel, rows: Interaction[]): { rmse: number | null; mae: number | null; scored: number } {
  let squared = 0;
  let absolute = 0;
  let count = 0;
  for (const row of rows) {
    const prediction = predictMf(model, row.userId, row.itemId, row.day);
    if (prediction === null) continue;
    squared += Math.pow(row.rating - prediction, 2);
    absolute += Math.abs(row.rating - prediction);
    count++;
  }
  return {
    rmse: count === 0 ? null : round(Math.sqrt(squared / count), 6),
    mae: count === 0 ? null : round(absolute / count, 6),
    scored: count,
  };
}
