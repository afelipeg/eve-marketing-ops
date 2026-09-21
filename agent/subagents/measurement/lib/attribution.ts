import { hashSeed, mulberry32, quantile, round } from "./random";

/**
 * Multi-touch attribution as a causal quantity, V_k*.
 *
 * V_k* is the causal contribution of touchpoint k: how much conversion
 * probability the journey graph loses when k is removed from it. This is a
 * removal (ablation) effect on a first-order Markov model of the journey, not
 * a positional heuristic — last-click, first-click, and linear rules assign
 * credit without any counterfactual and are not used here.
 *
 * A Shapley decomposition is available as a second estimator: it averages a
 * channel's marginal contribution over coalition orderings, which is the right
 * frame when touchpoints are complements rather than a sequence.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — multitouch
 * attribution and causal measurement of promotions and advertisements.
 */

export type Journey = {
  /** Ordered touchpoints, e.g. ["search","advertisements","promotions"]. */
  path: string[];
  converted: boolean;
  /** Journeys with identical paths may be collapsed with a count. */
  count?: number;
  /** Optional monetary value of a converting journey. */
  value?: number;
};

export type ChannelCredit = {
  channel: string;
  vStar: number;
  sharePct: number;
  attributedConversions: number;
  attributedValue: number | null;
  ci?: [number, number];
};

export type AttributionResult = {
  method: "removal-effect" | "shapley";
  channels: ChannelCredit[];
  baselineConversionProbability: number;
  totalJourneys: number;
  totalConversions: number;
  baselineConversions: number;
  attributableConversions: number;
  totalValue: number | null;
  bootstrap: { replicates: number; ciLevel: number; seed: number } | null;
  warnings: string[];
};

const START = "__start__";
const CONVERT = "__convert__";
const NULL_STATE = "__null__";

function expand(journeys: Journey[]): Journey[] {
  return journeys.flatMap((j) =>
    Array.from({ length: Math.max(1, Math.floor(j.count ?? 1)) }, () => ({
      path: j.path,
      converted: j.converted,
      value: j.value,
      count: 1,
    })),
  );
}

function channelsOf(journeys: Journey[]): string[] {
  return [...new Set(journeys.flatMap((j) => j.path))].sort();
}

/**
 * First-order transition counts over start → channels → convert/null.
 *
 * When `exclude` is set, the named channel is ablated: every transition into it
 * is redirected to the null (non-converting) absorbing state and its own row is
 * dropped. That is the counterfactual "this touchpoint never existed" — not a
 * repositioning of the remaining touches, which would leave a mid-path channel
 * with zero measured contribution.
 */
function transitionMatrix(journeys: Journey[], exclude?: string) {
  const counts = new Map<string, Map<string, number>>();
  const bump = (from: string, to: string, weight: number) => {
    const row = counts.get(from) ?? new Map<string, number>();
    row.set(to, (row.get(to) ?? 0) + weight);
    counts.set(from, row);
  };

  for (const journey of journeys) {
    const weight = journey.count ?? 1;
    const path = journey.path;
    if (path.length === 0) {
      bump(START, NULL_STATE, weight);
      continue;
    }

    let previous = START;
    let ablated = false;
    for (const channel of path) {
      if (exclude !== undefined && channel === exclude) {
        // The journey dies where the ablated touchpoint would have been.
        bump(previous, NULL_STATE, weight);
        ablated = true;
        break;
      }
      bump(previous, channel, weight);
      previous = channel;
    }
    if (!ablated) {
      bump(previous, journey.converted ? CONVERT : NULL_STATE, weight);
    }
  }

  const probs = new Map<string, Map<string, number>>();
  for (const [from, row] of counts) {
    const total = [...row.values()].reduce((s, v) => s + v, 0);
    const p = new Map<string, number>();
    for (const [to, count] of row) p.set(to, count / total);
    probs.set(from, p);
  }
  return probs;
}

/** Absorption probability into CONVERT starting from START (direct linear solve). */
function conversionProbability(probs: Map<string, Map<string, number>>): number {
  const transient = [...probs.keys()].filter((s) => s !== CONVERT && s !== NULL_STATE);
  const index = new Map(transient.map((s, i) => [s, i]));
  const n = transient.length;
  if (n === 0) return 0;

  // (I - Q) p = r, where r_i = P(i -> CONVERT)
  const a: number[][] = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i < n; i++) {
    a[i]![i] = 1;
    const row = probs.get(transient[i]!) ?? new Map<string, number>();
    for (const [to, p] of row) {
      if (to === CONVERT) a[i]![n] += p;
      else if (to !== NULL_STATE) {
        const j = index.get(to);
        if (j !== undefined) a[i]![j] -= p;
      }
    }
  }

  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(a[pivot]![col]!) < 1e-12) continue;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    const pv = a[col]![col]!;
    for (let c = col; c <= n; c++) a[col]![c]! /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r]![col]!;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) a[r]![c]! -= factor * a[col]![c]!;
    }
  }

  const startIndex = index.get(START);
  if (startIndex === undefined) return 0;
  return Math.min(1, Math.max(0, a[startIndex]![n]!));
}

function removalEffects(journeys: Journey[], channels: string[]) {
  const base = conversionProbability(transitionMatrix(journeys));
  const effects = new Map<string, number>();
  for (const channel of channels) {
    const without = conversionProbability(transitionMatrix(journeys, channel));
    effects.set(channel, base === 0 ? 0 : (base - without) / base);
  }
  return { base, effects };
}

function shapleyValues(journeys: Journey[], channels: string[]) {
  if (channels.length > 12) {
    throw new Error(
      `Shapley enumeration is exact only up to 12 channels; received ${channels.length}. Use method "removal-effect".`,
    );
  }
  const index = new Map(channels.map((c, i) => [c, i]));
  const n = channels.length;

  // v(S) = conversions from journeys whose touched set is contained in S.
  const value = new Array<number>(1 << n).fill(0);
  for (const journey of journeys) {
    if (!journey.converted) continue;
    let mask = 0;
    for (const c of journey.path) mask |= 1 << index.get(c)!;
    const weight = journey.count ?? 1;
    for (let s = 0; s < 1 << n; s++) {
      if ((s & mask) === mask) value[s]! += weight;
    }
  }

  const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));
  const shapley = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    let phi = 0;
    for (let s = 0; s < 1 << n; s++) {
      if (s & (1 << i)) continue;
      const size = popcount(s);
      const weight = (factorial(size) * factorial(n - size - 1)) / factorial(n);
      phi += weight * (value[s | (1 << i)]! - value[s]!);
    }
    shapley.set(channels[i]!, phi);
  }
  return shapley;
}

const popcount = (x: number): number => {
  let c = 0;
  let v = x;
  while (v) {
    v &= v - 1;
    c++;
  }
  return c;
};

export function attribute(input: {
  journeys: Journey[];
  method?: "removal-effect" | "shapley";
  bootstrapReplicates?: number;
  ciLevel?: number;
  seed?: number;
}): AttributionResult {
  const { journeys, method = "removal-effect", bootstrapReplicates = 0, ciLevel = 0.9 } = input;

  if (journeys.length === 0) throw new Error("No journeys supplied.");
  const channels = channelsOf(journeys);
  if (channels.length === 0) throw new Error("No touchpoints found in the supplied journeys.");

  const totalJourneys = journeys.reduce((s, j) => s + (j.count ?? 1), 0);
  const converting = journeys.filter((j) => j.converted);
  const totalConversions = converting.reduce((s, j) => s + (j.count ?? 1), 0);
  // Conversions on journeys that touched NO channel (direct, organic, offline)
  // belong to no touchpoint. Scaling the shares by the grand total hands them
  // to the measured channels and inflates every one of them.
  const baselineConversions = converting
    .filter((j) => j.path.length === 0)
    .reduce((s, j) => s + (j.count ?? 1), 0);
  const attributableConversions = totalConversions - baselineConversions;
  const valued = converting.filter((j) => typeof j.value === "number");
  const totalValue =
    valued.length > 0 ? valued.reduce((s, j) => s + j.value! * (j.count ?? 1), 0) : null;

  const warnings: string[] = [];
  if (totalConversions < 30) {
    warnings.push(
      `Only ${totalConversions} converting journeys: credit shares are unstable. Treat as directional.`,
    );
  }
  const singleTouch =
    journeys.filter((j) => j.path.length <= 1).reduce((s, j) => s + (j.count ?? 1), 0) /
    totalJourneys;
  if (singleTouch > 0.8) {
    warnings.push(
      `${round(singleTouch * 100, 1)}% of journeys are single-touch: multi-touch attribution adds little over a simple count.`,
    );
  }

  const { base, effects } = removalEffects(journeys, channels);
  let raw: Map<string, number>;
  if (method === "shapley") {
    raw = shapleyValues(journeys, channels);
  } else {
    raw = effects;
  }

  const positives = [...raw.values()].filter((v) => v > 0);
  const totalPositive = positives.reduce((s, v) => s + v, 0);
  if (totalPositive <= 0) {
    warnings.push("No channel shows a positive contribution; credit shares are undefined.");
  }

  let cis: Map<string, [number, number]> | null = null;
  let bootstrap: AttributionResult["bootstrap"] = null;
  if (bootstrapReplicates > 0) {
    const seed = input.seed ?? hashSeed(`attr:${channels.join(",")}:${totalJourneys}`);
    cis = bootstrapShares(journeys, channels, method, bootstrapReplicates, ciLevel, seed);
    bootstrap = { replicates: bootstrapReplicates, ciLevel, seed };
  }

  const credits: ChannelCredit[] = channels
    .map((channel) => {
      const vStar = raw.get(channel) ?? 0;
      const sharePct = totalPositive > 0 ? (Math.max(0, vStar) / totalPositive) * 100 : 0;
      return {
        channel,
        vStar: round(vStar, 6),
        sharePct: round(sharePct, 3),
        attributedConversions: round((sharePct / 100) * attributableConversions, 2),
        attributedValue: totalValue === null ? null : round((sharePct / 100) * totalValue, 2),
        ci: cis?.get(channel),
      };
    })
    .sort((a, b) => b.sharePct - a.sharePct);

  return {
    method,
    channels: credits,
    baselineConversionProbability: round(base, 6),
    totalJourneys,
    totalConversions,
    /** Conversions with no touchpoint — never assigned to a channel. */
    baselineConversions,
    attributableConversions,
    totalValue: totalValue === null ? null : round(totalValue, 2),
    bootstrap,
    warnings,
  };
}

function bootstrapShares(
  journeys: Journey[],
  channels: string[],
  method: "removal-effect" | "shapley",
  replicates: number,
  ciLevel: number,
  seed: number,
): Map<string, [number, number]> {
  const rng = mulberry32(seed);
  const pool = expand(journeys);
  const samples = new Map<string, number[]>(channels.map((c) => [c, []]));

  for (let b = 0; b < replicates; b++) {
    const resample: Journey[] = new Array(pool.length);
    for (let i = 0; i < pool.length; i++) {
      resample[i] = pool[Math.floor(rng() * pool.length)]!;
    }
    const present = channelsOf(resample);
    const raw =
      method === "shapley"
        ? shapleyValues(resample, present)
        : removalEffects(resample, present).effects;
    const total = [...raw.values()].filter((v) => v > 0).reduce((s, v) => s + v, 0);
    for (const channel of channels) {
      const v = raw.get(channel) ?? 0;
      samples.get(channel)!.push(total > 0 ? (Math.max(0, v) / total) * 100 : 0);
    }
  }

  const lo = (1 - ciLevel) / 2;
  const hi = 1 - lo;
  return new Map(
    channels.map((c) => [
      c,
      [round(quantile(samples.get(c)!, lo), 3), round(quantile(samples.get(c)!, hi), 3)] as [
        number,
        number,
      ],
    ]),
  );
}
