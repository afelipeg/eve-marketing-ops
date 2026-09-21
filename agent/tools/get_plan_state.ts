import { defineTool } from "eve/tools";
import { z } from "zod";
import { planState } from "../lib/allocation";

export default defineTool({
  outputSchema: z.looseObject({
    delegations: z.array(z.looseObject({})),
    history: z.array(z.string()),
    plan: z.looseObject({}).nullable(),
    summary: z.object({
      hasPlan: z.boolean(),
      delegationCount: z.number().int().nonnegative(),
      pendingValidation: z.array(z.string()),
      awaitingReallocation: z.array(z.string()),
    }),
  }),
  availableInSubagents: false,
  description:
    "Read the session's current plan: objective, verified constraints, budget allocation, every delegated brief with its status and measured result, and the decision history. Call before answering status questions or re-planning, so the answer reflects what was actually decided.",
  inputSchema: z.object({}),
  label: { start: () => "Read current plan state" },
  execute() {
    const state = planState.get();

    const pendingValidation = state.delegations.filter(
      (d) => d.status === "reported" && d.significance === "untested",
    );
    const notSignificant = state.delegations.filter(
      (d) => d.significance === "not-significant" && d.status !== "reallocated",
    );

    return {
      ...state,
      summary: {
        hasPlan: state.plan !== null,
        delegationCount: state.delegations.length,
        pendingValidation: pendingValidation.map((d) => d.id),
        awaitingReallocation: notSignificant.map((d) => d.id),
      },
    };
  },
});
