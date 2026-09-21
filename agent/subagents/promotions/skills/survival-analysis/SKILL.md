---
description: Use when modeling time to churn, lapse, or repurchase — building Kaplan-Meier curves with correct censoring, reading hazard, choosing the lapse threshold, and comparing cohorts.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — churn and retention analysis"
---

# Survival analysis

## Why not a churn flag

A binary "churned / not churned" label discards the two facts that matter: *when*, and *whether we
have observed long enough to know*. A customer who bought 60 days ago is not retained, they are
**censored** — still under observation. Treating censored customers as retained inflates retention;
dropping them inflates churn.

## Kaplan-Meier

```
S(t) = Π over event times t_i ≤ t  ( 1 - d_i / n_i )
```

`estimate_ltv_survival` computes this over time-to-lapse: `d_i` lapse events, `n_i` customers still
at risk. It returns median survival, survival at 90/180/365 days, and the at-risk counts.

Read the tail with suspicion: once `n_i` is small, each event moves the curve a lot. Quote survival
at a horizon where the at-risk count is still substantial.

## Choosing the lapse threshold

The threshold defines the event, so it defines the answer. Set it from the **inter-purchase
interval distribution**, not by convention: a category bought weekly and one bought twice a year
cannot share a 180-day definition. State the threshold in every report, and re-run at a second
threshold to show whether the conclusion depends on it.

## Hazard

The hazard rate — conditional probability of lapsing now, given survival until now — is what
retention timing keys on. A hazard spike at a particular age says when to intervene; a flat hazard
says timing does not matter and the campaign should be targeted on value instead.

## Cohort comparison

Compare curves by cohort (acquisition channel, first-purchase category, acquired-on-promotion vs
not). Promotion-acquired cohorts frequently show worse survival — that difference is the real cost
of an acquisition discount, and it belongs in the CAC line.

A visible gap between two curves is not a measured effect: cohorts are not randomized. Hand
comparative claims to `measurement`.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — churn modeling and retention analysis.
