import type { ValidationInput } from "./input";

export async function buildJevPrompt(input: ValidationInput): Promise<string> {
  "use step";
  return `You are a rigorous marketing operations validator. Evaluate the sub-agent's claimed result against the brief, guardrails, and measurement design. Missing evidence must lower confidence and may require HOLD; never invent it.

Return ONLY valid JSON matching the ValidationDecision schema. No prose, no markdown, no commentary.
The workflow owns validationId, validatedAt, validatedBy, and schemaVersion; do not return them.
Keep each reasoning/evidence field under 800 characters and return at most 8 directives, 8 KPIs,
and 8 blockers. Prefer one decisive sentence per field; do not restate the supplied JSON.

## BRIEF
${JSON.stringify(input.brief, null, 2)}

## CLAIMED RESULT
${JSON.stringify(input.claimedResult, null, 2)}

## MEASUREMENT DESIGN
${JSON.stringify(input.measurementDesign ?? { type: "none" }, null, 2)}

## AGENT-SPECIFIC CONTEXT
${getAgentSpecificContext(input)}

## EVALUATION CRITERIA (apply all strictly)

### 1. SIGNIFICANCE CONSISTENCY
- If measurementDesign.type !== "none": Does claimed significance match the design's MDE and credible interval?
- If "significant": CI must exclude 0, observed uplift ≥ MDE.
- If "not-significant": CI includes 0 OR observed uplift < MDE.
- If "untested": No measurement design OR insufficient sample.

### 2. GUARDRAIL COMPLIANCE
Check each guardrail in brief.guardrails:
- minMarginPct: incrementalMargin / incrementalRevenue ≥ minMarginPct
- priceFloor: no price below floor (pricing agent)
- stockCoverWeeks: current cover ≥ campaign window
- brandEquityMaxDiscount: discountDepth ≤ maxDiscount
- capacityNote: creative variants ≤ supply, model refresh ≤ cadence

### 3. ECONOMIC COHERENCE
- incrementalMargin = uplift × margin per unit (from brief/baseline)
- cost = spend + discountCost (if promotion)
- PASS if incrementalMargin > cost × 1.2 (20% buffer for uncertainty)
- Report ROI = incrementalMargin / cost

### 4. MEASUREMENT VALIDITY
- Design type appropriate for objective?
- Contamination risk: overlapping scopes, shared controls?
- Sample size ≥ required for MDE?
- Pre-period balance (if randomized/geo)?

## OUTPUT SCHEMA (must match exactly)
{
  "directive": "EXECUTE" | "REBRIEF" | "ESCALATE" | "HOLD",
  "confidence": 0.0-1.0,
  "checks": {
    "significance": { "pass": boolean, "reasoning": "string", "evidence": "string" },
    "guardrails": { "pass": boolean, "reasoning": "string", "violations": [{ "guardrail": "string", "limit": number, "actual": number, "severity": "warning|breach" }] },
    "economics": { "pass": boolean, "reasoning": "string", "incrementalMargin": number, "cost": number, "roi": number, "buffer": number },
    "measurement": { "pass": boolean, "reasoning": "string", "designQuality": "clean|acceptable|contaminated|unreadable", "mdeVsObserved": number }
  },
  "directives": [{ "team": "growth|creative|data|media|pricing|crm|field|finance|legal|brand", "task": "string", "deadline": "ISO date", "evidence": "string", "owner": "string", "priority": "P0-blocker|P1-this-week|P2-this-sprint|P3-backlog", "dependencies": ["string"] }],
  "kpisToWatch": [{ "kpi": "string", "currentValue": number, "threshold": number, "direction": "above|below", "alertChannel": "string" }],
  "blockers": [{ "blocker": "string", "impact": "string", "resolutionOwner": "string", "resolutionDeadline": "ISO date" }]
}`;

}

function getAgentSpecificContext(input: ValidationInput): string {
  switch (input.delegate) {
    case "promotions":
      return `PROMOTIONS-SPECIFIC:
- Uplift breakdown: incremental vs switched vs pulled-forward vs sleeping-dog
- Sleeping dogs (negative uplift) destroy margin → automatic FAIL on economics if > 5% of targeted
- Targeting depth: contacting > 80% of eligible without uplift justification = waste
- Discount depth > brandEquityMaxDiscount = guardrail breach
- Redemption rate < 2% = creative/channel mismatch`;

    case "advertisements":
      return `ADVERTISEMENTS-SPECIFIC:
- ROAS must exceed target CPA × (1 + minMarginPct)
- Viewability < 50% → measurement invalid (contaminated)
- Fraud rate > 15% → inventory quality fail
- Frequency > 3/week per user → fatigue risk (creative team directive)
- Brand proximity phi(u) must correlate with conversion (validation of RTB model)`;

    case "pricing":
      return `PRICING-SPECIFIC:
- Elasticity estimate must have CI excluding 0 (measured, not assumed)
- Cross-elasticity matrix: cannibalization ≤ 20% of volume gain
- Psychological threshold breach → automatic ESCALATE (legal/brand)
- Volume impact must match elasticity × price change (coherence check)
- Stock cover after price change ≥ guardrail`;

    case "recommendations":
      return `RECOMMENDATIONS-SPECIFIC:
- CTR/CVR must beat non-personalized baseline (popularity)
- Diversity ≥ 0.7 (entropy) OR explicit business reason for narrow
- Novelty > 0.3 for maximization objective
- Cold-start coverage ≥ 80% of new users
- Popularity bias < 0.3 (measured by Gini on recommended items)`;

    case "measurement":
      return `MEASUREMENT-SPECIFIC:
- Uplift CI must be from beta-binomial (randomized) or Gibbs (thin cells)
- Qini > 0.1 for uplift models; AUC ≠ Qini
- Power achieved ≥ 0.8 for claimed significance
- Pooling method documented; no p-hacking`;

    default:
      return "";
  }
}
