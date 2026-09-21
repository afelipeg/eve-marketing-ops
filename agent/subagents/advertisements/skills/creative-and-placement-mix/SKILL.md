---
description: Use when choosing formats, placements, or rotating creatives — comparing display, video, search and native on incremental cost per conversion, testing creatives without contaminating the bid model, and diagnosing creative wear-out.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — creative and channel selection in advertisements"
---

# Creative and placement mix

## Compare on incremental cost, never on CTR

Formats have structurally different click behaviour and structurally different prices. Comparing
them on CTR or CPM ranks the format, not the value. The only comparable figure is **cost per
incremental conversion**, and where that is unavailable, CPA_a from `attribute_v_star` with its
limits stated.

| Placement | Typical role                        | Watch                                          |
| --------- | ------------------------------------ | ----------------------------------------------- |
| search    | Captures existing intent            | Usually the least incremental; brand terms most |
| display   | Reach and retargeting               | Viewability and fraud concentrate here          |
| video     | Attention, upper funnel             | Completion ≠ attention; expensive per impression |
| native    | In-feed, lower interruption         | Adjacency and disclosure requirements           |

Search on brand terms is the standard example of high measured ROAS and near-zero incrementality:
those users were arriving anyway. Flag it; the holdout settles it.

## Creative testing

Rotate creatives on a **randomized** split, not sequentially: a sequential comparison confounds
creative with day, competition, and pacing state. Hold the bid policy constant during the test, or
the comparison measures the bidder, not the creative.

Do not refit psi on a period where creatives were rotating unevenly — the model attributes creative
differences to the user features that happened to be present.

## Wear-out

Population-level response decline as an execution ages, distinct from per-user frequency fatigue.
The diagnostic is whether response falls for **new** users too:

- Falls for everyone → creative wear-out. Rotate.
- Falls only for repeatedly exposed users → frequency fatigue. Cap.

Rotating on the wrong diagnosis discards a working creative and keeps the delivery problem.

## Mix decisions belong to the planner

Format and budget splits across services are the orchestrator's call. Supply the cost-per-incremental
-conversion evidence per placement; do not reallocate across services yourself.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — creative and channel selection.
