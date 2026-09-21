---
description: Use when designing value tiers or a loyalty ladder — setting tier boundaries, choosing tier-appropriate offer types and depths, and avoiding tier inflation and the discount trap at the top.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — customer value tiers and differentiated treatment"
---

# Tiered segmentation

## Tiers

`segment_rfm` assigns platinum / gold / silver / bronze from frequency × monetary value. Tiers
answer "how much treatment does this customer justify", not "will this customer respond".

| Tier     | Share of base (typical) | Treatment posture                                     |
| -------- | ----------------------- | ------------------------------------------------------ |
| platinum | 5–15%                   | Service, access, early availability — **not depth**    |
| gold     | 15–25%                  | Value-add bundles, low-depth threshold offers          |
| silver   | 25–35%                  | Uplift-targeted offers, medium depth                   |
| bronze   | remainder               | Low-cost reach, reactivation, no premium inventory     |

## Setting boundaries

Set boundaries on the **value distribution**, not on round percentages, and re-cut them at a fixed
cadence, not continuously — a tier that moves every week cannot be communicated to the customer or
measured.

Report the concentration: if platinum is 8% of customers and 45% of margin, that number drives the
whole treatment design.

## Two failure modes

1. **Tier inflation.** Boundaries loosened to grow the top tier turn a status signal into noise and
   raise servicing cost with no incremental margin.
2. **Discounting the top tier.** The most frequent buyers are the most likely sure things. A
   platinum coupon is usually a margin transfer. If the top tier needs a promotion, the question is
   a retention question — score savability, not status.

## Interaction with uplift

Tier sets the *budget per customer*; uplift sets *whether to contact at all*. A platinum sleeping
dog is still suppressed. Never let tier override suppression.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — differentiated customer treatment.
