import { defineState } from "eve/context";
import type {
  Constraints,
  Delegate,
  Kpi,
  Objective,
  Service,
  Significance,
} from "./types";
import { SERVICES } from "./types";

/**
 * Allocation by Objective.
 *
 * Priors, not truths. They give the orchestrator a defensible starting split
 * when no measured response curve exists yet. Each objective weights the four
 * programmatic services by how much of the objective's mechanism they own
 * (Katsov, "Introduction to Algorithmic Marketing", service taxonomy).
 *
 * Replace a row with measured marginal ROI as soon as the measurement agent
 * returns significant response curves for the period.
 */
export const OBJECTIVE_WEIGHTS: Record<Objective, Record<Service, number>> = {
  acquisition: {
    advertisements: 0.50,
    promotions: 0.29,
    pricing: 0.14,
    recommendations: 0.07,
  },
  maximization: {
    recommendations: 0.4,
    promotions: 0.27,
    pricing: 0.27,
    advertisements: 0.06,
  },
  retention: {
    promotions: 0.35,
    recommendations: 0.29,
    pricing: 0.18,
    advertisements: 0.18,
  },
  revenue: {
    pricing: 0.42,
    promotions: 0.21,
    recommendations: 0.21,
    advertisements: 0.16,
  },
};

/** Default share held back for holdouts, geo-tests, and incrementality reads. */
export const DEFAULT_MEASUREMENT_RESERVE_PCT = 10;

export const DEFAULT_KPI_BY_OBJECTIVE: Record<Objective, Kpi> = {
  acquisition: "cac",
  maximization: "aov",
  retention: "repeat_rate",
  revenue: "incremental_margin",
};

export type AllocationLine = {
  service: Service;
  weightPct: number;
  amount: number;
};

export type AllocationPlan = {
  objective: Objective;
  period: string;
  territory: string;
  currency: string;
  totalBudget: number;
  measurementReservePct: number;
  measurementReserve: number;
  allocatable: number;
  lines: AllocationLine[];
  weightSource: "objective-prior" | "objective-prior+override";
  notes: string[];
  createdAt: string;
};

export type DelegationRecord = {
  id: string;
  delegate: Delegate;
  objective: Objective;
  kpi: Kpi;
  targetValue: number | null;
  budget: number;
  currency: string;
  deadline: string;
  briefSummary: string;
  status: "briefed" | "running" | "reported" | "validated" | "reallocated";
  resultSummary: string | null;
  measuredUpliftPct: number | null;
  significance: Significance;
  validationId: string | null;
  validationDirective: "EXECUTE" | "REBRIEF" | "ESCALATE" | "HOLD" | null;
  updatedAt: string;
};

export type PlanState = {
  objective: Objective | null;
  constraints: Constraints | null;
  verifiedBudget: {
    available: number;
    currency: string;
    provenance: "external" | "sample";
    source: string;
    verifiedAt: string;
  } | null;
  plan: AllocationPlan | null;
  delegations: DelegationRecord[];
  history: string[];
};

/** Durable per-session plan. Survives turns, crashes, and redeploys. */
export const planState = defineState<PlanState>(
  "marketing-ops.plan",
  () => ({
    objective: null,
    constraints: null,
    verifiedBudget: null,
    plan: null,
    delegations: [],
    history: [],
  }),
);

const round2 = (n: number) => Math.round(n * 100) / 100;

export function assertBudgetCheck(input: {
  totalBudget: number;
  currency: string;
  budgetCheck: {
    available: number;
    currency: string;
  };
  maxBudget?: number;
}): string {
  const requestedCurrency = input.currency.trim().toUpperCase();
  const verifiedCurrency = input.budgetCheck.currency.trim().toUpperCase();
  if (requestedCurrency !== verifiedCurrency) {
    throw new Error(
      `Budget currency mismatch: requested ${requestedCurrency}, verified ${verifiedCurrency}. Re-run get_budget with a single-currency slice.`,
    );
  }
  if (input.totalBudget > input.budgetCheck.available) {
    throw new Error(
      `Requested budget ${input.totalBudget} ${requestedCurrency} exceeds verified availability ${input.budgetCheck.available} ${verifiedCurrency}.`,
    );
  }
  if (input.maxBudget !== undefined && input.totalBudget > input.maxBudget) {
    throw new Error(
      `Requested budget ${input.totalBudget} exceeds constraints.maxBudget ${input.maxBudget}.`,
    );
  }
  return requestedCurrency;
}

/** Normalize a partial weight map to sum to 1 across the four services. */
export function normalizeWeights(
  weights: Partial<Record<Service, number>>,
): Record<Service, number> {
  const filled = Object.fromEntries(
    SERVICES.map((s) => [s, Math.max(0, weights[s] ?? 0)]),
  ) as Record<Service, number>;

  const total = SERVICES.reduce((sum, s) => sum + filled[s], 0);
  if (total <= 0) {
    throw new Error("Weight overrides sum to zero; cannot allocate a budget.");
  }

  return Object.fromEntries(
    SERVICES.map((s) => [s, filled[s] / total]),
  ) as Record<Service, number>;
}

export function buildAllocation(input: {
  objective: Objective;
  period: string;
  territory: string;
  currency: string;
  totalBudget: number;
  measurementReservePct?: number;
  weightOverrides?: Partial<Record<Service, number>>;
  excludeServices?: Service[];
}): AllocationPlan {
  const {
    objective,
    period,
    territory,
    currency,
    totalBudget,
    weightOverrides,
    excludeServices = [],
  } = input;

  if (totalBudget <= 0) {
    throw new Error("totalBudget must be greater than zero.");
  }

  const reservePct = input.measurementReservePct ?? DEFAULT_MEASUREMENT_RESERVE_PCT;
  if (reservePct < 0 || reservePct >= 100) {
    throw new Error("measurementReservePct must be between 0 and 100.");
  }

  const prior = OBJECTIVE_WEIGHTS[objective];
  const merged: Partial<Record<Service, number>> = {};
  for (const service of SERVICES) {
    if (excludeServices.includes(service)) continue;
    merged[service] = weightOverrides?.[service] ?? prior[service];
  }

  const weights = normalizeWeights(merged);
  const measurementReserve = round2((totalBudget * reservePct) / 100);
  const allocatable = round2(totalBudget - measurementReserve);

  const lines: AllocationLine[] = SERVICES.filter(
    (service) => weights[service] > 0,
  )
    .map((service) => ({
      service,
      weightPct: round2(weights[service] * 100),
      amount: round2(allocatable * weights[service]),
    }))
    .sort((a, b) => b.amount - a.amount);

  // Rounded lines must still reconcile exactly to the allocatable envelope.
  const allocated = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  const roundingDelta = round2(allocatable - allocated);
  if (lines.length > 0 && roundingDelta !== 0) {
    lines[0] = { ...lines[0], amount: round2(lines[0].amount + roundingDelta) };
  }

  const notes = [
    `Weights are objective priors for "${objective}", not measured response curves.`,
    `${reservePct}% held back for measurement (holdouts, geo-tests, incrementality reads).`,
  ];
  if (excludeServices.length > 0) {
    notes.push(`Excluded by constraint: ${excludeServices.join(", ")}.`);
  }
  if (weightOverrides && Object.keys(weightOverrides).length > 0) {
    notes.push(
      `Operator overrides applied to: ${Object.keys(weightOverrides).join(", ")}.`,
    );
  }

  return {
    objective,
    period,
    territory,
    currency,
    totalBudget: round2(totalBudget),
    measurementReservePct: reservePct,
    measurementReserve,
    allocatable,
    lines,
    weightSource:
      weightOverrides && Object.keys(weightOverrides).length > 0
        ? "objective-prior+override"
        : "objective-prior",
    notes,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Pull budget out of services whose uplift was not significant and redistribute
 * it across the services that still carry measured or unresolved signal.
 */
export function redistribute(input: {
  plan: AllocationPlan;
  releaseFrom: Service[];
  retainPctOnReleased?: number;
}): { plan: AllocationPlan; released: number; perService: AllocationLine[] } {
  const { plan, releaseFrom, retainPctOnReleased = 0 } = input;
  const retain = Math.min(Math.max(retainPctOnReleased, 0), 100) / 100;

  const receivers = plan.lines.filter((l) => !releaseFrom.includes(l.service));
  if (receivers.length === 0) {
    throw new Error(
      "Every service in the plan was released; nothing left to receive the budget.",
    );
  }

  let released = 0;
  const kept: AllocationLine[] = plan.lines.map((line) => {
    if (!releaseFrom.includes(line.service)) return line;
    const keepAmount = round2(line.amount * retain);
    released = round2(released + (line.amount - keepAmount));
    return { ...line, amount: keepAmount };
  });

  const receiverWeight = receivers.reduce((sum, l) => sum + l.weightPct, 0);
  const lines = kept
    .map((line) => {
      if (releaseFrom.includes(line.service)) return line;
      const share = line.weightPct / receiverWeight;
      return { ...line, amount: round2(line.amount + released * share) };
    })
    .sort((a, b) => b.amount - a.amount);

  const beforeTotal = round2(plan.lines.reduce((sum, line) => sum + line.amount, 0));
  const afterTotal = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  const roundingDelta = round2(beforeTotal - afterTotal);
  if (roundingDelta !== 0) {
    const receiverIndex = lines.findIndex(
      (line) => !releaseFrom.includes(line.service),
    );
    lines[receiverIndex] = {
      ...lines[receiverIndex],
      amount: round2(lines[receiverIndex].amount + roundingDelta),
    };
  }

  const nextPlan: AllocationPlan = {
    ...plan,
    lines,
    notes: [
      ...plan.notes,
      `Reallocated ${released} ${plan.currency} away from: ${releaseFrom.join(", ")} (not-significant uplift).`,
    ],
  };

  return { plan: nextPlan, released, perService: lines };
}
