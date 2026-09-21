import { defineEval } from "eve/evals";

export default defineEval({
  description: "validate_result reaches the hidden JEV subagent through a durable typed workflow",
  timeoutMs: 180_000,
  async test(t) {
    await t.send(`Call validate_result exactly once with this JSON and report its directive. Do not call any other tool.
{
  "delegate": "measurement",
  "brief": {
    "objective": "acquisition",
    "kpi": "conversion_rate",
    "targetValue": 0.12,
    "budget": 100000,
    "currency": "USD",
    "deadline": "2026-10-01",
    "guardrails": { "minMarginPct": 0.2 },
    "scope": {
      "brands": ["Andina"],
      "categories": ["beverages"],
      "territories": ["CO-Bogota"],
      "channels": ["paid-social"]
    }
  },
  "claimedResult": {
    "summary": "Synthetic randomized rehearsal with positive incremental margin.",
    "measuredUpliftPct": 5,
    "upliftCiLow": 2,
    "upliftCiHigh": 8,
    "powerAchieved": 0.9,
    "significance": "significant",
    "spend": 10000,
    "incrementalRevenue": 70000,
    "incrementalMargin": 30000,
    "provenance": "synthetic",
    "poolingMethod": "none"
  },
  "measurementDesign": {
    "type": "randomized",
    "unit": "customer",
    "sampleSize": 10000,
    "mde": 2,
    "holdoutIds": ["control-a"],
    "contaminationRisk": "low"
  }
}`);

    t.succeeded();
    t.calledTool("validate_result", { count: 1 });
    t.calledSubagent("validation", { count: 1 });
    t.noFailedActions();
  },
});
