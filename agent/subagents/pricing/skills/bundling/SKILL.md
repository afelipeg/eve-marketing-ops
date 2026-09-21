---
description: Use when pricing items together — pure versus mixed bundling, why WTP correlation decides the gain, cannibalization of components, and communicating a bundle at shelf.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — bundling and product-line pricing"
---

# Bundling

## Why it works, when it works

Bundling aggregates willingness to pay. If WTP across items is **negatively correlated** — the
customer who values A highly values B less — total WTP has lower variance than the individual
WTPs, so one bundle price captures a much larger share of the population than separate prices can.

As correlation rises toward +1, the gain collapses: the bundle discounts to customers who would
have bought both anyway.

`design_bundle_or_tariff` reports the realized WTP correlation beside the margin comparison, so the
mechanism is visible rather than assumed.

## Pure versus mixed

| | Pure bundle | Mixed bundle |
| --- | --- | --- |
| Offer | Only the bundle | Bundle **and** components |
| Captures | Bundle buyers | Bundle buyers **and** single-item buyers |
| Usually | Dominated | Dominant in practice |
| Cost | Loses single-item demand | Harder to communicate; needs a price gap that holds |

Mixed bundling normally wins because it keeps the customer who wants one item at a price they will
pay. The exception is when the components are strategically inseparable.

## Cannibalization inside the bundle

A bundle priced below the sum of the components is a discount to everyone who would have bought the
set. Check:

- the gap between bundle price and component sum — that is the discount being given;
- whether the bundle undercuts a single component's standalone price, which destroys that component's
  price integrity;
- whether the bundle simply moves volume from a higher-margin component to a lower-margin one.

## At shelf

A bundle that requires arithmetic to evaluate does not convert. State the saving in the customer's
terms, keep the component prices visible, and keep the structure stable long enough for shoppers to
learn it.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — bundling.
