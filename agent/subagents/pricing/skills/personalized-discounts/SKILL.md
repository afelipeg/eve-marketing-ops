---
description: Use when targeting a discount at individuals rather than at the shelf — choosing who gets one on uplift rather than propensity, sizing the depth, and the fairness and gaming limits.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — personalized pricing and targeted promotions"
---

# Personalized discounts

## The targeting rule

A personalized discount is a promotion, not a price. Target it on **incremental** response, never
on likelihood to buy:

- Customers who would buy anyway (high propensity, zero uplift) turn the discount into pure margin
  loss.
- The value is in customers whose purchase decision the discount actually changes.

Whether a customer is persuadable belongs to the promotions service and its uplift model. Pricing
supplies the **economics**: the depth at which the discount still pays.

```
break-even uplift = discount depth / (contribution margin per unit)
```

A 20% discount on a 35% margin needs a >57% relative lift just to break even on the discounted
units — before counting the units that would have sold anyway.

## Sizing the depth

Depth should be the smallest that moves the decision. Start from the reservation gap (how far the
customer's WTP sits below the price), not from a round number. Escalate only for non-responders,
never as an opening offer.

## The hard limits

- **Price integrity.** Widely-issued personal discounts become the real price, and the shelf price
  becomes a fiction. Cap issuance share and monitor realized price, not list price.
- **Gaming.** Any rule customers can learn will be learned: abandoning carts, creating accounts,
  clearing cookies. Assume the rule leaks.
- **Fairness and law.** Charging different people different prices for an identical good on
  inferred ability to pay is the most exposed form of price discrimination. Prefer a *fenced*
  mechanic (coupon, loyalty tier, pack, channel) that the customer chooses to enter. See
  `legal-and-fairness-constraints`.

## Measurement

A personalized discount campaign without a randomized holdout has measured nothing. Route the read
through `measurement`.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — targeted promotions and personalized pricing.
