---
description: Use when modeling who is likely to respond — fitting and reading a propensity model, judging fit quality, reading decile lift, and knowing the limits that make it unsuitable as a targeting score on its own.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — response modeling and predictive modeling review"
---

# Response modeling

## What it is for

A propensity model estimates `P(buy | x)`. It is useful for sizing, for ranking outreach where the
action has no discount cost, and as the base learner inside an uplift model. It is **not** the
score a discount campaign should be targeted on.

## Fitting

`score_response_propensity` fits a regularized logistic regression on standardized features. Read
three things from the output:

- **AUC** — ≥0.70 usable, 0.60–0.70 weak, <0.60 effectively random ordering. Report which band.
- **Log-loss** — calibration. A model with good AUC and bad calibration ranks well but its
  probabilities cannot be used in an economic calculation.
- **Standardized coefficients** — direction and relative strength. If recency dominates everything,
  the model is mostly rediscovering "people who bought recently buy again".

## Decile lift

Split the scored base into ten and read the response rate per decile against the base rate. A
usable model shows monotone decay and a top decile at 2× or better. A flat table means the features
do not separate the outcome; widen the features rather than presenting the ranking as precise.

## Known traps

- **Leakage** — a feature that encodes the outcome (e.g. "opened the post-purchase email") produces
  an excellent model that cannot be used before the fact.
- **Selection** — training only on previously targeted customers models who was targeted, not who
  responds.
- **Concept drift** — a model fitted on a promotional period scores a non-promotional one badly.
  State the period the frame comes from.
- **Calibration under class imbalance** — with a 3% base rate, raw probabilities are small and
  small absolute errors are large relative ones.

## The limit that matters

Ranking by propensity concentrates spend on sure things. Every campaign that targets on propensity
and reports gross response is measuring the base rate. Pair it with `uplift-modeling` before any
discount is attached.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — response modeling within promotions, and the
predictive-modeling review.
