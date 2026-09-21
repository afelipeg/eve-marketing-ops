---
description: Use when a slate is accurate but useless — defining and measuring diversity, novelty, serendipity and coverage, and applying MMR, popularity penalties and category caps with the cost stated.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — beyond-accuracy objectives in recommendation"
---

# Diversity, novelty, serendipity

## Four distinct things

| Property | Definition | Measured by |
| --- | --- | --- |
| **Diversity** | The items differ from each other | 1 − mean pairwise similarity (intra-list) |
| **Novelty** | The user has not seen this before | Mean −log₂(popularity share) |
| **Serendipity** | Relevant **and** unexpected | Hits not on the popularity baseline |
| **Coverage** | The catalog is reachable at all | Distinct items recommended ÷ catalog |

A slate of ten near-identical best-sellers can score perfectly on accuracy and fail all four.

## Why accuracy alone collapses

The most-rated items are the easiest to predict well, so an accuracy-optimal ranking is
approximately a popularity ranking. Nothing in precision@k penalizes recommending what the customer
would have bought anyway — which is also why an accurate recommender can show no incremental value
when it finally gets measured.

## The three levers

1. **Popularity penalty**, applied on a *normalized* score scale. A penalty of 0.3 against raw 1–5
   predicted ratings is nearly inert; against a normalized score it removes 30% of the range.
2. **MMR**: greedily pick `λ·relevance − (1−λ)·max similarity to what is already selected`.
   λ = 0.7 is a reasonable start; lower buys diversity with relevance.
3. **Category caps**: no category owns the slate. Blunt, cheap, effective on visibly repetitive
   feeds.

Apply them in that order — penalty, MMR, cap — and re-rank from a pool several times the slate
size, or there is nothing to diversify *into*.

## State the cost

`rerank_for_diversity` reports before/after intra-list diversity, novelty, mean popularity,
category spread, and slate economics. Diversity is bought with relevance. Whether the trade pays is
an **online** question — offline metrics are biased against exactly the exploration you are adding.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — diversity and beyond-accuracy objectives.
