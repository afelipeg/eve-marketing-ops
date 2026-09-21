---
description: Use when charging different prices to different segments — the three degrees of discrimination, designing fences that hold, stress-testing arbitrage, and the fairness limit.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — price differentiation and willingness to pay"
---

# Price differentiation

## The three degrees

1. **First degree** — a personal price per customer. Maximal extraction, maximal legal and
   reputational exposure. Rarely defensible in consumer markets.
2. **Second degree** — the customer **self-selects** by choosing a version, a pack size, a channel
   or a volume tier. This is where most sustainable value is.
3. **Third degree** — price by observable group (student, region, trade class). Requires the group
   to be verifiable and the distinction to be defensible.

## Fences decide whether it works

A fence is what stops a high-WTP customer taking the low price. Without one, everyone takes the
lowest fenced price and differentiation is just a discount.

| Fence | Example |
| --- | --- |
| Version / pack | Large pack at lower unit price; single-serve chilled at a premium |
| Channel | Wholesale vs e-commerce vs immediate consumption |
| Time | Weekday-only, off-peak, advance purchase |
| Effort | Coupon clipping, loyalty enrolment, rebate claim |
| Identity | Student or trade verification |

`design_price_differentiation` computes the margin **if the fences fail** and everyone buys at the
lowest fenced price. That gap is what the fences are worth, and what may be spent enforcing them.

## Warning signs

- **Spread above ~2x** invites arbitrage and resale, and makes the difference visible enough to
  become a fairness story.
- **A fence that costs the customer nothing to cross** is not a fence.
- **Segments that see each other's prices** — same shelf, same app — need the *version*, not the
  customer, to carry the difference.

## The limit

Differentiating on inferred ability to pay for an identical good is legally and reputationally
dangerous in several markets. Differentiate on what the customer chooses, not on what a model
believes about them. See `legal-and-fairness-constraints`.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — price differentiation.
