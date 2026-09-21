import { defineAgent } from "eve";
import { costSortedGateway, validationPrototypeLimits } from "../../lib/runtime-budgets";

export default defineAgent({
  description:
    "Validation specialist. Receives a structured validation request (brief + claimed result + measurement design), evaluates it against explicit evidence, and returns EXECUTE/REBRIEF/ESCALATE/HOLD with team directives. Never executes actions and never invents missing evidence.",
  // JEV is an evaluation model, not a language model. This specialist drafts
  // the structured decision; validate_result then judges it with JEV through
  // eve/ai evaluate() before returning it.
  model: "openai/gpt-5.6-luna",
  reasoning: "low",
  modelOptions: costSortedGateway,
  defaultTools: false,
  limits: validationPrototypeLimits,
  // Hidden from the model; agent/tools/validate_result.ts invokes it through
  // a typed durable workflow and validates its structured output.
  tool: false,
});
