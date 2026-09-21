---
description: Use when estimating a conversion-rate difference between two arms — choosing priors, reading the posterior, interpreting the credible interval, P(treatment > control), and expected loss, and knowing when the beta-binomial model does not apply.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — Bayesian methods in the predictive-modeling review; response measurement"
---

# Beta-binomial analysis

## The model

```
conversions_arm ~ Binomial(n_arm, p_arm)
p_arm           ~ Beta(alpha, beta)
p_arm | data    ~ Beta(alpha + conversions, beta + n - conversions)      [conjugate]
```

Uplift is read from the **joint** posterior by sampling both arms, not from a normal approximation
to a difference of proportions. That matters exactly where it usually matters: small counts and
rates near 0 or 1.

## Priors

| Prior                | When                                                          |
| -------------------- | ------------------------------------------------------------- |
| `Beta(1, 1)`         | Default. Uniform, lets the data speak.                        |
| `Beta(0.5, 0.5)`     | Jeffreys. Slightly better tail behaviour on very rare events. |
| `Beta(a, b)` from history | A previous period's rate encoded as pseudo-counts. State the pseudo-count weight explicitly: it is a thumb on the scale and must be visible. |

Never pick a prior after seeing the data.

## Reading the output

- **Relative lift with a 90% credible interval** — the headline. "The lift is between x% and y%
  with 90% probability, given the model."
- **Significant** = the interval on absolute lift excludes zero. Nothing else earns the word.
- **P(treatment > control)** — direction confidence. 0.93 is not the same as significance; report
  both and never swap them.
- **Expected loss if shipping** — the average amount of conversion rate given up if treatment is
  shipped and control was in fact better. This is the decision-relevant quantity when the interval
  is wide but the downside is bounded; report it, do not act on it.
- **Minimum detectable effect** — quote it with every non-significant result, so an underpowered
  test is not confused with an absent effect.

## When this model does not apply

- Outcome is a count per unit or a continuous value → use a gamma-Poisson or log-normal model.
- Units contribute multiple correlated outcomes → the binomial independence assumption is violated;
  aggregate to the unit, or model the clustering.
- Treatment effect varies strongly across cells → read the hierarchical fit as well
  (`gibbs_hierarchical_uplift`).
- Sequential monitoring → repeated reads inflate false positives; either fix the horizon in advance
  or switch to a sequential test.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — Bayesian estimation in the predictive-modeling
review, applied to campaign response measurement.
