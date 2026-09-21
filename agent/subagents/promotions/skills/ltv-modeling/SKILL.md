---
description: Use when valuing a customer over time — computing discounted lifetime value from survival and margin, deciding the horizon, and testing acquisition spend with LTV:CAC.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — customer lifetime value modeling"
---

# LTV modeling

## Formula in use

```
LTV = Σ_{t=1..H}  annual margin × S(tenure + t·365) / S(tenure)  ÷  (1 + r)^t
```

- **Margin, not revenue.** Revenue-based LTV overstates every decision that costs money.
- **Survival-weighted**, from the Kaplan-Meier curve — not a flat retention assumption.
- **Conditional on current tenure**: a customer who already survived a year is a different risk
  from a new one.
- **Discounted** at `r` (default 10% annual). Undiscounted LTV justifies spend it should not.

`estimate_ltv_survival` returns LTV, the per-year decomposition, and 12-month churn probability.

## Choosing the horizon

Three years is the default. Longer horizons inflate LTV with the least reliable part of the curve —
the tail, where the survival estimate rests on the fewest customers. If a decision only works at a
5-year horizon, say that explicitly: it is a statement about assumption sensitivity, not about the
customer.

## LTV:CAC

| Ratio | Reading                                                              |
| ----- | --------------------------------------------------------------------- |
| <1    | Destroying value — each acquisition costs more than its margin        |
| 1–3   | Thin but viable                                                       |
| 3–5   | Conventional healthy band                                             |
| >5    | Likely underinvesting in acquisition, or LTV is overstated            |

CAC must include the discount given at acquisition, not only media cost. A "cheap" acquisition on a
40% coupon is not cheap.

## Traps

- **Averaging LTV across mixed cohorts** hides the fact that the average is carried by a small tail.
  Report the distribution, or at least the median beside the mean.
- **Using LTV as a targeting score for retention.** The highest-LTV customers are often the least
  saveable — see `retention-campaigns` and score on savability × LTV.
- **Counting promoted margin as durable margin.** If the customer only buys on promotion, their
  LTV is the promoted margin, not the list-price margin.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — LTV modeling and its use in campaign
prioritization.
