---
description: Use when setting campaign budget, contact frequency, and audience depth — the send/do-not-send gate arithmetic, pressure rules, budget-constrained depth, and how caps interact across concurrent campaigns.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — budget allocation and contact policy in promotions"
---

# Budgeting and capping

## The gate

No campaign is sent unless:

```
Σ (uplift_i × margin_i)  >  Σ (cost_per_contact + P(buy|treated)_i × discount_value_i)
```

Both sides come from `optimize_targeting_depth`. When the gate fails, the answer is "do not send"
with the arithmetic shown — not a smaller version of the same offer sent anyway.

Three ways a failing campaign becomes a passing one, in order of preference:

1. **Narrow the audience** — remove the negative-net tail. Costs nothing.
2. **Reduce depth** — a 10% offer to persuadables often beats 25% to everyone.
3. **Change instrument** — threshold offer or value-add instead of a straight discount.

## Depth is an economic cut, not a number

Walk the ranked audience until marginal net value per contact reaches zero. Report the binding
constraint:

- **economics** — the natural cut; the campaign is correctly sized.
- **budget** — money ran out before value did. Flag the unfunded remainder: it is an ask, with an
  expected return attached.
- **audience-share** — a policy cap bound before economics did. Say whose policy it is.

## Pressure rules

| Rule                     | Default | Why                                               |
| ------------------------ | ------- | -------------------------------------------------- |
| max contacts / 30 days   | 2       | Fatigue converts persuadables into sleeping dogs   |
| min days between contacts| 7       | Prevents stacking from concurrent campaigns        |
| max audience share       | policy  | Protects the base from blanket promotion            |

Caps are applied as **hard conditions**, before scoring, so the reported audience is deliverable
rather than theoretical.

## Across concurrent campaigns

Caps are a property of the customer, not of the campaign. Two campaigns each respecting "two per
month" deliver four. When several campaigns run in the same window:

- apply caps against the customer's total contact history, which `optimize_targeting_depth` reads
  from the profile;
- give concurrent campaigns non-overlapping audiences where possible;
- when they must overlap, sequence them and declare which campaign owns the customer this period.

## Holdout is not a cost line

The holdout is not "lost revenue". It is the only mechanism that turns this spend into knowledge
for the next period. It is never cut to fund reach.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — budget allocation, contact policy, and
campaign economics.
