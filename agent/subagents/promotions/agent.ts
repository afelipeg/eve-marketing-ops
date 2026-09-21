import { defineAgent } from "eve";
import { costSortedGateway, domainPrototypeLimits } from "../../lib/runtime-budgets";

export default defineAgent({
  description:
    "Promotions specialist. Designs and targets promotional campaigns (coupons, BOGO, dollar-off, FSI, threshold discounts) on incremental uplift rather than gross response: hard conditions, propensity and uplift scoring, LTV and survival for retention, ROI-optimized targeting depth, frequency capping, and a randomized holdout on every send. Refuses to send when expected uplift does not exceed cost.",
  model: "deepseek/deepseek-v4-pro-0813",
  reasoning: "medium",
  modelOptions: costSortedGateway,
  defaultTools: false,
  limits: domainPrototypeLimits,
});
