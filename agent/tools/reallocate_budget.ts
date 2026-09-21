import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { planState, redistribute } from "../lib/allocation";
import { serviceSchema } from "../lib/types";

export default defineTool({
  outputSchema: z.object({
    released: z.number().nonnegative(),
    currency: z.string().min(1),
    reason: z.string().min(20),
    before: z.array(z.looseObject({ amount: z.number().nonnegative(), service: serviceSchema })),
    after: z.array(z.looseObject({ amount: z.number().nonnegative(), service: serviceSchema })),
    nextStep: z.string().min(1),
  }),
  availableInSubagents: false,
  approval: always(),
  description:
    "Release budget from services whose measured uplift was not significant and redistribute it across the remaining funded services, in proportion to their plan weights. Call when a sub-agent or the measurement agent reports a non-significant result.",
  inputSchema: z.object({
    releaseFrom: z.array(serviceSchema).min(1),
    validations: z
      .array(
        z.object({
          service: serviceSchema,
          delegationId: z.string().min(1),
          validationId: z.string().min(1),
        }),
      )
      .min(1)
      .describe("One validated not-significant ledger entry for every released service."),
    reason: z.string().min(20).describe("Evidence behind the release, including the measurement read."),
    retainPctOnReleased: z
      .number()
      .min(0)
      .max(100)
      .default(0)
      .describe("Share of the released budget to keep running, e.g. 20 to hold a learning cell."),
  }),
  label: {
    start: ({ releaseFrom }) => `Reallocate budget from ${releaseFrom.join(", ")}`,
  },
  execute(input) {
    const state = planState.get();
    if (!state.plan) {
      throw new Error(
        "No allocation plan in this session. Call allocate_budget before reallocating.",
      );
    }

    const inPlan = new Set(state.plan.lines.map((l) => l.service));
    const absent = input.releaseFrom.filter((s) => !inPlan.has(s));
    if (absent.length > 0) {
      throw new Error(
        `Cannot release budget from ${absent.join(", ")}: not funded in the current plan (funded: ${[...inPlan].join(", ")}). Releasing an unfunded service would report a 0-value reallocation as a success.`,
      );
    }

    const duplicateServices = input.releaseFrom.filter(
      (service, index) => input.releaseFrom.indexOf(service) !== index,
    );
    if (duplicateServices.length > 0) {
      throw new Error(`releaseFrom contains duplicates: ${duplicateServices.join(", ")}.`);
    }
    if (input.validations.length !== input.releaseFrom.length) {
      throw new Error(
        "validations must contain exactly one evidence record for each service in releaseFrom.",
      );
    }
    const validationServices = input.validations.map((item) => item.service);
    if (new Set(validationServices).size !== validationServices.length) {
      throw new Error("validations contains duplicate service evidence.");
    }
    for (const service of input.releaseFrom) {
      const evidence = input.validations.find((item) => item.service === service);
      if (!evidence) {
        throw new Error(`Missing validated evidence for ${service}.`);
      }
      const delegation = state.delegations.find(
        (item) => item.id === evidence.delegationId,
      );
      if (
        !delegation ||
        delegation.delegate !== service ||
        delegation.status !== "validated" ||
        delegation.significance !== "not-significant" ||
        delegation.validationId !== evidence.validationId
      ) {
        throw new Error(
          `Evidence for ${service} must reference a validated, not-significant delegation with the same validationId.`,
        );
      }
    }

    const before = state.plan;
    const { plan, released } = redistribute({
      plan: before,
      releaseFrom: input.releaseFrom,
      retainPctOnReleased: input.retainPctOnReleased,
    });

    const now = new Date().toISOString();
    planState.update((s) => ({
      ...s,
      plan,
      delegations: s.delegations.map((d) =>
        input.validations.some((evidence) => evidence.delegationId === d.id)
          ? { ...d, status: "reallocated" as const, updatedAt: now }
          : d,
      ),
      history: [
        ...s.history,
        `${now} reallocated ${released} ${plan.currency} from ${input.releaseFrom.join(", ")} — ${input.reason}`,
      ],
    }));

    return {
      released,
      currency: plan.currency,
      reason: input.reason,
      before: before.lines,
      after: plan.lines,
      nextStep:
        "Re-brief the receiving services with their revised budgets, and log each re-brief with record_delegation.",
    };
  },
});
