---
description: Use when auditing supply quality — detecting invalid traffic from the click-to-conversion signature, setting exclusion rather than discount policy, brand-safety adjacency, and stopping fraud from contaminating the response model.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — inventory quality, invalid traffic, and supply selection"
---

# Brand safety and fraud

## The signature

Invalid traffic has a characteristic pattern that no amount of platform reporting hides:

```
high CTR  +  near-zero conversion rate  +  low viewability  +  long-tail domain
```

Bots click; they do not buy. The diagnosis is the **click-to-conversion ratio by publisher**, not
the click rate. A publisher with twice the CTR and a tenth of the CVR is not "top of funnel", it is
invalid.

`score_inventory_quality` prices this in `(1 - fraud)^2`, and `score_ad_response` refuses to
recommend bidding on a click-trained model for the same reason.

## Exclude, do not discount

A discount on invalid traffic is still a purchase of invalid traffic. It spends budget, and worse,
it **feeds the response model**: the fake clicks and non-conversions become training rows, and the
model learns a distorted map of what response looks like. Exclusion is a data-integrity decision as
much as a budget one.

Keep the exclusion list explicit and reported. Supply-path decisions are a material part of CPA.

## Brand safety

Adjacency risk is separate from validity: a real, viewable impression next to unsuitable content is
a brand cost that does not appear in CPA at all. Score it, set a floor, and state that the floor is
a brand policy, not an optimization.

Keyword blocklists over-block news inventory and push spend into low-quality supply — a
well-documented own goal. Prefer category-level controls and report the reach cost of the policy.

## Verification signals worth having

Third-party viewability and IVT measurement, pre-bid segments, `ads.txt` / `sellers.json`
compliance, supply-path deduplication. Where these are absent, say that fraud estimates are
modeled rather than verified, and widen the discount accordingly.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — inventory quality and supply selection.
