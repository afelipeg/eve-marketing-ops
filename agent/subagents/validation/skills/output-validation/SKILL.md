---
description: "Use when a sub-agent reports a result. Validates: 1) Significance claim matches measurement design, 2) Guardrails respected (price floors, brand equity, stock cover), 3) Economics: incremental margin > cost with 20% buffer, 4) Measurement validity: clean holdout, no contamination."
---

# Output Validation with JEV

## Input

- Delegate service name
- Original brief (objective, KPI, target, budget, guardrails)
- Claimed result summary
- Measured uplift % and significance
- Measurement design (holdout type, sample size, MDE)

## Evaluation Criteria (JEV prompt template)

### 1. Significance Consistency

- Does the claimed significance match the measurement design's MDE?
- Is "significant" claimed only when credible interval excludes 0?
- Is "not-significant" acknowledged when CI includes 0?
- Is "untested" used when no measurement design or insufficient sample?

### 2. Guardrail Compliance

- Price floor respected? (no price below floor)
- Brand equity: discount depth ≤ guardrail?
- Stock cover: weeks of cover ≥ campaign window?
- Capacity: creative variants ≤ supply?

### 3. Economic Coherence

- Incremental margin = uplift × margin per unit
- Cost = budget spent + discount cost (if promotion)
- **PASS only if**: incremental margin > cost × 1.2 (20% buffer)
- Report ROI = incremental margin / cost

### 4. Measurement Validity

- Holdout design: randomized / geo / switchback?
- Contamination risk: overlapping scopes, shared control groups?
- Sample size ≥ MDE requirement?
- Pre-period balance check passed?

## Output Format (JEV returns structured)

```json
{
  "directive": "EXECUTE" | "REBRIEF" | "ESCALATE" | "HOLD",
  "confidence": 0.0-1.0,
  "checks": { ... },
  "directives": [{ "team": "...", "task": "...", "deadline": "...", "evidence": "...", "owner": "...", "priority": "P0|P1|P2|P3" }],
  "kpisToWatch": [{ "kpi": "...", "currentValue": 0, "threshold": 0, "direction": "above|below" }],
  "blockers": [{ "blocker": "...", "impact": "...", "resolutionOwner": "...", "resolutionDeadline": "..." }],
  "validatedAt": "ISO timestamp",
  "validatedBy": "jev",
  "schemaVersion": "1.0"
}
```