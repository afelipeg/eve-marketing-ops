import { defineAgent } from "eve";
import { costSortedGateway, rootPrototypeLimits } from "./lib/runtime-budgets";

export default defineAgent({
  description:
    "Marketing Operations Orchestrator: turns a business objective into a measured plan, allocates budget across the programmatic marketing services, delegates briefs to them, and reallocates on non-significant uplift.",
  model: "anthropic/claude-sonnet-5",
  reasoning: "medium",
  modelOptions: costSortedGateway,
  // This business agent does not need a shell, arbitrary file writes, or open
  // web access. Authored tools below are its complete execution surface.
  defaultTools: false,
  limits: rootPrototypeLimits,
  // The planner delegates to declared specialists, never to an unscoped copy of itself.
  tool: false,
});
