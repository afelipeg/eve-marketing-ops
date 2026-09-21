import { defineAgent } from "eve";
import { costSortedGateway, domainPrototypeLimits } from "../../lib/runtime-budgets";

export default defineAgent({
  description:
    "Programmatic advertising specialist. Runs the RTB pipeline: brand proximity phi(u), ad response psi_a(u), inventory quality omega_a(u,i), bid b(u) = b_base·s1(psi)·s2(omega/omega_bar) into second-price exchanges, with budget pacing, fraud and viewability discounting, frequency control, and causal V_k* attribution. Optimizes incremental conversions and CPA, never impression volume.",
  model: "deepseek/deepseek-v4-pro-0813",
  reasoning: "medium",
  modelOptions: costSortedGateway,
  defaultTools: false,
  limits: domainPrototypeLimits,
});
