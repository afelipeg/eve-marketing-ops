import { defineWorkflowTool } from "eve/tools";
import { validationInputSchema } from "../lib/validation/input";
import { getValidationOutputJsonSchema } from "../lib/validation/output-json-schema";
import { buildJevPrompt } from "../lib/validation/prompt";
import { validationTimestamp } from "../lib/validation/stamp";
import { reviewValidationDecision } from "../lib/validation/review";
import {
  validationResultSchema,
  type ValidationDecision,
} from "../lib/validation/output";

export default defineWorkflowTool({
  availableInSubagents: false,
  description:
    "Run the hidden JEV validation specialist over a structured specialist result. The workflow enforces the validation input and output schemas and returns EXECUTE, REBRIEF, ESCALATE, or HOLD. This validates a recommendation; it never executes it.",
  inputSchema: validationInputSchema,
  outputSchema: validationResultSchema,
  label: {
    start: ({ delegate }) => `Validate ${delegate} result with JEV`,
  },
  async execute(input, ctx) {
    "use workflow";

    if (!ctx.agents.validation) {
      throw new Error("The hidden validation subagent is not available to this workflow.");
    }

    const prompt = await buildJevPrompt(input);
    const outputSchema = await getValidationOutputJsonSchema();
    const decision = (await ctx.agent("validation", {
      message: prompt,
      outputSchema,
    })) as ValidationDecision;

    const jevReview = await reviewValidationDecision(input, decision, ctx.abortSignal);
    const validatedAt = await validationTimestamp();

    // A JEV disagreement fails closed to REBRIEF. We preserve the candidate
    // checks for auditability and add an explicit blocker instead of silently
    // overwriting the evidence or pretending the candidate was accepted.
    const finalDecision = jevReview.accepted
      ? decision
      : {
          ...decision,
          directive: "REBRIEF" as const,
          confidence: Math.min(decision.confidence, jevReview.supportProbability),
          blockers: [
            ...decision.blockers,
            {
              blocker: "JEV independent review did not accept the candidate decision.",
              impact: `Candidate=${decision.directive}; JEV=${jevReview.recommendedDirective}; support=${jevReview.supportProbability.toFixed(3)}.`,
              resolutionOwner: "Measurement Lead",
              resolutionDeadline: input.brief.deadline,
            },
          ],
        };

    return {
      validationId: ctx.callId,
      ...finalDecision,
      jevReview,
      validatedAt,
      validatedBy: "jev" as const,
      schemaVersion: "1.0" as const,
    };
  },
});
