# marketing-ops

This is an [eve](https://eve.dev) agent bootstrapped with [`eve init`](https://eve.dev/docs/reference/cli#eve-init).

## Getting started

First, run the development server:

```bash
eve dev
```

The development TUI opens an interactive session where you can send messages to your agent.

Start by editing `agent/instructions.md` to define the agent's identity, purpose, tone, and response guidelines. Configure its model and runtime behavior in `agent/agent.ts`.

Add capabilities under `agent/`, including tools, connections, channels, skills, subagents, and schedules. eve reloads your changes as you work.

## Learn more

To learn more about eve, explore these resources:

- [eve documentation](https://eve.dev/docs) — learn about eve's features and authoring APIs.
- [Build an Agent tutorial](https://eve.dev/docs/tutorial/first-agent) — build and deploy an agent step by step.
- [eve on GitHub](https://github.com/vercel/eve) — view the source and contribute.

## Deploy on Vercel

Deploy your agent to [Vercel](https://vercel.com) from the project root:

```bash
eve deploy
```

`eve deploy` links a Vercel project if needed and deploys the agent to production. See the [eve deployment documentation](https://eve.dev/docs/guides/deployment/vercel) for authentication, environment variables, and deployment options.

## Agent 1 — Marketing Operations Orchestrator (lead)

The planner and entry point of the algorithmic marketing system. It never executes marketing
actions: it sets the metric, verifies constraints, allocates budget across the four programmatic
services, briefs the sub-agents, routes their results to `measurement`, and reallocates when
uplift is not significant.

```
agent/
├── agent.ts                 # anthropic/claude-sonnet-5, reasoning medium, tool:false (no self-copies)
├── instructions.md          # identity, standing rules, brief template, routing table
├── lib/
│   ├── types.ts             # services, objectives, KPIs, records — one Zod vocabulary
│   ├── allocation.ts        # Allocation-by-Objective priors, reallocation, durable plan state
│   ├── marketing-data.ts    # data access + provenance
│   └── data/                # bundled sample rows (contract: docs/data-contract.md)
├── skills/                  # objective-setting, opportunity-analysis, budget-allocation,
│                            # campaign-portfolio-management, resource-allocation
└── tools/
    ├── get_kpi_history.ts   # historical KPI tables + ROI/ROAS/CAC/AOV aggregates
    ├── get_budget.ts        # envelopes: planned / committed / spent / available
    ├── allocate_budget.ts   # objective → split across services + measurement reserve
    ├── record_delegation.ts # ledger of every brief and its validated result
    ├── reallocate_budget.ts # release non-significant spend, redistribute by weight
    └── get_plan_state.ts    # current objective, plan, delegations, history
```

The last four tools are `availableInSubagents: false` — only the top-level planner allocates.

### Sub-agents

Five specialists live under `agent/subagents/`: `promotions`, `advertisements`, `recommendations`,
`pricing` and `measurement`. Each appears in the planner's tool list once its directory exists with
an `agent.ts` carrying a `description`. `search` and `assortment` are out of scope — removed from
the service vocabulary and the allocation priors, so the orchestrator cannot delegate to them at
all, rather than being told not to.

### Data

Sample rows ship with the agent so it runs before a warehouse is connected. Every tool result
carries `provenance`; on `"sample"` the agent must say so before using the figures. Point
`MARKETING_DATA_DIR` at a directory that satisfies the complete 16-file contract to serve real
data. Partial directories fail closed instead of mixing real and sample rows — see
`docs/data-contract.md`.

## Agent 2 — Measurement (sub-agent, cross-cutting)

`agent/subagents/measurement/` — the feedback loop. It audits whether a design can carry a causal
claim at all, estimates uplift with credible intervals, pools thin cells, computes causal
multi-touch attribution, and simulates power and scenarios. It never recommends an action.

```
agent/subagents/measurement/
├── agent.ts                      # description, claude-sonnet-5, reasoning medium
├── instructions.md               # protocol, report shape, 7 hard rules
├── lib/
│   ├── random.ts                 # seeded RNG, gamma/beta/binomial samplers, quantiles
│   ├── bayes.ts                  # beta-binomial uplift, power simulation, sample size, MDE
│   ├── gibbs.ts                  # hierarchical beta-binomial, Gibbs + tuned Metropolis
│   ├── attribution.ts            # V_k* removal effect, Shapley, bootstrap CIs
│   ├── data.ts                   # experiment/journey logs + design audit
│   └── data/sample.ts            # labeled sample logs
├── skills/                       # randomized-experiments · beta-binomial-analysis
│                                 # observational-studies · gibbs-sampling · uplift-measurement
│                                 # causal-inference · multi-touch-attribution
└── tools/
    ├── get_experiment_log.ts     # test/control logs + design audit (blocking vs cautions)
    ├── get_conversion_data.ts    # journeys + per-channel raw summaries
    ├── beta_binomial_uplift.ts   # uplift, 90% CI, P(t>c), expected loss, MDE
    ├── gibbs_hierarchical_uplift.ts  # pooled + per-cell shrunk uplift, MCMC diagnostics
    ├── monte_carlo_simulate.ts   # power · sample-size · scenario projection
    ├── attribution_v_star.ts     # causal multi-touch credit with bootstrap intervals
    └── synthesize_experiment.ts  # synthetic arms for design rehearsal, labeled synthetic
```

Every stochastic tool takes a `seed` and is deterministic given one, so a quoted interval is
reproducible across retries and replays. Method references: `docs/references.md`.

## Agent 3 — Promotions (sub-agent)

`agent/subagents/promotions/` — designs and targets promotional campaigns on incremental uplift.
Hard conditions, then uplift scoring, then ROI-optimized depth, then caps, then a gated send with a
randomized holdout. It never scores its own result: it hands a measurement request back to the
orchestrator.

```
agent/subagents/promotions/
├── agent.ts / instructions.md    # workflow, 7 hard rules, report shape
├── lib/
│   ├── models.ts                 # logistic regression, T-learner uplift, AUC, Qini
│   ├── ltv.ts                    # Kaplan-Meier, conditional churn, LTV, savability, LTV:CAC
│   ├── targeting.ts              # RFM, hard conditions, offer economics, depth optimization
│   ├── data.ts + data/sample.ts  # generated 2,000-customer sample population
│   └── types.ts, random.ts
├── skills/                       # 11: uplift · response · look-alike · ltv · survival · rfm
│                                 # tiered · multi-stage (ZMOT/FMOT/SMOT) · retention
│                                 # replenishment · budgeting-and-capping
└── tools/
    ├── get_customer_profiles.ts      ├── score_response_propensity.ts
    ├── get_transaction_history.ts    ├── score_uplift.ts
    ├── segment_rfm.ts                ├── estimate_ltv_survival.ts
    ├── build_lookalike_audience.ts   ├── optimize_targeting_depth.ts
    ├── issue_offers.ts  (approval: always(), dryRun default, refuses without holdout)
    └── prepare_measurement_handoff.ts
```

The sample population is *generated* with a planted uplift structure (persuadables, sure things,
lost causes, sleeping dogs), so the uplift model can be checked against known ground truth.

## Agent 4 — Advertisements (sub-agent)

`agent/subagents/advertisements/` — the RTB bidder. Scores brand proximity, ad response and
inventory quality, computes the bid, clears it against a second-price auction, paces budget, and
attributes conversions causally. Optimizes incremental conversions and CPA, never impressions.

```
agent/subagents/advertisements/
├── agent.ts / instructions.md    # per-request workflow, 8 hard rules, <200ms budget
├── lib/
│   ├── proximity.ts              # phi(u): affinity, recency half-life, depth, prior conversion
│   ├── models.ts                 # psi_a(u): logistic response, fitted on conversions
│   ├── inventory.ts              # omega_a(u,i): viewability × (1-fraud)² × safety × position …
│   ├── bidding.ts                # b(u), value/target ceilings, Vickrey clearing, pacing, sim
│   ├── attribution.ts            # V_k* (planning-time copy; measurement owns the verdict)
│   └── data.ts + data/sample.ts  # 60 publishers, 3,000 users, 25,000 impressions
├── skills/                       # 11: rtb-bidding · brand-proximity · ad-response-modeling
│                                 # inventory-quality-scoring · multi-touch-attribution
│                                 # observational-studies · look-alike-modeling · budget-pacing
│                                 # frequency-and-fatigue · brand-safety-and-fraud
│                                 # creative-and-placement-mix
└── tools/
    ├── get_bid_requests.ts           ├── score_inventory_quality.ts
    ├── get_user_profile.ts           ├── compute_bid.ts
    ├── score_brand_proximity.ts      ├── simulate_auction.ts
    ├── score_ad_response.ts          ├── attribute_v_star.ts
    └── prepare_measurement_handoff.ts
```

The sample exchange traffic plants a **fraud trap**: long-tail publishers have high invalid-traffic
probability, which inflates click rate and suppresses conversion rate. A click-trained response
model bids into them; the conversion-trained model does not. The fraud discount lives in `omega`,
never in `psi`.

## Agent 5 — Recommendations (sub-agent)

`agent/subagents/recommendations/` — recommends where there is no explicit intent. Routes by
available signal, combines models, optimizes several objectives at once, and re-ranks for diversity
before anything is presented.

```
agent/subagents/recommendations/
├── agent.ts / instructions.md    # 7-step workflow, 8 hard rules, report shape
├── lib/
│   ├── matrix.ts                 # index maps, temporal split, sparsity report
│   ├── similarity.ts             # item-based kNN, adjusted cosine, support shrinkage
│   ├── mf.ts                     # SVD / SVD++ / timeSVD++ by SGD, with dev clamping
│   ├── content.ts                # TF-IDF vectors, user profiles, Bayesian popularity
│   ├── assoc.ts                  # Apriori-pruned association rules (support/confidence/lift)
│   ├── rank.ts                   # TOPSIS, MMR, popularity penalty, all offline metrics
│   └── data.ts + data/sample.ts  # 600 users × 250 items, 12.9k ratings, 4k baskets
├── skills/                       # 14 (9 requested + 5 gap-closers)
└── tools/
    ├── get_catalog.ts                ├── mine_association_rules.ts
    ├── get_rating_matrix.ts          ├── recommend_hybrid.ts
    ├── recommend_collaborative.ts    ├── optimize_multi_objective.ts
    ├── recommend_content.ts          ├── rerank_for_diversity.ts
    ├── recommend_latent_factors.ts   ├── evaluate_recommender.ts
    └── prepare_measurement_handoff.ts
```

The sample data plants a **rank-4 latent structure**, a **Zipf popularity law**, **temporal drift**
in user taste plus a rising trend on a third of the items, **two high-lift association rules**, and
a cohort of **cold users** — so every model can be checked against known ground truth instead of
taken on faith.

## Agent 6 — Pricing (sub-agent)

`agent/subagents/pricing/` — estimates demand from sell-out, then sets prices under the binding
constraint: elasticity, capacity, perishability, competition or law.

```
agent/subagents/pricing/
├── agent.ts / instructions.md    # 7-step workflow, 8 hard rules, sensitivity-table report shape
├── lib/
│   ├── demand.ts                 # OLS with standard errors + CIs; MNL choice model
│   ├── optimize.ts               # unit price, WTP segmentation, two-part tariff, bundling,
│   │                             # cannibalization + price/volume/mix
│   ├── dynamic.ts                # markdown DP over (periods, inventory); scarcity pricing
│   ├── allocation.ts             # Littlewood, EMSR-a, EMSR-b nested protection levels
│   ├── lp.ts                     # two-phase simplex + LP-relaxation rounding with gap
│   └── data.ts + data/sample.ts  # 40 SKUs × 104 weeks, order-up-to inventory policy
├── skills/                       # 14 (9 requested + 5 gap-closers)
└── tools/
    ├── get_sales_history.ts          ├── design_bundle_or_tariff.ts
    ├── get_competitor_prices.ts      ├── optimize_markdown.ts
    ├── get_inventory.ts              ├── price_under_scarcity.ts
    ├── estimate_demand.ts            ├── allocate_capacity.ts
    ├── optimize_unit_price.ts        ├── analyze_cannibalization.ts
    ├── design_price_differentiation.ts  ├── solve_price_lp.ts
    └── prepare_measurement_handoff.ts
```

The sample data plants a known demand system — per-SKU true elasticities, cross-price effects,
promotion lift, seasonality — plus an **order-up-to inventory policy** whose stockouts censor
observed demand. Estimated elasticities land inside their 95% CI for **39 of 40 SKUs**, and keeping
the censored weeks moves a true −2.44 to −0.69, which is the lesson the tool's default encodes.
