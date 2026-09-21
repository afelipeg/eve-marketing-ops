---
description: Use when splitting credit for a conversion across touchpoints — computing V_k* as a removal effect or Shapley value, bootstrapping the shares, and refusing positional heuristics.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — multitouch attribution models and the causal effect of touchpoints"
---

# Multi-touch attribution

## V_k*: credit as a counterfactual

```
V_k* = ( P(convert | full journey graph) - P(convert | graph without k) ) / P(convert | full graph)
```

The contribution of touchpoint k is what the journey loses without it. `attribution_v_star`
computes this as a removal effect on a first-order Markov model of the journey (states: start,
each channel, conversion, null), or as an exact Shapley value over coalitions of touched channels.

- **Removal effect** — use when order matters and journeys are sequential.
- **Shapley** — use when touchpoints act as complements and order is incidental. Exact up to 12
  channels; beyond that, use the removal effect.

## What is refused

Last-click, first-click, linear, and time-decay rules assign credit by position in the path. None of
them contains a counterfactual, so none of them measures anything. If asked for one, say that it
is not a measurement and give V_k* instead.

## Reading the output

- **Share %** — the channel's normalized positive contribution. Shares sum to 100% across channels
  with positive contribution.
- **Bootstrap CI** — set `bootstrapReplicates` (200 is usually enough) whenever the shares will be
  used to move budget. A share of 31% [12%, 47%] is not a mandate to shift a third of the budget.
- **Attributed conversions and value** — the share applied to the observed totals.

## Limits to state every time

1. Attribution is a counterfactual **on observed journeys**, not an experiment. It is identified
   only if journey composition is not itself caused by the channel being removed.
2. Unobserved touchpoints (offline, word of mouth, organic exposure) are absorbed into the observed
   channels, inflating them.
3. A first-order Markov model forgets everything before the previous touch; long journeys with
   memory effects are approximated.
4. Attribution redistributes **observed** conversions. It cannot say how many conversions would
   exist at a different spend level — that is an incrementality question, answered with a holdout.

When attribution and a holdout disagree, the holdout wins. Say so.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — multitouch attribution and the causal
contribution of touchpoints in promotions and advertisements.
