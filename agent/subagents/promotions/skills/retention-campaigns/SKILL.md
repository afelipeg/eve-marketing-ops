---
description: Use when the objective is retention or churn prevention — scoring on savability x LTV, timing the intervention against the hazard curve, choosing non-price instruments first, and avoiding paying customers who were never leaving.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — churn prevention and retention campaigns"
---

# Retention campaigns

## The score

```
retention score = savability × LTV
savability      = modeled retention uplift = P(stay | treated) - P(stay | control)
```

Not churn risk alone, and not LTV alone:

- **High risk, low savability** — they are leaving regardless. The spend buys nothing.
- **Low risk, high LTV** — the classic mistake. These are sure things; the offer is a margin
  transfer to customers who were staying.
- **High savability, high LTV** — the campaign.

`estimate_ltv_survival` returns all three components: churn probability, retention uplift,
value at risk. Report them side by side so a high score built on low risk is visible.

## Timing

Read the hazard curve. Intervene **before** the hazard spike, not after the customer has lapsed —
reactivation is a different, more expensive campaign with a different metric. If the hazard is
flat, timing carries no information and the audience should be chosen purely on savability × LTV.

## Instrument order

1. **Service and access** — delivery slot, support, replenishment reminder. No margin cost.
2. **Value-add** — bundle, sample, loyalty accrual.
3. **Threshold offer** — conditional on a basket that protects margin.
4. **Direct discount** — last, and only where savability justifies it.

Starting at step 4 teaches customers that lapsing is rewarded. That behaviour compounds across
periods and does not appear in this campaign's ROI.

## Measurement

Retention outcomes lag. State the window (90 days is common) and do not read at day 14 because the
numbers are available. Hold the control for the full window. Route the read to `measurement`.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — retention and churn-prevention campaigns.
