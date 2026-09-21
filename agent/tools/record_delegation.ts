import { defineTool } from "eve/tools";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { planState, type DelegationRecord } from "../lib/allocation";
import {
  delegateSchema,
  kpiSchema,
  objectiveSchema,
  significanceSchema,
} from "../lib/types";

export default defineTool({
  outputSchema: z.object({
    entry: z.looseObject({
      id: z.string().min(1),
      delegate: delegateSchema,
      status: z.enum(["briefed", "running", "reported", "validated", "reallocated"]),
      updatedAt: z.string().min(1),
    }),
    nextStep: z.string().min(1),
  }),
  availableInSubagents: false,
  description:
    "Record or update the ledger entry for one delegated brief: what was asked of a sub-agent, its budget and deadline, and — once it reports — the result, measured uplift, and significance. Call once when briefing and again after the measurement agent validates.",
  inputSchema: z.object({
    id: z
      .string()
      .optional()
      .describe("Existing entry id to update. Omit to create a new entry."),
    delegate: delegateSchema,
    objective: objectiveSchema,
    kpi: kpiSchema,
    targetValue: z.number().nullable().default(null),
    budget: z.number().min(0),
    currency: z.string().default("USD"),
    deadline: z.string().describe('ISO date or period, e.g. "2026-09-30".'),
    briefSummary: z.string().min(1),
    status: z
      .enum(["briefed", "running", "reported", "validated", "reallocated"])
      .default("briefed"),
    resultSummary: z.string().nullable().default(null),
    measuredUpliftPct: z.number().nullable().default(null),
    significance: significanceSchema.default("untested"),
    validationId: z
      .string()
      .min(1)
      .nullable()
      .default(null)
      .describe("ID of the schema-valid validate_result output used for this status."),
    validationDirective: z
      .enum(["EXECUTE", "REBRIEF", "ESCALATE", "HOLD"])
      .nullable()
      .default(null),
  }),
  label: {
    start: ({ delegate, status }) => `Ledger: ${delegate} → ${status}`,
  },
  execute(input) {
    const state = planState.get();
    const currency = input.currency.trim().toUpperCase();
    const existing = input.id
      ? state.delegations.find((delegation) => delegation.id === input.id)
      : null;

    if (!input.id && input.status !== "briefed") {
      throw new Error("A new delegation must start with status=briefed.");
    }
    if (input.id && !existing) {
      throw new Error(`Delegation ${input.id} does not exist; refusing an implicit upsert.`);
    }
    if (input.status === "reallocated") {
      throw new Error(
        "Only reallocate_budget may set status=reallocated after its approval and evidence checks.",
      );
    }
    if (existing) {
      if (
        existing.delegate !== input.delegate ||
        existing.objective !== input.objective ||
        existing.currency !== currency
      ) {
        throw new Error(
          "delegate, objective, and currency are immutable; create a new delegation for a materially different brief.",
        );
      }
      const allowedTransitions: Record<DelegationRecord["status"], DelegationRecord["status"][]> = {
        briefed: ["briefed", "running", "reported"],
        running: ["running", "reported"],
        reported: ["reported", "validated"],
        validated: ["validated"],
        reallocated: ["reallocated"],
      };
      if (!allowedTransitions[existing.status].includes(input.status)) {
        throw new Error(
          `Invalid delegation transition ${existing.status} -> ${input.status}.`,
        );
      }
    }
    if (input.status === "validated") {
      if (!input.validationId || !input.validationDirective) {
        throw new Error(
          "Validated delegations require validationId and validationDirective from validate_result.",
        );
      }
      if (input.significance === "untested") {
        throw new Error("A validated delegation cannot keep significance=untested.");
      }
    }

    if (!state.plan) {
      throw new Error("No active allocation plan. Allocate a verified budget before recording delegations.");
    }
    if (state.plan.currency !== currency) {
      throw new Error(
        `Delegation currency ${input.currency} does not match plan currency ${state.plan.currency}.`,
      );
    }
    const fundedAmount =
      input.delegate === "measurement"
        ? state.plan.measurementReserve
        : state.plan.lines.find((line) => line.service === input.delegate)?.amount;
    if (fundedAmount === undefined) {
      throw new Error(`${input.delegate} is not funded in the current plan.`);
    }
    if (input.budget > fundedAmount) {
      throw new Error(
        `Delegation budget ${input.budget} exceeds the current ${input.delegate} allocation ${fundedAmount}.`,
      );
    }

    const now = new Date().toISOString();
    const id = input.id ?? `${input.delegate}-${randomUUID()}`;

    const entry: DelegationRecord = {
      id,
      delegate: input.delegate,
      objective: input.objective,
      kpi: input.kpi,
      targetValue: input.targetValue,
      budget: input.budget,
      currency,
      deadline: input.deadline,
      briefSummary: input.briefSummary,
      status: input.status,
      resultSummary: input.resultSummary,
      measuredUpliftPct: input.measuredUpliftPct,
      significance: input.significance,
      validationId: input.validationId,
      validationDirective: input.validationDirective,
      updatedAt: now,
    };

    planState.update((state) => {
      const exists = state.delegations.some((d) => d.id === id);
      return {
        ...state,
        delegations: exists
          ? state.delegations.map((d) => (d.id === id ? { ...d, ...entry } : d))
          : [...state.delegations, entry],
        history: [...state.history, `${now} ${input.delegate}: ${input.status}`],
      };
    });

    const needsMeasurement =
      input.status === "reported" && input.significance === "untested";
    const shouldReallocate = input.significance === "not-significant";

    return {
      entry,
      nextStep: shouldReallocate
        ? "Uplift not significant: call reallocate_budget to release this service's budget to the significant ones, and say so explicitly in the response."
        : needsMeasurement
          ? "Result recorded but unvalidated: delegate validation to the measurement agent before treating the uplift as real."
          : "Recorded.",
    };
  },
});
