---
description: Use when a campaign spans several stages across the purchase journey — mapping stages to ZMOT, FMOT and SMOT, setting per-stage objectives and retargeting conditions, and keeping the whole sequence measurable.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — multi-stage campaign design and sequencing"
---

# Multi-stage campaigns

## The three moments

| Moment   | Where                                    | What the promotion must do                      | Stage metric              |
| -------- | ----------------------------------------- | ------------------------------------------------ | ------------------------- |
| **ZMOT** | Pre-store research: search, reviews, social | Enter the consideration set before the trip     | reach, qualified traffic  |
| **FMOT** | The shelf or the product page             | Win the choice at the moment of decision        | conversion, units, AOV    |
| **SMOT** | Use and post-purchase                     | Convert the trial into repeat and advocacy      | repeat rate, retention    |

A single-stage coupon assumes the customer is already at FMOT. For anyone earlier in the journey
that spend is wasted, which is exactly what a stage-blind campaign cannot see.

## Designing the sequence

1. **Stage objectives.** Each stage gets its own objective and metric. Do not measure a ZMOT stage
   on purchase rate — it is not what that stage does.
2. **Retargeting conditions.** Each stage after the first runs with `retargetingOnly`, keyed to
   exposure or response at the previous stage. State the eligibility rule explicitly.
3. **Offer escalation.** Start with the cheapest instrument that can do the job. Escalate depth
   only for customers who did not move — never as the opening offer.
4. **Suppression carries forward.** A sleeping dog at stage one is suppressed for the whole
   sequence. A converter at stage two is removed from stage three, or the campaign pays twice.
5. **Caps apply across the sequence**, not per stage. Three stages at "two contacts each" is six
   contacts, which is fatigue.

## Keeping it measurable

Hold the **same** customers in holdout across every stage. Rotating the control per stage destroys
the sequence read, because the stage-three control has already seen stages one and two.

Report both:
- **per-stage uplift** — what each stage contributed, and
- **sequence uplift** — treated-through-the-whole-sequence versus never-treated.

Hand both designs to `measurement` through `prepare_measurement_handoff`; the per-stage read is
frequently underpowered even when the sequence read is not.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — multi-stage campaign structures.
