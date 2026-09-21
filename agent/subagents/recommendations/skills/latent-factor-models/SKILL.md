---
description: Use when fitting matrix factorization — biased SVD, SVD++ with implicit feedback, timeSVD++ with drifting biases, choosing factors and regularization, and deciding whether the temporal model actually earns its parameters.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — latent factor models for collaborative filtering"
---

# Latent factor models

## The three models

```
SVD        r̂ = mu + b_u + b_i + q_i·p_u
SVD++      r̂ = mu + b_u + b_i + q_i·( p_u + |N(u)|^-1/2 Σ_{j∈N(u)} y_j )
timeSVD++  b_u(t) = b_u + alpha_u·dev_u(t) + b_{u,bin(t)}
           b_i(t) = b_i + b_{i,bin(t)}
```

- **SVD++** adds the implicit signal: *which* items a user touched carries preference information
  independent of the rating value. It usually helps most where ratings are sparse but interactions
  are not.
- **timeSVD++** adds drift: user standards and item appeal move. It only pays when drift is real
  and large relative to noise — otherwise it adds parameters and loses on the holdout.

Fit on observed entries only, by SGD. Never impute a dense matrix first: imputation invents data
and the factorization then fits the invention.

## Two implementation details that decide whether it works

1. **Time bins are the first thing to overfit.** With ~20 ratings per user, per-user time bins are
   near-saturated. Four bins, regularized an order of magnitude harder than the static biases.
2. **Clamp the time deviation at prediction.** `alpha_u·dev(t)` grows without bound on days beyond
   the training range, so a linear taste trend fitted on one year silently extrapolates forever.
   Clamping to the support seen in training costs nothing in-sample and removes drift the model has
   no evidence for. This single change is worth more than any hyperparameter here.

## Hyperparameters

| Parameter | Effect |
| --- | --- |
| factors | 8–50. More factors fit more structure and overfit sparse data faster. |
| regularization | 0.02–0.1. Raise with sparsity. |
| learning rate | 0.005–0.01. Higher diverges; lower needs more epochs. |
| epochs | Watch train vs holdout RMSE separate — that gap is the overfit. |

## Always compare, never assume

`recommend_latent_factors` with `compareModels: true` fits all three on the same temporal split.
Report which one wins. The temporal model is frequently *not* the winner, and saying so is the
result.

RMSE measures rating prediction, not ranking. A model that wins on RMSE can lose on precision@k and
coverage — check `evaluate_recommender` before shipping.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — matrix factorization and latent factor
models.
