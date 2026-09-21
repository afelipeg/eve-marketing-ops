---
description: Use when decomposing a revenue or margin change — separating price, volume and mix effects, setting the threshold beyond which a result is price-carried, and reading the sustainability of a gain.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — performance decomposition in pricing"
---

# Price / volume / mix

## The decomposition

```
Δrevenue ≈ volume effect + price effect + mix effect

volume effect = Σ (q₁ − q₀) · p₀
price effect  = Σ q₀ · (p₁ − p₀)
mix effect    = residual — the shift in composition between SKUs at different prices
```

`analyze_cannibalization` returns all three, plus the price share of the total absolute change.

## Why the split decides how to read a result

| Carried by | Means | Repeatable? |
| --- | --- | --- |
| **Volume** | More units at the same price — real demand growth | Yes |
| **Price** | Same units, higher price — extraction, or inflation pass-through | Only until the elasticity bites |
| **Mix** | Composition moved toward higher-priced items — could be premiumization, or a stockout on the cheap line | Depends which |

A quarter where margin is up and the price effect is 80% of the change is not a demand result. It
does not repeat, and it usually borrows from the next period through volume decline.

## The threshold

Flag when the price lever carries more than ~60% of the change. That is not a rule about what is
allowed — it is a rule about what may be **claimed**. Above it, the honest statement is "this was a
price-carried quarter", and the volume trend underneath it is what actually needs attention.

## Mix is the one that fools people

A mix gain from customers trading up is durable. A mix gain because the value line was out of stock
is a supply failure wearing a margin-improvement costume. Always check whether the mix shift was
chosen by customers or forced by availability.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — decomposition of pricing performance.
