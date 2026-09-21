---
description: Use when timing an offer to a consumption cycle — estimating the inter-purchase interval per customer and category, choosing the send window, and avoiding subsidizing a purchase that was already due.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — purchase cycle modeling and triggered campaigns"
---

# Replenishment campaigns

## Principle

Consumable categories have a cycle. The value of a replenishment campaign is **timing**, not
discount: reaching the customer when the pack is running out, before a competitor's shelf does.

## Estimating the cycle

Per customer and category, from `get_transaction_history`:

```
interval = median gap between purchases of that category
due date = last purchase + interval
```

Use the median, not the mean — one holiday stock-up distorts the average. Where a customer has
fewer than three purchases in the category, fall back to the category-level median and mark the
estimate as a category default, not a customer estimate.

## The send window

Target `due date − lead time`, where lead time is how long before running out the decision is made
(short for perishables, longer for bulk). Two errors, with different costs:

- **Too early** — subsidizes a purchase that was coming anyway, and shortens the cycle permanently
  by building a stockpile at home. This is pull-forward, not incremental volume.
- **Too late** — the customer has already bought, frequently from someone else.

Too early is the expensive error, because it looks like success in the response report.

## Depth

Replenishment should carry the **lowest depth of any campaign type**, often zero: a reminder at the
right moment is the intervention. If a reminder without a discount performs, the discount in the
version that "worked" was pure margin loss. Test that explicitly.

## Suppression

Suppress customers who bought the category since the estimate was computed, customers already at
the contact cap, and anyone whose cycle estimate rests on a single prior purchase.

## Measurement

The trap is a control group not matched on due date: a treated group at the due date and an
unmatched control will differ regardless of treatment. Randomize **within** the due-date cohort,
and say so in the handoff to `measurement`.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — purchase-cycle modeling and triggered
campaigns.
