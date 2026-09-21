---
description: Use when estimating a demand curve from sell-out — choosing the functional form, the controls that must be included, handling censored and promoted weeks, and judging whether the data can identify a price effect at all.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — demand prediction"
---

# Demand prediction

## Functional forms

| Form | Model | Use when |
| --- | --- | --- |
| **Log-linear** | `ln q = a + eps·ln p + controls` | Default. `eps` *is* the elasticity, constant over the range |
| Linear | `q = a + b·p` | Narrow price range; elasticity varies along the curve |
| **MNL** | `P(j) ∝ exp(alpha_j + beta·p_j)` | Substitution between SKUs matters; gives cross-elasticities |
| Exponential | `q = a·e^(b·p)` | Semi-log; percentage volume response to absolute price change |

## The controls that are not optional

- **Competitor price.** Without it, the own-price coefficient absorbs competitive response.
- **Promotion flag.** Promotions are correlated with low prices *and* with display and feature. In
  the sample data, dropping the promo control moves an estimate from −2.08 to −4.45: the price
  coefficient absorbs the whole promotional lift.
- **Seasonality**, as harmonics of the week index, plus a slow trend.

## Censoring

A stockout week is **not** a low-demand week. Observed units were capped by supply, so keeping
those rows teaches the model that a low price sold little — biasing elasticity toward zero. In the
sample data this moves a true −2.44 to −0.69.

`estimate_demand` excludes stockout weeks by default. Where they dominate the window, the honest
statement is that demand is unobserved, not that it is weak.

## Identification

Price must actually have varied: below a coefficient of variation of ~0.03, no method recovers an
elasticity, and any number returned is an artifact of the controls. The tool refuses there.

Worse than thin variation is **endogenous** variation: prices were set by someone who knew the
market — cut where demand was already falling, raised where it was strong. This biases elasticity
toward zero and no control fully removes it. The clean identification is a deliberate randomized
price test. Say which you have.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — demand prediction and response modeling.
