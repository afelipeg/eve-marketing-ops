import { hashSeed, mean, mulberry32, quantile, randomBeta, randomNormal, round, type Rng } from "./random";

/**
 * Hierarchical beta-binomial model fitted by Gibbs sampling with Metropolis
 * steps on the hyperparameters.
 *
 * Use it when the same action is measured across many cells (territories,
 * segments, stores) and per-cell samples are thin. Cells are drawn from a
 * shared population: p_i ~ Beta(mu * kappa, (1 - mu) * kappa), which pulls
 * noisy small-cell estimates toward the population mean instead of letting a
 * 3-of-10 cell claim a 30% conversion rate.
 *
 * Sampler:
 *   p_i | mu, kappa, y   ~ Beta(mu*kappa + y_i, (1-mu)*kappa + n_i - y_i)   [conjugate]
 *   mu    | p, kappa     ~ Metropolis random walk on logit(mu)
 *   kappa | p, mu        ~ Metropolis random walk on log(kappa)
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — Bayesian
 * hierarchical modeling and MCMC in the predictive-modeling review.
 */

export type Cell = {
  label: string;
  control: { n: number; conversions: number };
  treatment: { n: number; conversions: number };
};

export type CellEstimate = {
  label: string;
  observedControlRate: number;
  observedTreatmentRate: number;
  observedRelativeLiftPct: number | null;
  shrunkControlRate: number;
  shrunkTreatmentRate: number;
  relativeLiftPct: { estimate: number; ci: [number, number] };
  probabilityPositive: number;
  significant: boolean;
  shrinkagePct: number;
};

export type PooledEstimate = {
  relativeLiftPct: { estimate: number; ci: [number, number] };
  absoluteLift: { estimate: number; ci: [number, number] };
  probabilityPositive: number;
  significant: boolean;
  weighting: "exposure";
};

export type HierarchicalResult = {
  cells: CellEstimate[];
  /** Exposure-weighted effect across the observed cells: the pooled read. */
  pooled: PooledEstimate;
  /** Hyper-mean: the effect expected in a NEW cell drawn from this population. */
  population: {
    controlRate: { estimate: number; ci: [number, number] };
    treatmentRate: { estimate: number; ci: [number, number] };
    relativeLiftPct: { estimate: number; ci: [number, number] };
    probabilityPositive: number;
    significant: boolean;
  };
  diagnostics: {
    iterations: number;
    burnIn: number;
    thin: number;
    keptDraws: number;
    acceptance: { controlMu: number; controlKappa: number; treatmentMu: number; treatmentKappa: number };
    seed: number;
    notes: string[];
  };
  ciLevel: number;
};

const logGamma = (x: number): number => {
  // Lanczos approximation, g = 7, n = 9.
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
};

const logBetaDensity = (p: number, a: number, b: number): number => {
  if (p <= 0 || p >= 1) return -Infinity;
  return (
    (a - 1) * Math.log(p) +
    (b - 1) * Math.log(1 - p) +
    logGamma(a + b) -
    logGamma(a) -
    logGamma(b)
  );
};

const logit = (p: number) => Math.log(p / (1 - p));
const expit = (x: number) => 1 / (1 + Math.exp(-x));

type ArmChain = {
  rates: number[][]; // [draw][cell]
  mu: number[];
  kappa: number[];
  acceptMu: number;
  acceptKappa: number;
};

function sampleArm(
  counts: { n: number; conversions: number }[],
  rng: Rng,
  iterations: number,
  burnIn: number,
  thin: number,
): ArmChain {
  const k = counts.length;
  let mu = Math.min(
    0.999,
    Math.max(
      0.001,
      counts.reduce((s, c) => s + (c.n > 0 ? c.conversions / c.n : 0), 0) / Math.max(1, k),
    ),
  );
  let kappa = 20;
  let p = counts.map((c) => (c.n > 0 ? Math.min(0.999, Math.max(0.001, c.conversions / c.n)) : mu));

  const rates: number[][] = [];
  const muDraws: number[] = [];
  const kappaDraws: number[] = [];
  let acceptMu = 0;
  let acceptKappa = 0;

  // Random-walk scales, tuned during burn-in toward a 0.30 acceptance rate
  // (Robbins-Monro style). Fixed after burn-in so the sampled chain is
  // a valid Markov chain.
  let muStep = 0.35;
  let kappaStep = 0.4;
  let windowAcceptMu = 0;
  let windowAcceptKappa = 0;
  const WINDOW = 100;
  const clampStep = (x: number) => Math.min(5, Math.max(0.01, x));

  const logPrior = (m: number, kap: number) =>
    // Weakly informative: mu ~ Beta(1,1), kappa ~ half-Cauchy-ish via log-normal(log 20, 1.5).
    kap <= 0 ? -Infinity : -Math.pow(Math.log(kap) - Math.log(20), 2) / (2 * 1.5 * 1.5);

  const logLikHyper = (m: number, kap: number) => {
    const a = m * kap;
    const b = (1 - m) * kap;
    if (a <= 0 || b <= 0) return -Infinity;
    let total = logPrior(m, kap);
    for (const pi of p) total += logBetaDensity(pi, a, b);
    return total;
  };

  for (let iter = 0; iter < iterations; iter++) {
    // 1. Conjugate draw of each cell rate.
    const a = mu * kappa;
    const b = (1 - mu) * kappa;
    p = counts.map((c, i) =>
      Math.min(
        0.999999,
        Math.max(1e-6, randomBeta(a + c.conversions, b + (c.n - c.conversions), rng)),
      ) || p[i]!,
    );

    // 2. Metropolis step on logit(mu).
    const muProp = expit(logit(mu) + muStep * randomNormal(rng));
    if (muProp > 0 && muProp < 1) {
      // The random walk is symmetric in eta = logit(mu), but logLikHyper is a
      // density in mu-space, so the change of variables owes a Jacobian:
      // d(mu)/d(eta) = mu(1-mu). Omitting it makes the chain target
      // f(mu)/(mu(1-mu)) — an implicit Haldane prior that pulls the population
      // rate toward 0 and 1. Measured bias on a known posterior: -4.7%.
      const logJacobian =
        Math.log(muProp * (1 - muProp)) - Math.log(mu * (1 - mu));
      const logRatio = logLikHyper(muProp, kappa) - logLikHyper(mu, kappa) + logJacobian;
      if (Math.log(rng()) < logRatio) {
        mu = muProp;
        acceptMu++;
        windowAcceptMu++;
      }
    }

    // 3. Metropolis step on log(kappa).
    const kappaProp = Math.exp(Math.log(kappa) + kappaStep * randomNormal(rng));
    const logRatioK = logLikHyper(mu, kappaProp) - logLikHyper(mu, kappa);
    if (Math.log(rng()) < logRatioK) {
      kappa = kappaProp;
      acceptKappa++;
      windowAcceptKappa++;
    }

    if (iter < burnIn && (iter + 1) % WINDOW === 0) {
      muStep = clampStep(muStep * Math.exp(windowAcceptMu / WINDOW - 0.3));
      kappaStep = clampStep(kappaStep * Math.exp(windowAcceptKappa / WINDOW - 0.3));
      windowAcceptMu = 0;
      windowAcceptKappa = 0;
    }

    if (iter >= burnIn && (iter - burnIn) % thin === 0) {
      rates.push([...p]);
      muDraws.push(mu);
      kappaDraws.push(kappa);
    }
  }

  return {
    rates,
    mu: muDraws,
    kappa: kappaDraws,
    acceptMu: acceptMu / iterations,
    acceptKappa: acceptKappa / iterations,
  };
}

export function hierarchicalUplift(input: {
  cells: Cell[];
  iterations?: number;
  burnIn?: number;
  thin?: number;
  ciLevel?: number;
  seed?: number;
}): HierarchicalResult {
  const { cells, iterations = 6_000, burnIn = 1_500, thin = 2, ciLevel = 0.9 } = input;

  if (cells.length < 2) {
    throw new Error(
      "Hierarchical pooling needs at least 2 cells. For a single cell use beta_binomial_uplift.",
    );
  }
  for (const cell of cells) {
    for (const arm of ["control", "treatment"] as const) {
      const { n, conversions } = cell[arm];
      if (conversions < 0 || conversions > n) {
        throw new Error(`${cell.label}/${arm}: conversions must be between 0 and n.`);
      }
    }
  }

  const seed =
    input.seed ??
    hashSeed(cells.map((c) => `${c.label}:${c.control.n}:${c.control.conversions}:${c.treatment.n}:${c.treatment.conversions}`).join("|"));
  const rng = mulberry32(seed);

  const controlChain = sampleArm(cells.map((c) => c.control), rng, iterations, burnIn, thin);
  const treatmentChain = sampleArm(cells.map((c) => c.treatment), rng, iterations, burnIn, thin);

  const draws = Math.min(controlChain.rates.length, treatmentChain.rates.length);
  const lo = (1 - ciLevel) / 2;
  const hi = 1 - lo;

  const cellEstimates: CellEstimate[] = cells.map((cell, i) => {
    const lifts: number[] = [];
    const controlRates: number[] = [];
    const treatmentRates: number[] = [];
    let positive = 0;
    for (let d = 0; d < draws; d++) {
      const pc = controlChain.rates[d]![i]!;
      const pt = treatmentChain.rates[d]![i]!;
      controlRates.push(pc);
      treatmentRates.push(pt);
      const lift = ((pt - pc) / pc) * 100;
      lifts.push(lift);
      if (pt > pc) positive++;
    }

    const observedControl = cell.control.n > 0 ? cell.control.conversions / cell.control.n : 0;
    const observedTreatment =
      cell.treatment.n > 0 ? cell.treatment.conversions / cell.treatment.n : 0;
    const shrunkControl = mean(controlRates);
    const ciLift: [number, number] = [
      round(quantile(lifts, lo), 3),
      round(quantile(lifts, hi), 3),
    ];

    return {
      label: cell.label,
      observedControlRate: round(observedControl, 6),
      observedTreatmentRate: round(observedTreatment, 6),
      observedRelativeLiftPct:
        observedControl === 0 ? null : round(((observedTreatment - observedControl) / observedControl) * 100, 3),
      shrunkControlRate: round(shrunkControl, 6),
      shrunkTreatmentRate: round(mean(treatmentRates), 6),
      relativeLiftPct: { estimate: round(mean(lifts), 3), ci: ciLift },
      probabilityPositive: round(positive / draws, 4),
      significant: ciLift[0] > 0 || ciLift[1] < 0,
      shrinkagePct:
        observedControl === 0
          ? 0
          : round((Math.abs(shrunkControl - observedControl) / observedControl) * 100, 2),
    };
  });

  // Exposure-weighted pooled effect across the observed cells.
  const weights = cells.map((c) => c.control.n + c.treatment.n);
  const weightTotal = weights.reduce((s, w) => s + w, 0);
  if (weightTotal <= 0) {
    throw new Error(
      "Every cell has zero exposure, so there is nothing to pool. Supply cells with non-zero control and treatment counts.",
    );
  }
  const pooledRelative: number[] = [];
  const pooledAbsolute: number[] = [];
  let pooledPositive = 0;
  for (let d = 0; d < draws; d++) {
    let weightedControl = 0;
    let weightedTreatment = 0;
    for (let i = 0; i < cells.length; i++) {
      const w = weights[i]! / weightTotal;
      weightedControl += w * controlChain.rates[d]![i]!;
      weightedTreatment += w * treatmentChain.rates[d]![i]!;
    }
    const absolute = weightedTreatment - weightedControl;
    pooledAbsolute.push(absolute);
    pooledRelative.push(weightedControl === 0 ? 0 : (absolute / weightedControl) * 100);
    if (absolute > 0) pooledPositive++;
  }
  const pooledRelCi: [number, number] = [
    round(quantile(pooledRelative, lo), 3),
    round(quantile(pooledRelative, hi), 3),
  ];
  const pooledAbsCi: [number, number] = [
    round(quantile(pooledAbsolute, lo), 6),
    round(quantile(pooledAbsolute, hi), 6),
  ];

  const popLifts: number[] = [];
  let popPositive = 0;
  for (let d = 0; d < draws; d++) {
    const mc = controlChain.mu[d]!;
    const mt = treatmentChain.mu[d]!;
    popLifts.push(((mt - mc) / mc) * 100);
    if (mt > mc) popPositive++;
  }
  const popCi: [number, number] = [
    round(quantile(popLifts, lo), 3),
    round(quantile(popLifts, hi), 3),
  ];

  const notes: string[] = [];
  const acc = [
    controlChain.acceptMu,
    controlChain.acceptKappa,
    treatmentChain.acceptMu,
    treatmentChain.acceptKappa,
  ];
  if (acc.some((a) => a < 0.15 || a > 0.7)) {
    notes.push(
      "Metropolis acceptance outside 0.15-0.70: treat hyperparameter posteriors as coarse and rerun with more iterations before quoting them.",
    );
  }
  if (draws < 1_000) {
    notes.push(`Only ${draws} retained draws: widen iterations or reduce thinning for stable tails.`);
  }

  return {
    cells: cellEstimates,
    pooled: {
      relativeLiftPct: { estimate: round(mean(pooledRelative), 3), ci: pooledRelCi },
      absoluteLift: { estimate: round(mean(pooledAbsolute), 6), ci: pooledAbsCi },
      probabilityPositive: round(pooledPositive / draws, 4),
      significant: pooledAbsCi[0] > 0 || pooledAbsCi[1] < 0,
      weighting: "exposure",
    },
    population: {
      controlRate: {
        estimate: round(mean(controlChain.mu), 6),
        ci: [round(quantile(controlChain.mu, lo), 6), round(quantile(controlChain.mu, hi), 6)],
      },
      treatmentRate: {
        estimate: round(mean(treatmentChain.mu), 6),
        ci: [round(quantile(treatmentChain.mu, lo), 6), round(quantile(treatmentChain.mu, hi), 6)],
      },
      relativeLiftPct: { estimate: round(mean(popLifts), 3), ci: popCi },
      probabilityPositive: round(popPositive / draws, 4),
      significant: popCi[0] > 0 || popCi[1] < 0,
    },
    diagnostics: {
      iterations,
      burnIn,
      thin,
      keptDraws: draws,
      acceptance: {
        controlMu: round(controlChain.acceptMu, 3),
        controlKappa: round(controlChain.acceptKappa, 3),
        treatmentMu: round(treatmentChain.acceptMu, 3),
        treatmentKappa: round(treatmentChain.acceptKappa, 3),
      },
      seed,
      notes,
    },
    ciLevel,
  };
}
