---
description: Use when the slate must serve several objectives at once — relevance, margin, stock, strategic push, sponsorship — choosing between scalarization, constraints and Pareto methods, and reporting what relevance was traded away.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — multi-objective ranking and business constraints"
---

# Multi-objective optimization

## The objectives in a real slate

| Objective | Direction | Typical weight |
| --- | --- | --- |
| Relevance (predicted preference) | maximize | dominant |
| Margin per item | maximize | secondary |
| Stock cover | maximize (avoid pushing what runs out) | constraint-like |
| Popularity | **minimize** — the head needs no help | small |
| Sponsored placement | maximize, **capped** | small, declared |
| Strategic push (new launch) | maximize, time-boxed | campaign-specific |

## Three ways to combine

1. **Constraints** — encode as eligibility: never show stock cover < 0.5 weeks, never exceed 20%
   sponsored. Cheapest and most robust; use it wherever the objective is really a rule.
2. **Scalarization** — weighted sum of normalized criteria, or TOPSIS (see `topsis-algorithm`).
   Requires normalization or the largest-scale criterion silently wins.
3. **Pareto / lexicographic** — keep the non-dominated set, or optimize in priority order. Useful
   when weights cannot be agreed; harder to operate.

## Report the trade, always

`optimize_multi_objective` returns the accuracy-only slate beside the multi-objective one, with
overlap, mean margin, mean popularity and low-stock count. **State what relevance was given up.**
A margin-optimized slate that the customer ignores earns nothing — the margin was never realized,
only planned.

## Sponsorship discipline

Paid placement is capped, declared, and never silently ranked up. Beyond the cap, sponsored items
compete on the same criteria as everything else. A feed that quietly fills with paid items degrades
into an ad unit, and the engagement loss shows up later as a demand problem.

## The decision is not yours

Weights across objectives are a business decision. Produce the frontier and the cost of each
setting; the orchestrator chooses.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — balancing business objectives in ranking.
