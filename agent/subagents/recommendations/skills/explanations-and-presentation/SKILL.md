---
description: Use when writing the customer-facing reason on a recommendation — matching the explanation to the model that produced it, honesty limits, position and slate framing, and what never to say.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — presentation and trust in recommendations"
---

# Explanations and presentation

## Match the explanation to the mechanism

| Source | Honest phrasing |
| --- | --- |
| Item-based CF | "Because you rated **X**" |
| Latent factors | "Customers with tastes like yours rate this highly" |
| Content | "Because you liked **X** — same category / attribute" |
| Association rule | "Frequently bought with **X**" (lift, not confidence) |
| Popularity | "Popular in the catalog right now" |
| Business rule | "Sponsored" or "New from **brand**" — labelled as such |

If the only true reason is popularity, **say popularity**. A fabricated personal reason on a
best-seller is the fastest way to lose trust in the whole surface, and it is a lie about how the
system works.

## Latent factors cannot be explained item-by-item

A factor is not a concept. "Because you rated X" on a latent-factor recommendation is a
post-hoc story unless X genuinely contributed. Either attribute the recommendation to a nearest
neighbour that actually drove it, or use the honest group phrasing.

## Presentation shapes the measurement

- **Position bias**: the top slot gets clicks regardless of quality. Slate comparisons must
  randomize position or use interleaving, or the winner is whatever sat on top.
- **Shelf framing**: labelled shelves ("because you viewed", "trending", "new") set expectations
  and make an unexpected item read as discovery instead of error — this is where serendipity is
  actually earned.
- **Slate length**: more slots dilute attention. On mobile, diversity per slot matters more than
  slate size.

## Never

- Never claim personalization the model did not do.
- Never hide sponsorship.
- Never explain with data the customer would be unsettled to learn you hold. Being *able* to
  explain a recommendation from sensitive inference is not a reason to say it out loud.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — presentation of recommendations.
