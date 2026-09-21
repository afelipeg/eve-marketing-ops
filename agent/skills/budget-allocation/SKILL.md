---
description: Use when splitting a budget across promotions, advertisements, recommendations and pricing — including the measurement reserve, marginal-ROI reweighting, and the reallocation rule after a non-significant result.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — marketing mix, response curves, attribution"
---

# Budget allocation

## Rule 0 — reserve measurement first

Hold back 10% by default (adjust with `measurementReservePct`) for holdouts, geo tests, and
incrementality reads. An unmeasured plan cannot be optimized next period, so the reserve is not
overhead — it is the price of every future reallocation being evidence-based.

## Rule 1 — start from the objective priors

`allocate_budget` applies these priors. They are starting points, not truths:

| Service         | acquisition | maximization | retention | revenue |
| --------------- | ----------- | ------------ | --------- | ------- |
| advertisements  | 50%         | 6%           | 18%       | 16%     |
| promotions      | 29%         | 27%          | 35%       | 21%     |
| recommendations | 7%          | 40%          | 29%       | 21%     |
| pricing         | 14%         | 27%          | 18%       | 42%     |

Each column sums to 100% across the four services — there is no hidden
renormalization step. Search and assortment are out of scope for this system;
the acquisition column in particular assumes search demand is captured
elsewhere, so `advertisements` carries a share it would not carry if search
were in play.

## Rule 2 — replace priors with marginal ROI wherever it exists

The optimum is where the last currency unit buys the same incremental margin in every service:

```
∂margin/∂spend (service A) = ∂margin/∂spend (service B) = … = 1
```

Where a measured response curve exists, pass its implied weight through `weightOverrides`.
Response curves saturate: a service that returned high ROI at 50k does not return it at 200k.
Cap any single service at roughly 2× its prior weight in one step, and step again next period
with a fresh read rather than jumping.

## Rule 3 — constraints override optimization

Exclude a service with `excludeServices` when stock cover, capacity, a price floor, a legal limit,
or a brand-equity guardrail makes its play impossible. An allocation that cannot be executed is
worse than a smaller one that can.

## Rule 4 — floors and dead money

Below a minimum viable budget a service cannot run a readable test. If a service's allocated
amount falls under its floor, either fund it properly by taking from the largest line, or
drop it this period and say so. Do not scatter unreadable slices across every service.

## Rule 5 — reallocation after a result

When `measurement` reports uplift that is **not significant**:

1. Record the delegation as `validated` with the `validationId` returned by `validate_result`.
2. Present the proposed release to the operator. Only after approval, call `reallocate_budget`
   with `releaseFrom`, one matching `validations` record per service, and the measurement evidence
   as `reason`.
3. Retain 0–20% as a learning cell only when a specific redesign is already defined.
4. Redistribute in proportion to the remaining services' plan weights — unless a measured
   response curve says otherwise, in which case reweight explicitly.
5. Re-brief every receiving service with the revised budget and log it with `record_delegation`.

Non-significant is not the same as negative. Report it as "no detectable effect at this budget,"
and state the minimum detectable effect the test could resolve.

## Presentation

Always show the allocation as a table: service · weight % · amount · rationale · constraint.
Follow it with the measurement reserve line and the total. State the provenance of every input.
