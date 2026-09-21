---
description: Use when quantifying how much of an outcome an action actually caused — separating incremental from baseline and pulled-forward demand, choosing the uplift estimand, and reporting a result that survives scrutiny.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — uplift (incremental response) modeling for promotions and advertisements"
---

# Uplift measurement

## The estimand

Uplift is the difference between what happened and what would have happened. Decide which version
is being reported before estimating:

| Estimand                        | Question                                                      |
| ------------------------------- | -------------------------------------------------------------- |
| Average treatment effect (ATE)  | Effect if everyone were treated                                |
| Effect on the treated (ATT)     | Effect on those actually exposed                               |
| Conditional effect (CATE)       | Effect for a segment — the basis of uplift *targeting*         |
| Incremental value               | Effect converted into margin, net of the cost of treating      |

Report the cost-adjusted version whenever the action has a unit cost: a promotion with +3% response
and a 20% discount can be incremental in volume and negative in margin.

## The four customer types

Uplift modeling exists because response splits into:

- **Persuadables** — buy only if treated. The only group that creates value.
- **Sure things** — buy either way. Treating them spends discount on base demand.
- **Lost causes** — never buy. Treating them spends budget on nothing.
- **Sleeping dogs** — buy unless treated. Treating them destroys demand.

A campaign with strong raw response and no holdout cannot tell these apart. Its "response" is mostly
sure things. Say that when a service reports raw response instead of uplift.

## Decompose before you conclude

For any volume gain, split it into: incremental, switched from our own adjacent packs, and pulled
forward from the next period. Only the first is uplift. Check the post-period for the dip that
reveals pull-forward — a two-week win followed by a two-week hole is a timing shift, not a lift.

## Reporting rules

- Uplift is always relative **and** absolute, each with its 90% credible interval.
- State the baseline: the control rate, its period, and its sample.
- State the window, including the outcome lag.
- Non-significant results are reported with the minimum detectable effect, so the orchestrator can
  distinguish "no effect" from "test too small".
- Never report an uplift without naming the counterfactual that produced it.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — incremental response (uplift) modeling and
its role in campaign targeting.
