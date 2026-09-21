---
description: Use when splitting conversion credit across publishers, placements or channels — computing V_k*, deriving CPA_a, reading the credit-versus-spend gap, and refusing last-touch.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — multitouch attribution and the causal contribution of touchpoints"
---

# Multi-touch attribution

## V_k*

```
V_k* = ( P(convert | full journey graph) - P(convert | graph without k) ) / P(convert | full graph)
```

`attribute_v_star` ablates a touchpoint by redirecting its inbound transitions to the
non-converting absorbing state on a first-order Markov model of the journey — the counterfactual
"this touchpoint never existed". Shapley decomposition is available when touchpoints act as
complements rather than a sequence.

## Last-touch is not attribution

Last-touch assigns 100% of credit to whatever appeared last, which is mechanically biased toward
retargeting and search — the channels that appear late because the user was already converting.
Running a campaign on it moves budget from what creates demand to what observes it.

When a platform's own number is quoted, name it as a **platform-reported, last-touch, self-attributed
number** and give V_k* beside it. Do not reproduce it as measurement.

## CPA_a and the credit-versus-spend gap

```
CPA_a = spend_channel / attributed conversions_channel
gap   = attribution share - spend share
```

Positive gap: the channel is underfunded relative to its causal contribution. Negative: overfunded.
Move budget in **small steps and re-measure** — the shares are estimated on the current mix, and
they change as the mix changes.

## Limits to state every time

1. It is a counterfactual on observed journeys, **not an experiment**. Identified only if journey
   composition is not itself caused by the removed channel.
2. Unobserved touchpoints — offline, organic, in-store, another device — are absorbed into the
   observed channels and inflate them.
3. A first-order model forgets everything before the previous touch.
4. Attribution redistributes **observed** conversions. It cannot say how many conversions would
   exist at a different spend level. That is incrementality, and it needs a holdout.

**When attribution and a holdout disagree, the holdout wins.** Say so, and route the read to
`measurement`.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — multitouch attribution models.
