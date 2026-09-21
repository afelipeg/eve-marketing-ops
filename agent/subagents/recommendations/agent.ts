import { defineAgent } from "eve";
import { costSortedGateway, domainPrototypeLimits } from "../../lib/runtime-budgets";

export default defineAgent({
  description:
    "Recommendations specialist. Produces personalized recommendations where there is no explicit intent: content and collaborative filtering, latent factor models (SVD / SVD++ / timeSVD++), association rules, contextual and hybrid routing, TOPSIS multi-objective ranking, and diversity re-ranking. Optimizes novelty, serendipity and coverage alongside accuracy, and never serves a pure best-seller list.",
  model: "deepseek/deepseek-v4-pro-0813",
  reasoning: "medium",
  modelOptions: costSortedGateway,
  defaultTools: false,
  limits: domainPrototypeLimits,
});
