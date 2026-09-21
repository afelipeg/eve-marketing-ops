import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  DEFAULT_KPI_BY_OBJECTIVE,
  DEFAULT_MEASUREMENT_RESERVE_PCT,
  assertBudgetCheck,
  buildAllocation,
  planState,
} from "../lib/allocation";
import { constraintsSchema, objectiveSchema, serviceSchema } from "../lib/types";

export default defineTool({
  outputSchema: z.looseObject({
    plan: z.looseObject({
      currency: z.string().min(1),
      lines: z.array(z.looseObject({ amount: z.number().nonnegative(), service: serviceSchema })),
      measurementReserve: z.number().nonnegative(),
      totalBudget: z.number().positive(),
    }),
    defaultKpi: z.string().min(1),
    nextStep: z.string().min(1),
  }),
  // Only the top-level orchestrator plans budget. Sub-agents receive a brief.
  availableInSubagents: false,
  description:
    "Split a total budget across the four programmatic services using the Allocation-by-Objective priors (acquisition, maximization, retention, revenue), hold back a measurement reserve, and store the result as the session's current plan. Call after the objective is translated into a metric and after constraints are verified with get_budget/get_kpi_history.",
  inputSchema: z.object({
    objective: objectiveSchema,
    period: z.string().describe('Planning period, e.g. "2026-Q3".'),
    territory: z.string().default("all"),
    totalBudget: z.number().positive(),
    currency: z.string().default("USD"),
    budgetCheck: z.object({
      available: z.number().nonnegative(),
      currency: z.string().min(1),
      provenance: z.enum(["external", "sample"]),
      source: z.string().min(1),
    }).describe(
      "Copy these fields from the matching get_budget result. Allocation fails when the requested amount exceeds that verified envelope or uses another currency.",
    ),
    measurementReservePct: z
      .number()
      .min(0)
      .max(99)
      .default(DEFAULT_MEASUREMENT_RESERVE_PCT),
    weightOverrides: z
      // partialRecord, not record: Zod 4's z.record over an enum key requires
      // EVERY key, which would reject the partial override this parameter
      // exists for. partialRecord also rejects out-of-vocabulary services by
      // name ("Unrecognized key: search") instead of failing obscurely.
      .partialRecord(serviceSchema, z.number().min(0))
      .optional()
      .describe(
        "Replace prior weights where measured marginal ROI exists. Partial maps are expected: any service you omit keeps its objective prior, and the whole set is then renormalized to sum to 1 across the funded services.",
      ),
    excludeServices: z
      .array(serviceSchema)
      .optional()
      .describe("Services blocked by a constraint (no stock, price floor, capacity)."),
    constraints: constraintsSchema.optional(),
  }),
  label: {
    start: ({ objective, totalBudget, currency, period }) =>
      `Allocate ${totalBudget} ${currency} for ${objective} · ${period}`,
  },
  execute(input) {
    const requestedCurrency = assertBudgetCheck({
      totalBudget: input.totalBudget,
      currency: input.currency,
      budgetCheck: input.budgetCheck,
      maxBudget: input.constraints?.maxBudget,
    });
    const verifiedCurrency = input.budgetCheck.currency.trim().toUpperCase();

    const plan = buildAllocation({
      objective: input.objective,
      period: input.period,
      territory: input.territory,
      currency: requestedCurrency,
      totalBudget: input.totalBudget,
      measurementReservePct: input.measurementReservePct,
      weightOverrides: input.weightOverrides,
      excludeServices: input.excludeServices,
    });

    planState.update((state) => ({
      ...state,
      objective: input.objective,
      constraints: input.constraints ?? state.constraints,
      verifiedBudget: {
        ...input.budgetCheck,
        currency: verifiedCurrency,
        verifiedAt: plan.createdAt,
      },
      plan,
      history: [
        ...state.history,
        `${plan.createdAt} allocated ${plan.totalBudget} ${plan.currency} for ${input.objective} (${input.period}/${input.territory})`,
      ],
    }));

    return {
      plan,
      defaultKpi: DEFAULT_KPI_BY_OBJECTIVE[input.objective],
      nextStep:
        "Write one brief per funded service (objective, KPI, target, budget, deadline, constraints, brand equity guardrails), delegate it, then record it with record_delegation.",
    };
  },
});
