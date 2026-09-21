---
description: Use when the user, the item, or the whole system is new — routing by available signal, bootstrapping with content and context, active elicitation, and measuring cold-start coverage rather than hiding it.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — cold start in recommender systems"
---

# Cold-start strategies

Three distinct problems, routinely conflated:

## 1. New user

| Signal available | Route |
| --- | --- |
| Nothing | Non-personalized, shrunk popularity, context-filtered |
| Session behaviour only | Content similarity to what they just viewed |
| 1–2 interactions | Content filtering, catalog-mean centring |
| 3+ interactions | Collaborative / latent factors |

Session context is the most underused signal: a first-time visitor who viewed two items has told
you more than a demographic guess ever will.

**Active elicitation** — asking a few high-information questions at signup — works when the answers
are genuinely discriminating (seeded from items with high rating variance, not high popularity).
Every question costs conversion, so cap it hard.

## 2. New item

A new item has no co-ratings, so collaborative methods can never surface it — it is invisible until
someone finds it another way, which they cannot. Breaking that loop requires:

- **Content-based bridging**: its attributes place it next to established items.
- **Explicit exploration budget**: a reserved share of slots for under-exposed items. Without this,
  the catalog tail is unreachable by construction.

## 3. New system

No interaction history at all. Content plus business rules, then collect. Do not launch a
collaborative model on 200 interactions and present its output as personalization.

## Measure cold-start coverage

Report the share of requests served by each route. A feed where 40% of impressions come from the
non-personalized fallback is not a personalized feed, whatever the average precision says — and
that share is usually an identity or data-plumbing finding, not a modeling one.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — cold-start handling.
