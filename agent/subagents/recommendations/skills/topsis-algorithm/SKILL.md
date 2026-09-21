---
description: Use when running TOPSIS specifically — the normalization, weighting, ideal and anti-ideal construction, closeness coefficient, and the failure modes (rank reversal, scale sensitivity, correlated criteria).
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — multi-criteria decision methods in ranking"
---

# TOPSIS

**Technique for Order of Preference by Similarity to Ideal Solution.** Rank alternatives by being
simultaneously close to the best achievable profile and far from the worst.

## The procedure

1. **Decision matrix** — alternatives × criteria.
2. **Vector normalization** — divide each column by its Euclidean norm, so criteria on different
   scales (rating 1–5, margin in currency, weeks of stock) become comparable.
3. **Weighting** — multiply each normalized column by its weight; weights are normalized to sum
   to 1.
4. **Ideal best / anti-ideal** — per criterion, the max for a benefit criterion and the min for a
   cost criterion, and vice versa.
5. **Distances** — Euclidean distance of each alternative to both.
6. **Closeness** — `C = d_worst / (d_best + d_worst)`, in [0,1]. Rank descending.

## Why it suits a slate

It handles benefit and cost criteria in one pass — which is how popularity enters as something to
*minimize* — and returns a bounded, interpretable score rather than an arbitrary weighted sum.

## Failure modes to guard

- **Rank reversal.** Adding or removing an alternative changes the ideal points and can reorder the
  rest. So score a **stable candidate pool**, not a pool that changes per request, when consistency
  across a session matters.
- **Scale sensitivity.** Vector normalization is not scale-free for all inputs: a criterion with
  extreme outliers dominates its column norm. Winsorize obvious outliers first.
- **Correlated criteria double-count.** Margin and price are usually correlated; including both at
  full weight weights price twice. Check correlation before assigning weights.
- **Weights are the real model.** The arithmetic is mechanical; every judgement lives in the
  weights. Report them with the ranking, always.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — multi-criteria ranking.
