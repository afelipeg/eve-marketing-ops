---
description: Use when quantifying how close a user is to the brand — building phi(u) from URL history, recency decay and contact depth, choosing weights, and deciding how proximity should change bidding and frequency.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — audience targeting and brand proximity in advertisements"
---

# Brand proximity

## Definition

```
phi(u) = ( w_a·affinity + w_r·2^(-days/halflife) + w_d·min(1, views/sat) + w_c·priorConversion ) / Σw
```

Bounded to [0,1] and returned with components, so a phi driven entirely by one stale brand visit is
visible rather than hidden in a single number.

## Reading the bands

| Band     | phi      | What it means                        | Usual posture                                  |
| -------- | -------- | ------------------------------------- | ----------------------------------------------- |
| cold     | <0.20    | No relationship                       | Prospecting; expect low psi, bid the ceiling    |
| aware    | 0.20–0.45| Category interest, little brand contact | The growth pool                                |
| engaged  | 0.45–0.70| Active brand contact                  | Highest psi; watch frequency                    |
| loyal    | ≥0.70    | Repeat, recent                        | Cap hard — mostly converting anyway             |

## The trap

Proximity and **incrementality move in opposite directions**. The loyal band has the highest
conversion rate and frequently the lowest incremental value: those conversions were coming without
the impression. A bidder that ranks on phi alone becomes an expensive retargeting machine that
buys its own existing demand.

Use phi as an *input to psi* and as a *frequency policy*, not as the bid ranking. Whether
retargeting is incremental is a holdout question — hand it to `measurement`.

## Signal hygiene

- **Recency decay** must match the category's purchase cycle. A 21-day half-life on a
  twice-a-year purchase discards everything useful.
- **Affinity from URL history** is topical, not intentional: reading about travel is not booking.
- **Cross-device identity** inflates or fragments phi depending on the match method. State which.
- **Privacy constraints** (consent, cookie loss, ATT) shrink the profiled pool. Report phi coverage
  — the share of requests with any profile — beside phi itself.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — audience construction for advertisements.
