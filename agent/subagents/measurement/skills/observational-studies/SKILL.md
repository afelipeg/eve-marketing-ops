---
description: Use when no randomized control exists — selecting an observational design, stating its identifying assumption, running the falsification checks, and reporting the result as an association rather than a measured uplift.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — measurement without controlled experiments; confounding in response models"
---

# Observational studies

No control group means the counterfactual must be constructed. That construction is an assumption,
and the assumption is part of the result.

## Choose the design

| Design                    | Requires                                                | Identifying assumption                      | Falsification test                        |
| ------------------------- | ------------------------------------------------------- | -------------------------------------------- | ----------------------------------------- |
| Difference-in-differences | Exposed and unexposed units, pre and post periods       | Parallel trends absent treatment             | Pre-trend test; placebo period            |
| Matched control           | Rich covariates that drive both exposure and outcome    | Selection on observables                     | Balance table; sensitivity to unobservables |
| Propensity weighting      | A model of exposure probability                         | Overlap and no unmeasured confounding        | Overlap plot; trimming sensitivity        |
| Regression discontinuity  | A threshold rule assigning exposure                     | Continuity of potential outcomes at cutoff   | Density test for manipulation; bandwidth sweep |
| Interrupted time series   | A long, stable pre-period                               | Extrapolated pre-trend is the counterfactual | Placebo interruption at a fake date       |
| Synthetic control         | A donor pool of untreated units                         | Weighted donors reproduce the pre-period path | Pre-period fit error; leave-one-out donors |

## Procedure

1. Write the assumption as a sentence a skeptic could attack.
2. Run the falsification test for that design. A design whose falsification test fails is reported
   as failed, not adjusted until it passes.
3. Estimate the effect with an interval.
4. Run a sensitivity analysis: how strong would an unobserved confounder have to be to erase the
   effect? Report that threshold as a number.
5. Report as: "Association of x% [CI], under the assumption of <assumption>, which survives
   <falsification test> and would be erased by a confounder of strength <threshold>."

## What never happens here

- No observational estimate is called "uplift" or "incremental" without the assumption attached.
- No design is selected after seeing which one gives the larger effect.
- No "we controlled for everything available" — selection on observables is a claim about what
  drives exposure, not about how many columns were in the join.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — confounding and bias in observational
response measurement.
