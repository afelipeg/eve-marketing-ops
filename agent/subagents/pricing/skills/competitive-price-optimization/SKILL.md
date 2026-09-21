---
description: Use when competitor prices drive the decision — building a price index, deciding where to match, reading competitive response into elasticity, and avoiding the race to the bottom.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — competitive effects in pricing"
---

# Competitive price optimization

## The index, and its limit

```
price index = our price / competitor price
```

An index is a **position**, not a decision. Matching a competitor on an inelastic SKU gives away
margin for volume that was never at risk; holding above on an elastic, transparent SKU loses volume
that was.

Decide match-versus-hold per SKU using three inputs together: own elasticity, cross-elasticity to
the competitor, and price transparency (how easily a shopper compares).

## Key value items

Shoppers form price perception from a small set of known-value items. The rational structure is:

- **KVIs** — price sharply, index at or below competition, accept thin margin.
- **The rest** — price on own elasticity and margin; perception is not formed here.

Getting this backwards — discounting the invisible tail while sitting high on KVIs — is a common
and expensive error.

## Competitive response contaminates elasticity

If a competitor systematically matches within days, the demand curve you estimate is the *post-response*
curve, and it looks more inelastic than the true own-price curve. Two implications:

1. Keep the competitor price in the demand model (`estimate_demand` does).
2. Expect the realized effect of a cut to be smaller than a naive single-firm elasticity predicts.

## The race to the bottom

Price-matching algorithms that react automatically to each other converge downward, fast. Guard it:

- Floor every automated rule at a margin floor, not at a price.
- Damp the response — match slowly, and not on promotional prices.
- Do not match a competitor's clearance of stock you are not clearing.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — competitive dynamics in price optimization.
