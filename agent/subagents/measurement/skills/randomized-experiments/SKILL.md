---
description: Use when designing or auditing a randomized test — choosing the unit of randomization, sizing arms, setting the holdout, guarding against contamination and peeking, and deciding whether an existing test can be read at all.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — campaign measurement, control groups and experimental design"
---

# Randomized experiments

Randomization is what makes the difference between arms causal. Everything below protects that.

## 1. Unit of randomization

Randomize at the unit where interference stops. The outcome must be measured at the same unit.

| Treatment                      | Unit      | Why                                             |
| ------------------------------ | --------- | ----------------------------------------------- |
| Personalized offer, email      | customer  | exposure is individual                          |
| On-site module, ranking change | session or customer | pick customer when repeat visits matter |
| Shelf price, planogram         | store     | shoppers see the store, not the assignment      |
| Broadcast media, OOH           | geo       | spillover crosses individuals                   |
| System-wide pricing rule       | time slot | switchback, since every unit is exposed         |

Reading a store-level treatment at customer level inflates significance: the effective sample is
the number of stores, not shoppers.

## 2. Assignment

Assign **before** exposure, from a stable hash of the unit id and the experiment id, so the split
is reproducible and a returning customer keeps its arm. Check balance on pre-period outcome and on
the covariates that drive the metric. A split that is unbalanced pre-period is a broken randomizer,
not a finding.

## 3. Sizing

Run `monte_carlo_simulate` in `sample-size` mode **before** funding, using the minimum effect worth
acting on — not the effect someone hopes for. If the required sample exceeds available traffic in
the window, the honest options are: lengthen the window, raise the minimum effect, pool cells
hierarchically, or do not run the test. Running it anyway produces an unreadable result.

## 4. Holdout discipline

- Keep the holdout for the full measurement window, including the lag until the outcome can be read.
- One holdout per portfolio, not one per campaign: overlapping holdouts contaminate each other's
  controls.
- Never "release the holdout early because results look good" — that is the peeking problem, and it
  inflates false positives.

## 5. Contamination checklist

Before reading any test, confirm none of these is true in the window:

- another service acting on the same customers or SKUs;
- spillover between arms (shared household, shared store, social propagation);
- assignment leaking into targeting (a lookalike model trained on the treatment arm);
- exposure logging that records intent rather than delivery.

Any of them present → report the read as contaminated and quantify the direction of the bias.

## 6. Analysis

Analyze by **assigned** arm, not by exposed (intention-to-treat). Dropping non-exposed assignees
reintroduces selection. If compliance is partial, report ITT, and the compliance rate beside it.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — control-group construction and campaign
measurement within promotions and advertisements.
