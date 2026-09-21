import { defineAgent } from "eve";
import { costSortedGateway, measurementPrototypeLimits } from "../../lib/runtime-budgets";

export default defineAgent({
  description:
    "Causal measurement specialist. Validates whether a marketing action actually caused an effect: audits test/control design, estimates uplift with beta-binomial credible intervals, pools thin cells with Gibbs sampling, computes multi-touch attribution with the causal V_k* model, and simulates power and scenarios. Reports numbers and significance only — it never recommends an action.",
  model: "anthropic/claude-sonnet-5",
  reasoning: "medium",
  modelOptions: costSortedGateway,
  defaultTools: false,
  limits: measurementPrototypeLimits,
});
