---
description: Use when deciding who to contact — modeling incremental response with a T-learner, separating persuadables from sure things and sleeping dogs, validating with Qini, and converting uplift into contact economics.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — uplift (incremental response) modeling in promotions"
---

# Uplift modeling

## What it estimates

```
uplift(x) = P(buy | treated, x) - P(buy | control, x)
```

Not `P(buy | treated)`. The second is response, and targeting on it buys demand that already
exists. The difference is the entire economic argument for a promotion.

## The four types, and what each costs

| Type         | P(buy\|control) | uplift | Contacting them                              |
| ------------ | --------------- | ------ | --------------------------------------------- |
| persuadable  | low             | high   | Creates the incremental margin                |
| sure thing   | high            | ~0     | Pays the discount on a purchase already coming |
| lost cause   | low             | ~0     | Wastes the contact cost                       |
| sleeping dog | medium-high     | **negative** | Actively destroys demand                |

Sleeping dogs are the reason "response looked fine" and "margin fell" coexist. Suppress them.

## Fitting

`score_uplift` uses the **two-model (T-learner)** approach: one response model per arm, uplift is
the difference. It needs both arms of a historical campaign frame; without a control arm there is
no uplift to model, only response — say that rather than substituting propensity.

Alternatives, when the T-learner is unstable on thin data: a single model with treatment
interaction terms (S-learner), or class transformation. All of them require randomized history.

## Validation

Read the **Qini coefficient**, not AUC. AUC measures response ranking; Qini measures incremental
response ranking against random targeting. A model with high AUC and near-zero Qini is a
propensity model wearing an uplift label.

Check the top decile: cumulative incremental response there should clearly exceed the random
diagonal. If it does not, targeting adds nothing and the honest recommendation is a broader, cheaper
offer or no campaign.

## From uplift to a contact decision

```
expected gain = uplift × margin per order
expected cost = cost per contact + P(buy | treated) × discount value
contact if     gain > cost
```

Note the second term: the discount is paid by everyone who redeems, including sure things. This is
why the economically optimal audience is always narrower than the "likely to buy" audience.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — incremental response modeling and campaign
targeting.
