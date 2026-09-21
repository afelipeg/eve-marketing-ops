---
description: Use when building a descriptive segmentation of the base — RFM quintiles, segment definitions, and the boundary between describing customers and targeting them.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — customer segmentation for promotions"
---

# RFM segmentation

## Construction

`segment_rfm` scores every customer on quintiles of recency (inverted — recent is high), frequency,
and monetary margin per order, producing an RFM code and a behavioural segment.

| Segment            | Pattern           | Typical promotion posture                          |
| ------------------ | ----------------- | --------------------------------------------------- |
| champions          | R↑ F↑             | No discount. They are sure things.                  |
| loyal              | R↑ F↑ (mid)       | Value-add, not price cuts                           |
| new_or_promising   | R↑ F↓             | Second-purchase nudge; build the habit              |
| needs_attention    | mid/mid           | Uplift-score them: persuadables concentrate here    |
| at_risk            | R↓ F↑             | Retention, scored on savability × LTV               |
| hibernating        | R↓ F mid          | Cheap reactivation, low depth                       |
| lost               | R↓↓               | Usually lost causes; test before funding a campaign |

## Quintile mechanics

Quintiles are relative to the population scored. Two consequences that get missed:

1. Segment sizes shift when the population filter changes — a territory-level RFM is not comparable
   to a national one.
2. In a base where most customers bought once, frequency quintiles collapse. Check the distribution
   before reporting segment counts as meaningful.

## The boundary

RFM describes **who is valuable**. It does not describe **who is persuadable**. Champions look like
the best audience and are usually the worst promotional target: they buy anyway, so the discount is
pure margin loss.

Use RFM to frame the brief, choose offer types, and report audience composition. Use `score_uplift`
to choose who actually gets contacted.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — segmentation methods in promotions.
