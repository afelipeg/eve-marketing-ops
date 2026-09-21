---
description: Use when interpreting or applying an elasticity — reading the interval, the elastic/inelastic boundary, cross-elasticity, the closed-form optimal price, and the limits on extrapolating it.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — price elasticity and optimal pricing"
---

# Price elasticity

## Definition and the boundary that matters

```
eps = %Δ quantity / %Δ price          (negative for normal goods)
```

| Range | Meaning | Revenue of a price *rise* |
| --- | --- | --- |
| `eps < -1` | Elastic | Falls |
| `-1 < eps < 0` | **Inelastic** | **Rises** |
| `eps > 0` | Giffen / misspecified | Check the model before believing it |

Inelastic demand is the case most often mishandled. It means the unconstrained margin optimum is
unbounded above, so there is no "profit-maximizing price" to report — the binding limit is a
ceiling, a competitor, a fairness constraint, or a law.

## The closed form

For constant elasticity with marginal cost `c`:

```
p* = c · eps / (1 + eps)        valid only for eps < -1
```

At `eps = -2`, `p* = 2c`; at `eps = -3`, `p* = 1.5c`; at `eps = -1.2`, `p* = 6c`. The optimum rises
steeply as demand becomes less elastic, which is also where the estimate is least reliable — so
treat the interval, not the point, as the answer.

## Cross-elasticity

```
eps_ij = %Δ quantity of i / %Δ price of j
```

Positive means substitutes, negative means complements. Cross-elasticities are the input to
cannibalization: a cut on one SKU pulls volume from its substitutes, and the portfolio can lose
margin while the repriced SKU looks like a success.

They are also the least reliable estimates in the system. Treat them as directional.

## Limits

- **Local.** An elasticity is valid over the observed price range. Extrapolating a 30% move from
  data that only ever moved 5% is not supported.
- **Asymmetric.** Response to increases and decreases differs; reference-price effects make cuts
  easier to feel than rises.
- **Time-varying.** Elasticity moves with season, competitive intensity and category inflation.
  Re-estimate on a rolling window.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — elasticity and optimal price.
