---
description: Use when expanding an audience from a seed group — building and validating a look-alike model, sizing the expansion, and avoiding the mistake of treating similarity as uplift.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — audience expansion and targeting in advertisements and promotions"
---

# Look-alike modeling

## Method

`build_lookalike_audience` fits a classifier separating the seed group from the rest of the base,
then ranks non-seed customers by predicted similarity. Seeds come from an explicit id list or a
rule (high value, recent buyers of a brand, converters of a prior stage).

## Seed hygiene

- **Minimum 30 seeds**, and realistically a few hundred before the ranking is stable.
- Seeds must share the trait you want to expand — "everyone who bought last quarter" is not a seed,
  it is the base.
- Remove seeds that are outliers on value: the model will chase them and return a tiny audience.
- Seeds built from a previous campaign's responders carry that campaign's targeting bias into the
  expansion.

## Validation

Read the **separability AUC**:

- ≥0.75 — the seed is distinctive; the ranking is meaningful.
- 0.60–0.75 — the head of the audience is meaningful, the tail is close to random.
- <0.60 — the seed is not separable from the base; the "look-alike audience" is a random sample and
  must be reported as one.

Then read the profile comparison: if the audience's feature means drift far from the seed's, the
expansion has already left the neighbourhood — cut it shorter.

## Sizing

Expansion widens reach and dilutes similarity monotonically. Choose the size from the economics,
not from a percentage convention: score the resulting audience with `score_uplift` and let
`optimize_targeting_depth` find the cut.

## The rule that is broken most often

**Similarity is not uplift.** A look-alike audience resembles people who bought; it does not
identify people the offer would move. Always score the expansion for uplift before contacting it.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — audience construction and targeting.
