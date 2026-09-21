---
description: Use when measuring a recommender offline — temporal splits, precision/recall/NDCG at k, coverage, the bias baked into logged data, and why offline gains routinely fail online.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — recommender evaluation"
---

# Evaluation and offline testing

## Split by time, never at random

A random split lets the model see a user's future while predicting their past. It inflates every
metric and is the single most common reason an offline winner loses online. `evaluate_recommender`
splits at a day cutoff: train on everything before, evaluate on everything after.

## The metrics, and what each hides

| Metric | Answers | Blind to |
| --- | --- | --- |
| **precision@k** | Of k shown, how many were relevant | Everything not shown |
| **recall@k** | Of the relevant, how many were shown | Slate size effects |
| **NDCG@k** | Are the best items near the top | Items with no logged interaction |
| **RMSE / MAE** | Rating prediction error | Ranking entirely |
| **coverage** | Share of catalog ever recommended | Whether coverage is useful |
| **novelty** | Mean self-information of the slate | Relevance |
| **serendipity** | Relevant *and* not on the popularity baseline | Small samples make it unstable |

Read them **together**. A model that beats the popularity baseline on precision but not on
coverage has learned the best-seller list.

## The bias that cannot be removed offline

Logged interactions were produced by whatever recommender was live. Items the old policy never
showed have no positive evidence, so a genuinely novel slate is scored as wrong. This makes offline
evaluation structurally conservative about exploration — the exact behaviour you want.

Counterfactual estimators (inverse propensity weighting) correct part of it, and only when
propensities were logged.

## Online is the arbiter

Interleaving is far more sensitive than a user-split A/B for ranking comparisons, because it
compares within the same user. It measures ranking preference, not downstream business effect.
Route the decisive read to `measurement`, with guardrails: catalog coverage, mean item popularity,
margin per session.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — evaluating recommenders.
