# Method references

Primary source for this system's method: **Ilya Katsov, *Introduction to Algorithmic Marketing:
Artificial Intelligence for Marketing Operations*** (Grid Dynamics).

Pointers below are **topic-level, to named chapters** — not page citations. Verify against your
copy before quoting the book in a client deliverable.

## Book structure used here

| Chapter (topic)                    | What this system takes from it                                           |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Review of Predictive Modeling      | Bayesian estimation, hierarchical models, MCMC, response models           |
| Promotions and Advertisements      | Response and uplift modeling, targeting, multitouch attribution, LTV      |
| Search                             | Relevance and ranking as a programmatic service                           |
| Recommendations                    | Cross-sell and personalization as a programmatic service                  |
| Pricing and Assortment             | Elasticity, price optimization, assortment and category planning          |

The orchestrator coordinates four of the book's programmatic services — promotions,
advertisements, recommendations and pricing — with **measurement** added as the cross-cutting
validation service. Search and assortment are deliberately out of scope: they were removed from
the service vocabulary and the allocation priors, so the orchestrator cannot delegate to them.

## Agent 1 — Marketing Operations Orchestrator

| Skill                           | Grounding                                                               |
| ------------------------------- | ----------------------------------------------------------------------- |
| `objective-setting`             | Objectives, response modeling, incrementality                           |
| `opportunity-analysis`          | Demand prediction; price, PPA, and assortment optimization              |
| `budget-allocation`             | Marketing mix, response curves, saturation, attribution                 |
| `campaign-portfolio-management` | Campaign targeting, attribution, orchestration across services          |
| `resource-allocation`           | Operational constraints on algorithmic services                         |

Allocation-by-Objective weights in `agent/lib/allocation.ts` are **priors chosen for this system**,
not values published in the book. They exist to give a defensible starting split before measured
response curves exist, and are replaced by measured marginal ROI as soon as measurement returns it.

## Agent 2 — Measurement

| Skill                      | Grounding                                                                    |
| -------------------------- | ----------------------------------------------------------------------------- |
| `randomized-experiments`   | Control-group construction and campaign measurement                          |
| `beta-binomial-analysis`   | Bayesian estimation in the predictive-modeling review                        |
| `observational-studies`    | Confounding and bias when no controlled experiment exists                    |
| `gibbs-sampling`           | Hierarchical Bayesian models and MCMC                                        |
| `uplift-measurement`       | Incremental response (uplift) modeling and the four response types           |
| `causal-inference`         | Causal framing of marketing response and attribution                         |
| `multi-touch-attribution`  | Multitouch attribution and the causal contribution of touchpoints            |

## Agent 3 — Promotions

| Skill                     | Grounding                                                               |
| ------------------------- | ----------------------------------------------------------------------- |
| `response-modeling`       | Response modeling; predictive-modeling review                          |
| `uplift-modeling`         | Incremental response (uplift) modeling and campaign targeting           |
| `look-alike-modeling`     | Audience construction and expansion                                     |
| `ltv-modeling`            | Customer lifetime value                                                 |
| `survival-analysis`       | Churn and retention analysis                                            |
| `rfm-segmentation`        | Segmentation methods in promotions                                      |
| `tiered-segmentation`     | Differentiated customer treatment                                       |
| `multi-stage-campaigns`   | Multi-stage campaign structures                                         |
| `retention-campaigns`     | Churn prevention and retention campaigns                                |
| `replenishment-campaigns` | Purchase-cycle modeling and triggered campaigns                         |
| `budgeting-and-capping`   | Budget allocation, contact policy, campaign economics                   |

ZMOT / FMOT / SMOT are Google's and P&G's moment-of-truth framing, used here to stage campaigns;
they are not Katsov's terminology.

## Agent 4 — Advertisements

| Skill                        | Grounding                                                            |
| ---------------------------- | --------------------------------------------------------------------- |
| `rtb-bidding`                | Real-time bidding, ad exchanges, auction mechanics                   |
| `brand-proximity`            | Audience targeting and brand proximity                               |
| `ad-response-modeling`       | Ad response modeling; predictive-modeling review                     |
| `inventory-quality-scoring`  | Inventory quality and exchange supply                                |
| `multi-touch-attribution`    | Multitouch attribution, causal contribution of touchpoints           |
| `observational-studies`      | Bias and confounding in advertising response measurement             |
| `look-alike-modeling`        | Audience expansion and prospecting                                   |
| `budget-pacing`              | Budget allocation and delivery control                               |
| `frequency-and-fatigue`      | Exposure and delivery effects                                        |
| `brand-safety-and-fraud`     | Inventory quality and supply selection                               |
| `creative-and-placement-mix` | Creative and channel selection                                       |

Notation `phi(u)`, `psi_a(u)`, `omega_a(u,i)` and `b(u) = b_base·s1(psi)·s2(omega/omega_bar)`
follows the book's advertisements chapter. The specific functional forms in
`agent/subagents/advertisements/lib/` (exponential recency decay, squared invalid-traffic
discount, clipped power scalings, the value and target-CPA ceilings) are this system's
implementation choices, not values published in the book.

Contemporary practice not in the book, added where it changes the answer: ghost ads and PSA
controls as advertising holdout designs, `ads.txt` / `sellers.json` and supply-path
deduplication, first-price auction dynamics (the book's second-price framing no longer describes
most exchanges — `rtb-bidding` says so explicitly), and privacy-driven identity loss as a limit on
phi coverage.

## Agent 5 — Recommendations

| Skill                               | Grounding                                                     |
| ----------------------------------- | -------------------------------------------------------------- |
| `content-filtering`                 | Content-based filtering and cold start                        |
| `collaborative-filtering`           | Neighborhood collaborative filtering                          |
| `latent-factor-models`              | Matrix factorization, SVD / SVD++ / timeSVD++                 |
| `hybrid-recommenders`               | Hybrid recommendation strategies                              |
| `contextual-recommendations`        | Context-aware recommendation                                  |
| `association-rules`                 | Market-basket analysis                                        |
| `multi-objective-optimization`      | Balancing business objectives in ranking                      |
| `topsis-algorithm`                  | Multi-criteria ranking                                        |
| `non-personalized-recommendations`  | Baseline recommenders                                         |
| `cold-start-strategies`             | Cold-start handling                                           |
| `evaluation-and-offline-testing`    | Recommender evaluation                                        |
| `diversity-novelty-serendipity`     | Beyond-accuracy objectives                                    |
| `explanations-and-presentation`     | Presentation and trust                                        |
| `feedback-loops-and-popularity-bias`| Feedback effects in algorithmic services                      |

The last five close gaps the request did not name. TOPSIS (Hwang & Yoon, 1981) and MMR (Carbonell &
Goldstein, 1998) are standard methods used here to make the book's multi-objective and diversity
discussion executable; the specific criterion weights are this system's choices.

Two implementation details are deliberate departures worth knowing: the timeSVD++ deviation term is
**clamped to the support seen in training** (unclamped, `alpha_u · dev(t)` extrapolates without
bound past the training window and loses to plain SVD++ on a late holdout), and the content profile
falls back to catalog-mean centring below three ratings (self-centring makes a one-rating profile
identically zero — the exact cold-start case content filtering exists to serve).

## Agent 6 — Pricing

| Skill                              | Grounding                                                      |
| ---------------------------------- | ---------------------------------------------------------------- |
| `demand-prediction`                | Demand prediction and response modeling                        |
| `price-elasticity`                 | Elasticity and optimal price                                   |
| `price-differentiation`            | Price differentiation and willingness to pay                   |
| `dynamic-pricing`                  | Dynamic pricing under finite capacity                          |
| `markdown-optimization`            | Markdown and clearance pricing                                 |
| `personalized-discounts`           | Targeted promotions and personalized pricing                   |
| `resource-allocation-emsr`         | Capacity allocation under finite resources                     |
| `competitive-price-optimization`   | Competitive dynamics in price optimization                     |
| `bundling`                         | Bundling and product-line pricing                              |
| `multi-part-pricing`               | Multi-part tariffs and non-linear pricing                      |
| `lp-and-discrete-optimization`     | Optimization under business constraints                        |
| `price-volume-mix`                 | Decomposition of pricing performance                           |
| `stockout-and-inventory-pricing`   | Inventory-aware pricing                                        |
| `legal-and-fairness-constraints`   | Constraints on price optimization, **extended** (see below)    |

`legal-and-fairness-constraints` goes well beyond the book: algorithmic collusion, drip pricing,
proxy discrimination and anti-gouging rules are contemporary regulatory practice, not Katsov's
material. It is an engineering checklist, not legal advice.

### Methods implemented beyond the book's exposition

These are standard published methods used to make the book's concepts executable. They are cited
here so the implementation is not mistaken for the book's own algorithms:

- **Beta-binomial posterior with Monte Carlo uplift** — conjugate Bayesian inference; intervals are
  taken from the joint posterior of the two arms.
- **Markov removal effect** for `V_k*` — ablation of a touchpoint by redirecting its inbound
  transitions to the non-converting absorbing state (Anderl, Becker, von Wangenheim & Schumann,
  *Mapping the Customer Journey*, and the Markov attribution literature).
- **Shapley value attribution** — cooperative-game credit allocation over coalitions of touched
  channels (Shapley, 1953), exact enumeration up to 12 channels.
- **Gibbs sampling with Metropolis steps** on the hyperparameters of a hierarchical
  beta-binomial, with Robbins-Monro step-size tuning during burn-in (Gelman et al.,
  *Bayesian Data Analysis*).
- **T-learner uplift** — two-model incremental response estimation, with Qini curve and
  coefficient for validation (Radcliffe & Surry, uplift-modeling literature).
- **Kaplan-Meier estimator** with right-censoring for time-to-lapse, and conditional survival for
  tenure-adjusted churn probability.
- **Regularized logistic regression** fitted by gradient descent on standardized features, used as
  the base learner for response, uplift, and look-alike models.
- **Markov ablation attribution** is shared by the measurement and advertisements agents. eve
  subagents are isolated, so the implementation is duplicated by design; measurement owns the
  canonical read and the significance verdict, and the advertisements copy is planning-time only.
- **Biased matrix factorization by SGD** with SVD++ implicit terms and timeSVD++ drift
  (Koren's Netflix-era formulations), fitted on observed entries only.
- **Kaplan-Meier**, **TOPSIS**, **MMR**, **Apriori pruning** and **Bayesian rating shrinkage** are
  standard published methods, named here so the implementations are not mistaken for the book's own.
- **Littlewood's rule** (1972) and **EMSR-a / EMSR-b** (Belobaba) for nested capacity protection.
- **Two-phase simplex** for the LP relaxation of discrete price selection, with the rounding gap
  reported rather than hidden.
- **Finite-horizon dynamic programming** over (periods remaining, inventory) for markdowns, with
  Poisson demand.
- **TOPSIS** (Hwang & Yoon, 1981), **MMR** (Carbonell & Goldstein, 1998).
- **Marsaglia-Tsang gamma sampler** for Beta draws; **Acklam** inverse-normal for the
  analytic minimum-detectable-effect approximation.
