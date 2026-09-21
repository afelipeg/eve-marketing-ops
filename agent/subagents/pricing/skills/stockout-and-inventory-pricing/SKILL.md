---
description: Use when stock is the binding constraint — pricing into scarcity, the shadow price of inventory, censored demand, and telling a pricing problem apart from a supply problem.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — inventory-aware pricing"
---

# Stockout and inventory pricing

## The rule

**Scarcity is a reason to raise price, not to discount.** When expected demand over the remaining
horizon exceeds stock, a discount sells the same units for less and leaves demand unserved. This is
the mirror image of the markdown case, and it uses the same shadow-price logic.

```
shadow price of a unit = margin it would earn in its best alternative use
```

Scarce stock has a high shadow price, which raises the price that clears the horizon.
`price_under_scarcity` reports, for each price, the horizon demand, expected units sold, leftover,
stockout risk and unmet demand.

## Censored demand

A stockout does not only cost the sale. It **corrupts the data**: observed units were capped by
supply, so every later elasticity estimate that keeps those weeks reads the SKU as less
price-sensitive than it is. In the sample data, keeping stockout weeks moves a true −2.44 to −0.69.

Two consequences:
1. Exclude stockout weeks from demand estimation (`estimate_demand` does by default).
2. Log the stockout flag at the SKU-week level, or the bias cannot be removed later at all.

## Three inventory situations, three answers

| Situation | Signal | Action |
| --- | --- | --- |
| **Scarce** | Weeks of cover < ~2 | Price up; suspend promotion; do not feature |
| **Will expire** | Cover > shelf life | Markdown DP now, not in the final week |
| **Overstocked, non-perishable** | Cover > ~12 weeks | Markdown is *one* option; check cannibalization and price-integrity cost first |

## Pricing problem or supply problem

If scarcity is chronic rather than seasonal, price is the wrong instrument: the answer is supply,
and pricing up merely rations. Say which one it is. Likewise, stock that cannot clear at any rung of
the ladder is a buying or forecasting failure, and the markdown schedule is treatment, not
diagnosis.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — inventory-aware and scarcity pricing.
