---
description: Use when recommending from behaviour patterns across users — item-based versus user-based neighborhoods, adjusted cosine similarity, support shrinkage, and the sparsity and popularity limits of neighborhood methods.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — collaborative filtering, neighborhood methods"
---

# Collaborative filtering

## Item-based first

| | Item-based | User-based |
| --- | --- | --- |
| Stability | Item-item similarity changes slowly | User tastes and sessions churn |
| Precompute | Yes, offline | Harder; users arrive continuously |
| Explanation | "Because you rated X" | "Users like you" — vaguer, less trusted |
| Scale | Items ≪ users in most catalogs | Similarity matrix grows with users |

Use user-based when the catalog is much larger than the user base, or when discovering a *group*
taste is the point.

## Adjusted cosine, not plain cosine

Plain cosine treats "this user rates everything 5" as agreement. Adjusted cosine centres each
rating on the **rating user's** mean before the cosine, removing that bias. Pearson centres on the
item's mean instead — use it when item popularity effects dominate.

## Support shrinkage

Two items co-rated by three users can show similarity 0.99 by accident. Shrink toward zero by
co-rating support:

```
sim_shrunk = ( support / (support + shrinkage) ) · sim_raw
```

Without shrinkage the neighbour lists fill with coincidences from the catalog tail.

## Known limits

- **Sparsity** — below roughly 1% density, most item pairs have no co-ratings and neighbourhoods
  are empty. Check `get_rating_matrix` before choosing this family.
- **Cold start** — a new item has no co-ratings and can never be recommended. Content filtering
  covers it.
- **Popularity bias** — items with more ratings have more reliable similarities, so they dominate
  neighbour lists. Always re-rank.
- **Grey sheep** — users whose taste correlates with nobody get poor recommendations from this
  family regardless of tuning.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — neighborhood collaborative filtering.
