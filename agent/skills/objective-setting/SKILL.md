---
description: Use when a business objective (acquisition, maximization, retention, revenue) must be turned into a primary KPI with a baseline, a target, a measurement window, and guardrail metrics — before any budget is split or any sub-agent is briefed.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — objectives, response modeling, incrementality"
---

# Objective setting

An objective is not a plan until it is a number with a window and a baseline. Produce all four.

## 1. Classify the objective

| Objective        | Economic question                                       | Primary KPI (default)       | Guardrails                                   |
| ---------------- | ------------------------------------------------------- | --------------------------- | -------------------------------------------- |
| **acquisition**  | What does one more new buyer cost, and is LTV > CAC?    | CAC, new customers          | LTV:CAC ≥ 3, margin %, brand equity          |
| **maximization** | Can we grow value per existing customer this period?    | AOV, units per order, SOM   | margin %, discount depth, stock cover        |
| **retention**    | Are we keeping the buyers we already paid to acquire?   | repeat rate, churn, LTV     | promo dependency, price integrity            |
| **revenue**      | What is the profit-maximizing price/mix right now?      | incremental margin, revenue | price floor, elasticity band, brand equity   |

If the request mixes two objectives, split it into two plans with separate budgets. Do not average them.

## 2. Establish the baseline from data, never from memory

Call `get_kpi_history` for the comparable prior periods and the same scope (brand, category,
territory). State the baseline as `value · period · scope · provenance`. If the tool returns
`provenance: "sample"`, label the baseline as illustrative and ask for the real source before
committing a target.

## 3. Set the target

```
target = baseline × (1 + expected_uplift)
```

`expected_uplift` must come from one of, in descending order of trust:

1. a measured response curve or prior holdout test on the same service and scope;
2. the same service's uplift in an adjacent territory or brand, discounted for transferability;
3. an explicit operator assumption — recorded in the brief as an assumption, not a finding.

Never set a target from an unqualified industry benchmark.

## 4. Define the measurement window and the read

State: the in-market period, the lag until the KPI can be read, the comparison design
(holdout, geo split, switchback, pre/post with control), and the minimum detectable effect the
budget can support. If the budget cannot support a detectable effect, say so — a test that cannot
resolve is a waste of the reserve.

## 5. Guardrails

Every objective carries at least one counter-metric, so that winning on the KPI while destroying
value is visible: margin % against volume plays, price integrity against promotion plays,
brand equity against discount depth, stock cover against demand generation.

## Output

```
OBJECTIVE   <type>
KPI         <metric> · baseline <x> (<period>, <scope>, provenance <p>) · target <y> · window <w>
GUARDRAILS  <counter-metrics with thresholds>
DESIGN      <measurement design and minimum detectable effect>
ASSUMPTIONS <each assumption, owner, and how it will be checked>
```
