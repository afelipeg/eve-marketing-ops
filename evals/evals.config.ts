import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  // Judge model for LLM-as-judge assertions (optional)
  judge: { model: "typesafe-ai/jev" },
  // No reporters by default; add Braintrust() here if you have a project
  maxConcurrency: 4,
  timeoutMs: 120_000,
});