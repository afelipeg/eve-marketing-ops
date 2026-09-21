---
description: Use when there is no usable signal about the user — Bayesian-shrunk popularity, trending versus popular, editorial and business-rule slots, and keeping the fallback from becoming the default.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — non-personalized recommendation baselines"
---

# Non-personalized recommendations

## Bayesian shrinkage, not raw averages

An item with one 5-star rating is not the best item in the catalog:

```
score = ( n·mean_item + m·mean_global ) / ( n + m )
```

`m` is the shrinkage prior — how many "average" ratings every item is credited with before its own
evidence counts. Larger `m` trusts the catalog mean more, which is what you want on a sparse
catalog.

## Popular is not the same as trending

- **Popular** — high cumulative interactions. Stable, and stale: the same head every day.
- **Trending** — high *recent* interaction relative to its own baseline. Catches a new item before
  it accumulates volume.

A feed built only on cumulative popularity cannot surface anything new; a feed built only on
trending is noisy and manipulable. Use both, in labelled shelves.

## The baseline is a real competitor

Evaluate every personalized model against the popularity baseline. When a model cannot beat
shrunk popularity on precision *and* offers no coverage advantage, it is adding complexity, not
value. That result is worth reporting plainly.

## Where the fallback belongs

Non-personalized is correct for: a brand-new visitor, a user whose profile failed to load, an
empty candidate pool after context filters, and a fresh catalog. It is **not** an acceptable steady
state — if most impressions come from the fallback, the finding is about identity coverage or data
plumbing, and belongs upstream, not hidden behind a working-looking feed.

## Business-rule slots

Editorial picks, new-launch pushes and compliance-mandated placements are non-personalized by
construction. Keep them in **declared, capped slots** rather than mixed silently into the ranked
list, so their cost in relevance stays measurable.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — baseline recommenders.
