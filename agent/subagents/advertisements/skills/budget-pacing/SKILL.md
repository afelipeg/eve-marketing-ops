---
description: Use when spend is ahead of or behind plan — choosing a pacing method, setting the bid multiplier, handling dayparting and end-of-flight underspend, and avoiding the classic fix that buys the worst inventory of the day.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — budget allocation and delivery control in advertisements"
---

# Budget pacing

## The control

```
gap    = elapsed share of flight - spend share of budget
factor = clip( 1 + aggressiveness · 2 · gap , [0.1, 2] )
```

Applied as a multiplier on every bid. `simulate_auction` mode `pacing` returns it with the state
(ahead / on_pace / behind).

## Even pacing versus performance pacing

- **Even pacing** spends proportionally to elapsed time. Predictable, protects against exhausting
  budget on the cheapest hours, and is the right default for brand flights with fixed windows.
- **Performance pacing** spends where CPA is lowest and lets delivery be uneven. Better CPA,
  but concentrates delivery into a few hours or a few publishers — check the frequency and supply
  concentration it produces before adopting it.

## The underspend trap

Raising the multiplier to chase an underspend buys the **marginal inventory of the day**: what
nobody else bid on, late in the flight, at a price set by your own desperation. It converts an
underspend into a worse CPA and calls it delivery.

Preference order when behind pace:

1. **Widen targeting** — add the next look-alike tranche, relax an over-tight frequency cap.
2. **Open supply** — add placements or formats that still clear the omega floor.
3. **Raise the ceiling** only where the value ceiling still supports it.
4. **Under-deliver** and report it. An unspent budget is a smaller loss than a CPA doubled.

## Dayparting and seasonality

Response varies by hour and day; so does competition. Pace against a *forecast* delivery curve, not
a flat line, where the data supports one. Say when it does not.

## End of flight

Never dump the remaining budget in the last hours. Report the projected underspend early enough for
the orchestrator to reallocate it to another service — that decision belongs to the planner, not to
the bidder.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — budget and delivery control.
