---
description: Use when allocating fixed perishable capacity across price classes — Littlewood's rule, EMSR-a and EMSR-b protection levels, nesting, and the forecast quality the whole method rests on.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — resource allocation and revenue management"
---

# Resource allocation (Littlewood, EMSR)

## The question

Capacity is fixed and perishable. A low-price request arrives now; a high-price request may arrive
later. Accept or protect?

## Littlewood's rule (two classes)

Accept the low fare while its certain revenue beats the expected revenue of holding the unit:

```
p_low >= p_high · P(D_high > y)
```

so the protection level is the critical fractile

```
y* = F_high^{-1}( 1 − p_low / p_high )
```

The ratio `1 − p_low/p_high` is the whole intuition: the smaller the discount, the less you protect.

## EMSR for many classes

- **EMSR-a** computes a pairwise protection against each higher class separately and **sums** them.
  Conservative: it protects more capacity than necessary and usually leaves revenue on the table.
- **EMSR-b** aggregates all higher classes into one demand distribution and protects against it at
  the **revenue-weighted average fare**. This is the standard production heuristic.

Limits are **nested**: the booking limit for a class is capacity minus everything protected above
it. Selling classes as independent buckets over-sells the cheap ones.

## Assumptions to check before quoting a protection level

- Normal, independent class demand — thin classes violate this.
- **No buy-down**: if a high-value customer will take the cheap class while it is open, the fences
  are not doing their job and protection must rise.
- No cancellation or recapture; with either, overbooking must be modeled alongside.
- **Forecast quality dominates everything.** A protection level computed on a biased forecast is
  precisely wrong. Report the forecast error beside it.

## Where this applies outside travel

Event seats, delivery and installation slots, limited editions, promotional allocation across
channels, and any fixed production run sold through several price tiers.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — capacity allocation under finite resources.
