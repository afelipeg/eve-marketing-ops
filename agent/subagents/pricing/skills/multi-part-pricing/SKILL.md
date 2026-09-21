---
description: Use when designing a fixed fee plus per-unit price, or a quantity-tier ladder — the theory, the participation trade-off with heterogeneous customers, and the churn and regulatory exposure of the fee.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — multi-part tariffs"
---

# Multi-part pricing

## The structure

```
total(q) = F + p · q
```

A fixed access fee plus a per-unit price. Also covers block tariffs, where the per-unit price steps
down across quantity tiers.

## The theory, and why it is not the answer

With one homogeneous customer type, the optimum is:

```
p = marginal cost,  F = the whole consumer surplus
```

Setting the per-unit price at cost maximizes the quantity consumed, and the fee extracts the value
created. **With heterogeneous customers this breaks**: a fee large enough to extract the heavy
user's surplus excludes the light user entirely.

So the real optimum trades **participation against extraction**, which is why
`design_bundle_or_tariff` solves it numerically over the (F, p) grid and reports which segments
still participate.

## Reading the result

- **Which segments opt out.** A fee that excludes a segment is a decision not to serve them. Say
  so explicitly; it is a strategy choice, not a rounding detail.
- **Per-unit price relative to cost.** Far above cost means the fee is doing too little work and
  usage is being suppressed. At or near cost means the structure is working as intended.
- **Tier design** in a block tariff: too many tiers confuse; tiers set where few customers sit
  collect nothing.

## Exposure

- **Churn.** A high fixed fee is the most visible line on the bill and the one customers cancel.
- **Regulation.** Access fees on essential services attract scrutiny, and in some markets caps.
- **Perceived fairness.** Customers accept paying for what they use more readily than paying for
  the right to use.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — multi-part tariffs and non-linear pricing.
