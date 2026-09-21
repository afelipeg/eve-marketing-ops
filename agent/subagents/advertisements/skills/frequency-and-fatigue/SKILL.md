---
description: Use when setting frequency caps or diagnosing declining response within a flight — modeling the response-versus-frequency curve, cross-exchange deduplication, and treating frequency as a budget rather than a setting.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — exposure effects and campaign delivery"
---

# Frequency and fatigue

## Frequency is a budget, not a setting

Every additional impression on the same user costs money and returns less than the one before.
The response-versus-frequency curve rises, flattens, then turns negative as irritation accumulates.
`omega` decays past a soft cap for exactly this reason, so the bid falls automatically rather than
requiring a separate hard rule.

## Finding the cap

Read conversion rate by impressions-served bucket for the flight. Three shapes:

| Shape                        | Reading                                          | Action                          |
| ---------------------------- | ------------------------------------------------- | ------------------------------- |
| Rises then flattens at n     | Saturation at n                                   | Cap at n, reallocate to reach   |
| Rises then falls             | Fatigue past the peak                             | Cap at the peak                 |
| Flat throughout              | Frequency carries no information for this creative | Cap low, spend on reach        |

This is observational: the users who received many impressions are the heavy browsers. Treat the
curve as directional and confirm a cap change against a holdout through `measurement`.

## Deduplication

The same user reached through several exchanges, several devices, or several supply paths
experiences the sum, while each path reports its own compliant frequency. Deduplicate on the
identity you actually have, and report the **cap you can enforce**, not the one configured.

## Creative fatigue is not the same

Frequency fatigue is per-user exposure. Creative fatigue is a population-level decline as an
execution wears out. They have different fixes — cap versus rotate — and they are distinguished by
whether response falls for *new* users too. Check that before rotating a creative that was fine.

## Interaction with proximity

Loyal, high-phi users are where a high frequency accumulates fastest and buys least: they were
converting anyway. Cap hardest at the top of the proximity ladder, not at the bottom.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — exposure and delivery effects.
