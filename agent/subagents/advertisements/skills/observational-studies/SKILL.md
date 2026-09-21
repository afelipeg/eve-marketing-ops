---
description: Use when advertising effect must be estimated without a randomized holdout — choosing among geo matching, PSA controls, ghost ads, difference-in-differences and synthetic control, and reporting the result as an association with its identifying assumption.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — measurement without controlled experiments; selection bias in advertising response"
---

# Observational studies in advertising

## The bias that makes naive reads useless

Comparing **exposed** to **unexposed** users overstates advertising effect enormously, and for a
structural reason: exposure is not random. The bidder chose those users *because* they were already
likely to convert, and the exchange delivered impressions to people who were browsing. Exposed and
unexposed differ in exactly the way that produces conversions.

Any "exposed converts 5× better" claim is this bias, not a finding.

## Designs, strongest first

| Design                   | Control is                                              | Identifying assumption                          |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------ |
| **Ghost ads**            | Users the campaign *would have won* but was not shown to | Auction outcome is as-good-as-random at the margin |
| **PSA control**          | Users shown an unrelated public-service ad               | Winning the auction is the only difference       |
| **Geo holdout**          | Matched markets with the campaign off                    | Parallel pre-trends between markets              |
| Difference-in-differences| Unexposed group over the same period                     | Parallel trends absent the campaign              |
| Synthetic control        | Weighted donor markets reproducing the pre-period        | Donor pool uncontaminated                        |
| Matched users            | Users matched on observed behaviour                      | Selection on observables only                    |

Ghost ads and PSA controls are strong because they hold **auction participation** constant, which
is the variable that causes the selection.

## Procedure

1. State the assumption as a sentence a skeptic could attack.
2. Run the falsification test: pre-trend check, placebo period, placebo geo.
3. Estimate with an interval.
4. Report sensitivity: how strong an unobserved confounder would have to be to erase the effect.
5. Label the result an **association under assumption X**, never an uplift.

The measurement agent owns the estimate and the verdict. Your job here is to specify a design that
can carry a causal claim, and to refuse to report one that cannot.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — bias and confounding in advertising response
measurement.
