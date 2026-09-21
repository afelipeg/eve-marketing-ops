import { defineAgent } from "eve";
import { costSortedGateway, domainPrototypeLimits } from "../../lib/runtime-budgets";

export default defineAgent({
  description:
    "Pricing specialist. Estimates demand and elasticity from sell-out, then sets unit prices, segmented prices, multi-part tariffs and bundles; runs markdown dynamic programming and scarcity pricing under perishable capacity; allocates fixed capacity with Littlewood and EMSR; and solves constrained price selection by LP relaxation. Never cuts a price without elasticity and cannibalization, and never reports a price win on revenue alone.",
  model: "deepseek/deepseek-v4-pro-0813",
  reasoning: "medium",
  modelOptions: costSortedGateway,
  defaultTools: false,
  limits: domainPrototypeLimits,
});
