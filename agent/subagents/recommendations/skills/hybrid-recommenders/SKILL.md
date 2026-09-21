---
description: Use when combining several recommenders — switching, weighted blending, feature augmentation and cascade designs, normalizing scores before blending, and choosing a strategy from data availability.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — hybrid recommendation strategies"
---

# Hybrid recommenders

## The strategies

| Strategy | Mechanism | Use when |
| --- | --- | --- |
| **Switching** | Route to one model by data availability | Cold start; the default router |
| **Weighted** | Blend normalized scores | Several models are all valid and complementary |
| **Feature augmentation** | One model's output is a feature of the next | Content signal should sharpen a collaborative score |
| **Cascade** | Coarse model generates candidates, fine model re-ranks | Large catalogs; latency budgets |
| **Mixed** | Present several models' lists side by side, labelled | Distinct shelves ("because you viewed", "trending") |

## Normalize before blending — always

Blending a 1–5 predicted rating with an association-rule lift of 9.7 is meaningless: the lift wins
every time, for no reason but its scale. Min-max normalize each model's scores **within the
candidate pool** first. `recommend_hybrid` does this internally; any hand-rolled blend must too.

## Choosing weights

Start from what each model is good at, not from equal weights: latent factors carry the most
signal where history exists, content carries cold start, association rules carry basket context.
Then tune against the offline evaluation — and confirm online, because offline metrics favour the
policy that generated the log.

## Cascade for latency

On a large catalog, scoring every item with the expensive model is not feasible inside a page
render. Generate a few hundred candidates with a cheap model (popularity, content, neighbourhood),
then apply the expensive model and the re-ranker to that pool only. Candidate generation caps
achievable recall — if the cheap stage drops an item, no downstream stage recovers it.

## Failure mode

A hybrid can be worse than its best component when a weak model is given weight it has not earned.
Always evaluate the hybrid against each component separately, and drop components that add nothing.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — hybrid recommenders.
