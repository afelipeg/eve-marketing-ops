---
description: Use when the same user should get different recommendations depending on situation — channel, occasion, season, time, location, device and cash-flow band — and when to filter versus model the context.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — context-aware recommendation"
---

# Contextual recommendations

## Context is not a feature you sprinkle on

The same user wants different things on a Tuesday restock trip and in a gifting week. Three ways to
handle it, in increasing cost:

1. **Pre-filtering** — remove ineligible items before scoring (out of stock, wrong price band,
   wrong occasion). Cheap, exact, and where most value is. This is what `recommend_hybrid` does.
2. **Post-filtering** — score first, then adjust or drop by context. Useful when context is soft.
3. **Contextual modeling** — context enters the model itself (tensor factorization, context as
   features). Most powerful, most data-hungry; only worth it when context genuinely reverses
   preference rather than restricting the set.

## The contexts that matter here

| Context | Effect on the slate |
| --- | --- |
| **Channel** | Email is chosen days before it is seen: require deeper stock. PDP is seed-item driven. Mobile slates are shorter — diversity matters more per slot. |
| **Occasion** | Gifting inverts the price band; restock favours what they already buy; party favours multipacks. |
| **Cash-flow band** | A recommendation above the affordable band is wrong at any predicted rating. |
| **Season** | Seasonality flags gate eligibility; a seasonal item out of season is noise. |
| **Time of day / day of week** | Weak in most catalogs. Check before modeling it. |
| **Location** | Availability and assortment differ by territory — filter, do not model. |

## Rule of thumb

If context changes **what is eligible**, filter. If context changes **what is preferred among
eligible items**, model it. Most teams model what they should have filtered, and then wonder why
the model spends its capacity learning stock rules.

## Honesty about context

State the context in the report. A slate that looks strange is usually a slate that was filtered
correctly — "only 12 items survived the low cash-flow band in this territory" is a finding about
assortment, and belongs upstream.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — context-aware recommendation.
