---
description: Use when the recommender is training on its own output — diagnosing rich-get-richer feedback loops, exposure bias in logs, filter bubbles, and the exploration budget that keeps the catalog reachable.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — feedback effects and exposure in recommender systems"
---

# Feedback loops and popularity bias

## The loop

```
recommend popular → they get interactions → they look more popular → recommend them more
```

Within a few cycles the model trains almost entirely on its own past choices. Symptoms, in order of
appearance:

1. Coverage falls steadily release over release.
2. Mean item popularity in served slates rises.
3. Offline precision **improves** while incremental revenue does not — the model is getting better
   at predicting the demand it caused.
4. New items never accumulate enough signal to be recommendable.

Watch coverage and mean popularity as **guardrail metrics on every release**. They move before
revenue does.

## Exposure bias in the log

An item with no clicks may be irrelevant, or may simply never have been shown. Logged data cannot
distinguish these, so a model fitted naively treats never-shown as disliked. Mitigations:

- **Log propensities** — the probability each item was shown — so inverse-propensity weighting is
  possible later. This must be decided *before* the data is collected.
- **Reserve an exploration share** of slots for under-exposed items. This is the only reliable way
  to keep the tail reachable, and its cost is a known, small relevance loss, not an unbounded one.

## Filter bubbles

Content filtering narrows by construction; collaborative filtering narrows through the popularity
loop. Both reduce the user's exposed variety over time. Track **per-user** category spread across
sessions, not only within a slate — intra-list diversity can look healthy while every slate shows
the same three categories.

## The honest framing

A recommender that maximizes accuracy against its own logs converges to predicting what it already
causes. Breaking that requires deliberately spending relevance on exploration and measuring the
result with a holdout — an incrementality question for `measurement`, not an offline metric.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — feedback effects in algorithmic services.
