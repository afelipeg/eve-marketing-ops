---
description: Use when choosing prices across a portfolio under shared constraints — formulating the selection problem, solving the LP relaxation, reading binding constraints and shadow prices, and reporting the rounding gap honestly.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — constrained optimization in pricing"
---

# LP and discrete optimization

## The formulation

Choosing one price point per SKU from a ladder is an assignment problem:

```
maximize   Σ_i Σ_k  margin(i, k) · x_ik
subject to Σ_k x_ik = 1                 for every SKU i   (exactly one price)
           Σ_i Σ_k index(i,k) · x_ik <= cap                (price index vs competition)
           Σ_i Σ_k margin(i,k) · x_ik >= floor             (margin floor)
           x_ik ∈ {0,1}
```

The integer problem is large; the **LP relaxation** (`0 <= x_ik <= 1`) is solved instead and then
rounded.

## What the relaxation is, and is not

- It is an **upper bound** on the integer optimum. Never present the relaxed objective as
  achievable.
- Assignment-structured problems frequently return integral vertices anyway, in which case the
  rounding is exact and the gap is zero.
- When it does not, `solve_price_lp` names the fractional SKUs — the ones the LP wanted to split
  between two price points — and reports the **optimality gap** the rounding costs.

## Binding constraints are the useful output

The binding set says what is actually limiting margin. A plan that is 3% below an unconstrained
optimum because of a price-index cap is a finding about the index policy, not about pricing. Shadow
prices say how much relaxing each constraint would be worth — that is the conversation to have with
the orchestrator.

## Infeasibility is information

When constraints conflict, the solver says infeasible rather than returning a compromise. Report
which constraint was relaxed to restore feasibility; never quietly drop one.

## The limit

The objective is only as good as the demand estimate behind each price point, and those confidence
intervals do not appear in the LP. A tight optimum can sit well inside the noise — check the
sensitivity before treating a 0.5% margin gain as real.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — optimization under business constraints.
