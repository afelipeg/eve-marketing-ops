---
description: Use when many thin cells (territories, segments, stores) measure the same action — fitting the hierarchical beta-binomial by Gibbs sampling, reading shrinkage, and checking MCMC convergence before quoting any interval.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — hierarchical Bayesian models and MCMC in the predictive-modeling review"
---

# Gibbs sampling for hierarchical uplift

## Why pool

A cell with 640 exposures and 29 conversions reports 4.5%. Read alone, its interval is enormous and
its point estimate is noise. Read as one draw from a population of cells, it is pulled toward the
population mean by an amount proportional to its thinness. That is shrinkage, and it is the correct
answer under the model, not a smoothing trick.

The extremes in a table of many cells are mostly the smallest cells. Ranking cells on raw rates
ranks them on sample size.

## The model

```
y_i     ~ Binomial(n_i, p_i)                       for each cell i
p_i     ~ Beta(mu * kappa, (1 - mu) * kappa)       shared population
mu      = population mean rate
kappa   = concentration (high kappa = cells are alike)
```

## The sampler

`gibbs_hierarchical_uplift` runs:

1. `p_i | mu, kappa, y_i` — conjugate Beta draw, one per cell.
2. `mu | p, kappa` — Metropolis random walk on `logit(mu)`.
3. `kappa | p, mu` — Metropolis random walk on `log(kappa)`.

Control and treatment arms are fitted with their own hyperparameters; uplift is computed per draw,
so the interval carries both the cell uncertainty and the population uncertainty.

## Convergence checks before quoting anything

- **Acceptance rate** of each Metropolis step should sit roughly in 0.15–0.70. Outside that band,
  the hyperparameter posteriors are coarse — rerun with more iterations before quoting them.
- **Retained draws** after burn-in and thinning should be ≥ 1,000 for stable tail quantiles.
- **Burn-in** defaults to 1,500 iterations; raise it when the chain starts far from the data.
- Re-run with a different seed. If the intervals move materially, the chain has not converged.

## Reading the output

Report, per cell: observed rate, shrunk rate, shrinkage %, uplift with interval, P(positive).
Report the **population** uplift separately — it is the answer to "did this action work overall",
while the cell estimates answer "where did it work".

A cell whose interval spans zero while the population interval excludes zero is normal: the pooled
read has more information than any single cell.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — hierarchical Bayesian modeling and Markov
chain Monte Carlo in the predictive-modeling review.
