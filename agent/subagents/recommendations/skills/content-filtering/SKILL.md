---
description: Use when recommending from item attributes rather than from other users' behaviour — building TF-IDF item vectors and user profiles, handling thin histories, and knowing when content filtering must hand over to collaborative.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — content-based filtering"
---

# Content filtering

## Method

Item vectors are TF-IDF over content tokens (category, brand, tags, occasion). A user profile is
the rating-weighted centroid of the items they touched, centred so that "rated 3 by a user who
averages 4.5" counts as negative evidence.

## The thin-history trap

Centring on the user's own mean is correct once they have a few ratings and **catastrophic before
that**: with a single rating, the mean *is* that rating, every weight is zero, and the profile is
empty — precisely the case content filtering exists to serve.

Below three ratings, `recommend_content` centres on the catalog mean and floors the weight at a
small positive value: the interaction itself is evidence of interest even when the rating is
mediocre. The tool reports which centring it used.

## Strengths and the hard limit

Content filtering needs **no other user's data**, so it works on a brand-new catalog and a
brand-new user, and it explains itself in the item's own vocabulary.

Its limit is structural: it can only ever return more of what the user already touched. It cannot
discover that people who like this also like something with no shared attributes. Switch to
collaborative filtering as soon as history allows, or the list narrows into a filter bubble and
novelty collapses.

## Quality of the attributes decides everything

Sparse or generic tags produce a model that recommends by category. Before blaming the algorithm,
check token coverage per item and IDF distribution: if a handful of tokens appear on most items,
they carry no discriminating information.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — content-based filtering and the cold-start
problem.
