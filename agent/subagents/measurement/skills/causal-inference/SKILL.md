---
description: Use when deciding whether a number can carry a causal claim at all — stating the counterfactual, checking identification, listing the threats (confounding, selection, spillover, Simpson's paradox, multiple comparisons), and grading the strength of the evidence.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — causality in marketing response measurement; attribution as a causal problem"
---

# Causal inference

## The question behind every measurement

*What would have happened to this outcome, for these units, in this window, had the action not been
taken?* If that sentence cannot be completed with a specific comparison, there is no causal claim —
only a description.

## Identification checklist

1. **Counterfactual** — what plays the role of "no action"? Name the units and the window.
2. **Assignment** — what decided who was exposed? If exposure was chosen by a model, by a manager,
   or by the customer, selection is present by construction.
3. **Confounders** — what moves both exposure and outcome? Seasonality, price changes,
   distribution, competitor activity, other services in the same window.
4. **Interference** — can one unit's treatment affect another's outcome? Households, stores in a
   catchment, social propagation, shared inventory.
5. **Outcome timing** — is the window long enough for the effect, and short enough to exclude the
   next intervention?

Any box unchecked is reported as a limitation with a direction: does the bias inflate or deflate
the estimate?

## Standard threats

| Threat                  | Signature                                                      | Response                                   |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| Confounding             | Exposed units differ pre-period                                 | Randomize, match, or state the assumption  |
| Selection into exposure | Targeting model picked likely converters                        | Analyze by assignment (ITT), not exposure  |
| Survivorship            | Non-responders dropped from the denominator                     | Fix the denominator at assignment          |
| Spillover               | Control units show a lift too                                   | Randomize at a coarser unit                |
| Simpson's paradox       | Aggregate sign opposes every cell's sign                        | Read the hierarchical fit                  |
| Multiple comparisons    | One of twelve cells is "significant"                            | Declare the count; treat extremes as selected |
| Peeking                 | Test stopped when it looked good                                | Fix the horizon, or use a sequential test  |
| Regression to the mean  | The worst-performing cell improves after treatment              | Compare against a control, not against itself |

## Evidence grades

Attach one to every result:

- **A — experimental.** Randomized assignment, clean holdout, pre-registered window.
- **B — quasi-experimental.** Geo or switchback design, falsification test passed.
- **C — observational, assumption stated and tested.** Report as association.
- **D — descriptive.** No counterfactual. Report as description; no causal language, ever.

The orchestrator allocates differently against a grade A result and a grade C result, so the grade
is not decoration — it is part of the answer.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — causal framing of marketing response and
attribution.
