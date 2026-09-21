---
description: Use when mining basket co-occurrence for cross-sell — support, confidence, lift and leverage, Apriori pruning, and why confidence alone rediscovers the best-seller list.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — association rules and market-basket analysis"
---

# Association rules

## The four numbers

```
support(A→B)    = P(A ∧ B)              how often the rule applies
confidence(A→B) = P(B | A)              how reliable it is when it applies
lift(A→B)       = confidence / P(B)     how much A actually changes B
leverage(A→B)   = P(A∧B) - P(A)P(B)     absolute excess co-occurrence
```

**Lift is the one that matters.** A rule with 80% confidence and lift 1.0 says B is bought by 80%
of everyone — it has discovered a best-seller, not a relationship. `mine_association_rules` drops
lift ≤ 1 by default.

Leverage is the useful tiebreak: lift can be huge on a rule that fires twice.

## Thresholds

- **Support** too high → only best-sellers survive; too low → thousands of coincidences.
- **Confidence** controls precision of the suggestion.
- **Antecedent size**: pairs are cheap and interpretable; triples multiply the search space and
  almost always need lower support. Apriori pruning (only items that individually clear support can
  appear in a larger set) is what keeps this tractable.

## What a rule is not

A rule is **co-occurrence, not causation**. "Customers who bought A also bought B" does not mean
recommending B to an A-buyer causes a sale. Two common artifacts:

- **Promotion artifacts** — both items were on the same endcap last month.
- **Substitutes mistaken for complements** — high co-occurrence across baskets, never in the same
  basket, means the shopper alternates. Recommending one to a buyer of the other cannibalizes.

Re-mine on a rolling window, and check whether a high-lift rule survives outside the promotion
period that created it.

## Where rules fit

They are strongest as a **basket-context signal** on the PDP and in cart, where the antecedent is
present right now. In a cold home feed they have no antecedent to fire on.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — market-basket analysis.
