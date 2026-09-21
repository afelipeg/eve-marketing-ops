import { evaluate } from "eve/ai";
import type { ValidationInput } from "./input";
import type { ValidationDecision } from "./output";

const DIRECTIVE_CRITERIA = {
  EXECUTE: "All four checks pass, evidence is sufficient, and there are no unresolved blockers.",
  REBRIEF: "The proposal is measurable but one or more fixable checks or evidence gaps require a revised brief.",
  ESCALATE: "A legal, brand, pricing-threshold, or other critical guardrail breach requires a human decision.",
  HOLD: "The measurement design or evidence is insufficient to read the result; a new test/read is required.",
} as const;

export async function reviewValidationDecision(
  input: ValidationInput,
  decision: ValidationDecision,
  abortSignal: AbortSignal,
) {
  "use step";

  const result = await evaluate({
    model: "typesafe-ai/jev",
    state: { input, candidateDecision: decision },
    questions: {
      supported: {
        type: "boolean",
        instructions:
          "Is every material claim and check in candidateDecision supported by the supplied input, arithmetically coherent, and free of invented evidence? Return true only when the candidate is safe to use as an independent validation gate.",
        criteria: {
          true: "Evidence, arithmetic, guardrails, measurement design, and directive are mutually consistent.",
          false: "Any evidence is missing/invented, arithmetic is incoherent, or the directive conflicts with the checks.",
        },
      },
      directive: {
        type: "choice",
        instructions:
          "Choose the directive justified by the supplied input. Synthetic or sample evidence may support rehearsal but must not be treated as production authorization.",
        criteria: DIRECTIVE_CRITERIA,
      },
    },
    abortSignal,
    // One retry keeps the prototype resilient without allowing a long or
    // expensive evaluation retry chain. The workflow remains fail-closed.
    maxRetries: 1,
  });

  const supportProbability = result.answers.supported.probability;
  const recommendedDirective = result.answers.directive.choice;
  return {
    accepted: supportProbability >= 0.8 && recommendedDirective === decision.directive,
    supportProbability,
    recommendedDirective,
    model: "typesafe-ai/jev" as const,
  };
}
