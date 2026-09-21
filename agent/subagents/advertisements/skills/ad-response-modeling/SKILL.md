---
description: Use when fitting or judging psi_a(u) — choosing the training target (conversions, not clicks), features, class imbalance and calibration, and reading whether the model is good enough to scale bids with.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — ad response modeling and predictive-modeling review"
---

# Ad response modeling

## The target

Fit on **conversions**. Not clicks, not viewable clicks, not engagements.

The reason is mechanical: invalid traffic produces clicks and no conversions, so a click model
learns that fraudulent inventory has the highest response, and the bidder pays a premium for the
worst supply in the exchange. `score_ad_response` will fit on clicks when asked, and stamps the
output with a warning saying not to bid on it.

Where conversions are too sparse to fit, the honest options are: pool creatives or windows, model a
closer proxy with a documented conversion relationship, or bid flat and buy the data. Not: switch
to clicks quietly.

## Features

Keep `omega` inputs out of the response model where they encode supply quality that must be priced
separately. The feature set in use is: phi, sessions, prior conversion, impressions served, slot
position, viewability, brand safety, hour.

Fraud probability is deliberately **excluded** — it belongs in omega. If it enters psi, the model
learns fraud as a positive click signal and bids it up.

## Class imbalance and calibration

Conversion rates below 1% mean:

- **AUC** measures ranking, and ranking is what the scalings use — read it first.
- **Calibration** matters separately: `psi` enters the ceilings as a probability, so a model that
  ranks well but is miscalibrated by 3× produces ceilings wrong by 3×. Check predicted versus
  observed rate by decile.
- **Fewer than ~20 positives** in a slice means no usable model. The tool refuses rather than
  returning a confident-looking fit.

## Reading fit quality

| AUC       | Use                                                             |
| --------- | ---------------------------------------------------------------- |
| ≥0.70     | Usable for bid scaling                                          |
| 0.60–0.70 | Noisy; keep scalings conservative (α below 1), widen the window |
| <0.60     | Random ordering — scaling on it amplifies noise into spend      |

## Drift

Response models decay: creative fatigue, seasonality, and supply-mix shifts all move psi. Refit on
a schedule, and recompute `psi_bar` with every refit — a stale baseline silently rescales every
bid in the campaign.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — ad response modeling.
