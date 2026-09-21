---
description: Use when price should change over time — the conditions that justify dynamic pricing, the state variables, learning versus exploiting, and the reference-price cost of moving prices often.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — dynamic pricing"
---

# Dynamic pricing

## When it is justified

Dynamic pricing pays when at least one is true:

- **Perishable capacity** — unsold units are worth salvage or nothing (seasonal stock, event
  seats, delivery slots).
- **Demand varies predictably** over the horizon (seasonality, day-part).
- **Willingness to pay varies over time** for the same unit (advance purchase vs last-minute).
- **Competitor prices move frequently** and the category is price-transparent.

Absent these, a stable price is usually better: it costs nothing to operate and does not damage
price perception.

## State variables

The price depends on where you are, not only on the demand curve:

```
state = (time remaining, inventory remaining, demand-so-far, competitor position)
```

The shadow price of one unit of inventory rises as stock becomes scarce relative to remaining
demand and falls as the horizon closes with stock left. That is why the same demand curve implies
a rising price under scarcity (`price_under_scarcity`) and a falling one under surplus
(`optimize_markdown`).

## Learning versus exploiting

With an uncertain demand curve, every price is also an experiment. Deliberate price variation buys
the elasticity estimate that every later decision rests on — and it is the only clean
identification available. Budget for it explicitly rather than pricing from observational data
forever.

## The costs that do not appear in the horizon

- **Reference price.** Customers anchor on the last price seen. Frequent cuts lower the anchor and
  make the full price feel expensive.
- **Trained waiting.** Predictable markdown cadence moves full-price buyers to the sale.
- **Perceived unfairness.** Price changes tied to a person, rather than to the product or time,
  are the ones that generate complaints.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — dynamic pricing under finite capacity.
