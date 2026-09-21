import { z } from "zod";

/**
 * Domain vocabulary for the algorithmic marketing system.
 *
 * Service taxonomy follows Ilya Katsov, "Introduction to Algorithmic Marketing".
 * This system implements four of the book's programmatic services —
 * promotions, advertisements, recommendations and pricing — plus measurement,
 * the validation service that scores every other service's incremental
 * contribution. Search and assortment are deliberately out of scope: they are
 * handled outside this system, so they are absent from the vocabulary and
 * cannot be delegated to.
 */

export const SERVICES = [
  "promotions",
  "advertisements",
  "recommendations",
  "pricing",
] as const;

export const serviceSchema = z.enum(SERVICES);
export type Service = z.infer<typeof serviceSchema>;

/** Every delegable agent, including the validation service. */
export const delegateSchema = z.enum([...SERVICES, "measurement"]);
export type Delegate = z.infer<typeof delegateSchema>;

/**
 * Business objectives the orchestrator accepts as input.
 * - acquisition:  win new customers / new buyers of a brand
 * - maximization: grow share of wallet, basket size, cross-sell
 * - retention:    reduce churn, lift repeat rate, protect LTV
 * - revenue:      maximize revenue or margin from the installed base
 */
export const objectiveSchema = z.enum([
  "acquisition",
  "maximization",
  "retention",
  "revenue",
]);
export type Objective = z.infer<typeof objectiveSchema>;

/** Primary metric a brief commits to. Keep the list explicit so briefs stay comparable. */
export const kpiSchema = z.enum([
  "roi",
  "roas",
  "incremental_revenue",
  "incremental_margin",
  "uplift_pct",
  "cac",
  "ltv",
  "repeat_rate",
  "churn_rate",
  "aov",
  "units",
  "som",
  "gross_margin_pct",
]);
export type Kpi = z.infer<typeof kpiSchema>;

export const significanceSchema = z.enum([
  "significant",
  "not-significant",
  "untested",
]);
export type Significance = z.infer<typeof significanceSchema>;

/** Where a number came from. Never present `sample` numbers as the client's real data. */
export const provenanceSchema = z.enum(["external", "sample", "none"]);
export type Provenance = z.infer<typeof provenanceSchema>;

export const kpiRecordSchema = z.object({
  period: z.string().min(1),
  brand: z.string().min(1),
  category: z.string().min(1),
  territory: z.string().min(1),
  service: z.union([serviceSchema, z.literal("baseline")]),
  currency: z.string().min(1).transform((value) => value.trim().toUpperCase()).default("USD"),
  spend: z.number().nonnegative(),
  revenue: z.number().nonnegative(),
  grossMargin: z.number(),
  units: z.number().nonnegative(),
  orders: z.number().int().nonnegative(),
  newCustomers: z.number().int().nonnegative(),
  returningCustomers: z.number().int().nonnegative(),
  upliftPct: z.number().nullable().default(null),
  significance: significanceSchema.default("untested"),
});
export type KpiRecord = z.infer<typeof kpiRecordSchema>;

export const budgetEnvelopeSchema = z.object({
  period: z.string().min(1),
  territory: z.string().min(1),
  service: delegateSchema,
  currency: z.string().min(1).transform((value) => value.trim().toUpperCase()).default("USD"),
  planned: z.number().nonnegative(),
  committed: z.number().nonnegative(),
  spent: z.number().nonnegative(),
});
export type BudgetEnvelope = z.infer<typeof budgetEnvelopeSchema>;

/** Constraints the orchestrator must verify before it delegates anything. */
export const constraintsSchema = z.object({
  maxBudget: z.number().nonnegative().optional(),
  minMarginPct: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Margin fraction from 0 to 1; use 0.35 for 35%."),
  stockCoverWeeks: z.number().nonnegative().optional(),
  capacityNote: z.string().min(1).optional(),
  brandEquityGuardrails: z.string().min(1).optional(),
  legalOrPricingFloor: z.string().min(1).optional(),
});
export type Constraints = z.infer<typeof constraintsSchema>;
