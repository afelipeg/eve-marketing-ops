---
description: Use when pricing supply quality — building omega_a(u,i) from viewability, invalid traffic, brand safety, position, placement fit and frequency, setting exclusion floors, and choosing the omega_bar normalizer.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — inventory quality and exchange supply"
---

# Inventory quality scoring

## The score

```
omega = viewability × (1 - fraud)^2 × brandSafety × e^(-λ(position-1)) × placementFit × frequencyDecay
```

Multiplicative, because these are **independent ways for the impression to be worth nothing**. An
unviewable impression on safe premium inventory is still worth nothing; an addition would hide that.

The fraud term is squared by default: invalid traffic is penalized harder than its raw probability,
because its cost is not only the wasted impression but the corrupted training data it feeds back
into psi.

## omega_bar

The normalizer is the **mean quality of the inventory currently biddable**, not a constant and not
a historical average. `s2 = (omega/omega_bar)^β` is therefore a relative judgement: this impression
against the realistic alternatives right now. Recompute it whenever the supply mix changes — a
stale omega_bar rescales every bid.

## Exclude, do not discount

Below an omega floor (0.10 by default), exclude the publisher. Bidding a low price on invalid
traffic is still buying invalid traffic: it spends budget, corrupts the response model, and
contributes nothing to the conversion count.

Keep an explicit exclusion list, and report what it removed — supply-path decisions are a material
part of CPA and should never be invisible.

## Supply path

Prefer the shortest path to the publisher. Every reseller hop adds fee, latency, and duplication of
the same impression across exchanges (which inflates apparent reach and the frequency the user
actually experiences). Where the same impression is available through several paths, dedupe and bid
once.

## What omega is not

It is not a response estimate. High-quality inventory with no audience fit still has low psi, and
the bid must reflect both. Keep them separate: psi answers "will this user respond", omega answers
"is this impression real, visible and safe".

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — inventory quality in ad exchanges.
