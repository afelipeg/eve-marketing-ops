---
description: Use when expanding prospecting audiences from a seed — building look-alike scores from profile features, validating separability, sizing the expansion, and keeping similarity from being mistaken for response.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — audience expansion and prospecting in advertisements"
---

# Look-alike modeling

## Purpose in RTB

Retargeting exhausts quickly: the pool of users with high phi is small and mostly converting anyway.
Growth comes from **prospecting**, and a look-alike model is how a converter seed becomes a
biddable prospecting audience.

## Method

Fit a classifier separating seed users from the rest of the addressable pool on profile features
(category affinity, session intensity, device, geo, segments), then rank non-seed users by
predicted similarity.

## Seed hygiene

- **Seed on converters, not clickers.** A clicker seed expands the fraud footprint.
- Minimum ~30 seeds to fit, realistically several hundred to be stable.
- Remove outliers on value: the model chases them and returns a tiny audience.
- A seed built from a previous campaign's responders carries that campaign's targeting bias
  forward — state it.

## Validation

Read separability AUC: ≥0.75 distinctive, 0.60–0.75 head meaningful and tail near-random, <0.60 the
audience is effectively a random sample and must be reported as one.

Then compare feature means between seed and audience. When they diverge sharply, the expansion has
left the neighbourhood: cut it shorter.

## Sizing and bidding

Size from economics, not from a percentage convention. Expansion dilutes similarity monotonically,
so psi falls along the ranking — let `compute_bid` price that: the ceiling falls with psi, and the
tail stops clearing the floor by itself.

## The rule that is broken most often

**Similarity is not response, and response is not incrementality.** A look-alike audience resembles
converters; it does not identify users the advertising would move. Score it with the conversion
model, and test the prospecting layer against a holdout before scaling it.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — audience expansion for advertisements.
