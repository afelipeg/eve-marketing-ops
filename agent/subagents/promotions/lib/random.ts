/**
 * Seeded pseudo-random number generation and sampling primitives.
 *
 * Every stochastic tool in this agent takes a seed and threads it through here,
 * so a reported credible interval is reproducible: the same inputs and seed
 * always yield the same numbers, across retries, replays, and redeploys.
 */

export type Rng = () => number;

/** mulberry32: small, fast, good enough for Monte Carlo over conversion counts. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** cyrb53 string hash, used to derive a stable default seed from the inputs. */
export function hashSeed(input: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)) % 2147483647;
}

export function randomNormal(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Marsaglia-Tsang gamma sampler, with Johnk boost for shape < 1. */
export function randomGamma(shape: number, rng: Rng): number {
  if (shape <= 0) throw new Error("gamma shape must be > 0");
  if (shape < 1) {
    const u = rng();
    return randomGamma(shape + 1, rng) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = randomNormal(rng);
    const v = Math.pow(1 + c * x, 3);
    if (v <= 0) continue;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function randomBeta(alpha: number, beta: number, rng: Rng): number {
  const g1 = randomGamma(alpha, rng);
  const g2 = randomGamma(beta, rng);
  return g1 / (g1 + g2);
}

/** Binomial sampler: exact for small n, normal approximation above the cutoff. */
export function randomBinomial(n: number, p: number, rng: Rng): number {
  if (n <= 0) return 0;
  if (p <= 0) return 0;
  if (p >= 1) return n;
  if (n <= 2000) {
    let count = 0;
    for (let i = 0; i < n; i++) if (rng() < p) count++;
    return count;
  }
  const mean = n * p;
  const sd = Math.sqrt(n * p * (1 - p));
  const draw = Math.round(mean + sd * randomNormal(rng));
  return Math.min(n, Math.max(0, draw));
}

/** Quantile of an unsorted sample, linear interpolation between order statistics. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (pos - lower);
}

export const mean = (values: number[]): number =>
  values.length === 0 ? Number.NaN : values.reduce((s, v) => s + v, 0) / values.length;

export const round = (value: number, digits = 4): number => {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
};
