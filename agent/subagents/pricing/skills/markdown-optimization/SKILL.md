---
description: Use when stock must clear by a deadline — the markdown dynamic program, ladder design, timing, and reading whether a markdown problem is really a buying problem.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — markdown optimization"
---

# Markdown optimization

## The dynamic program

```
V(t, i) = max_p  E_d[ min(d, i)·p + V(t+1, i − min(d, i)) ]
V(T, i) = i · salvage
```

The cost of holding a unit is **the price you could have got for it earlier**, not its carrying
cost. That is the whole problem: discount too early and you sell at a discount what would have sold
at full price; too late and you salvage.

## Ladder design

Four or five rungs is typical (0%, −15%, −30%, −45%, −60%). Two considerations:

- **Monotone markdowns** — prices only fall. Standard retail policy, and the DP is constrained to
  it by default; raising a marked-down price destroys trust and usually breaks the promise made at
  the shelf.
- **Rung spacing** — steps too small do not move demand enough to matter; steps too large
  overshoot and give away margin on units that would have moved at the rung above.

## Read the clearance ratio first

```
clearance ratio = (demand at full price × periods) / inventory
```

- **≥ 1.2** — stock clears at full price. There is no markdown problem, and a discount is pure
  giveaway.
- **0.35 – 1.2** — a real markdown problem; the DP trades price against leftover risk.
- **< 0.35** — even the whole horizon at the bottom rung cannot clear it. The DP will go straight
  to the floor, but the finding is upstream: this was a buying or forecasting error, and saying so
  is more useful than the schedule.

## Costs outside the horizon

Repeated, predictable markdowns train customers to wait, moving full-price demand into the sale
period next season. The DP cannot see that, so name it whenever a markdown cadence becomes routine.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — markdown and clearance pricing.
