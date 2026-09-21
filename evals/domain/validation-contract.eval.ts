import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import {
  validationDecisionSchema,
  validationOutputSchema,
  validationResultSchema,
} from "../../agent/lib/validation/output";
import { validationInputSchema } from "../../agent/lib/validation/input";

const validOutput = {
  directive: "HOLD" as const,
  confidence: 0.8,
  checks: {
    significance: { pass: false, reasoning: "No interval", evidence: "CI missing" },
    guardrails: { pass: true, reasoning: "No breach observed", violations: [] },
    economics: {
      pass: false,
      reasoning: "Insufficient evidence",
      incrementalMargin: 0,
      cost: 100,
      roi: 0,
      buffer: 0,
    },
    measurement: {
      pass: false,
      reasoning: "Unreadable design",
      designQuality: "unreadable" as const,
    },
  },
  directives: [],
  kpisToWatch: [],
  blockers: [],
  jevReview: {
    accepted: true,
    supportProbability: 0.96,
    recommendedDirective: "HOLD" as const,
    model: "typesafe-ai/jev" as const,
  },
  validatedAt: "2026-09-20T12:00:00.000Z",
  validatedBy: "jev" as const,
  schemaVersion: "1.0" as const,
};

export default defineEval({
  description: "JEV validation output is strict and workflow IDs are required",
  async test(t) {
    const decision = {
      ...validOutput,
      validatedAt: undefined,
      validatedBy: undefined,
      schemaVersion: undefined,
    };
    t.check(validationDecisionSchema.safeParse(decision).success, equals(true));
    t.check(validationOutputSchema.safeParse(validOutput).success, equals(true));
    t.check(validationResultSchema.safeParse(validOutput).success, equals(false));
    t.check(
      validationResultSchema.safeParse({ ...validOutput, validationId: "call-123" }).success,
      equals(true),
    );
    t.check(
      validationOutputSchema.safeParse({ ...validOutput, directive: "APPROVE" }).success,
      equals(false),
    );
    t.check(
      validationOutputSchema.safeParse({
        ...validOutput,
        directive: "EXECUTE",
        checks: {
          ...validOutput.checks,
          significance: { pass: false, reasoning: "CI crosses zero", evidence: "[-1, 2]" },
        },
      }).success,
      equals(false),
    );
    t.check(
      validationOutputSchema.safeParse({
        ...validOutput,
        checks: {
          ...validOutput.checks,
          significance: {
            ...validOutput.checks.significance,
            reasoning: "x".repeat(801),
          },
        },
      }).success,
      equals(false),
    );
    t.check(
      validationOutputSchema.safeParse({
        ...validOutput,
        directives: Array.from({ length: 9 }, (_, index) => ({
          team: "data" as const,
          task: `Task ${index}`,
          deadline: "2026-10-01",
          evidence: "Evidence",
          owner: "Owner",
          priority: "P2-this-sprint" as const,
        })),
      }).success,
      equals(false),
    );

    const syntheticUntested = {
      delegate: "promotions" as const,
      brief: {
        objective: "retention" as const,
        kpi: "repeat_rate",
        targetValue: 0.45,
        budget: 100_000,
        currency: "usd",
        deadline: "2026-10-01",
        guardrails: {},
        scope: {
          brands: ["Andina"],
          categories: ["beverages"],
          territories: ["CO-Bogota"],
          channels: ["crm"],
        },
      },
      claimedResult: {
        summary: "Sandbox rehearsal",
        measuredUpliftPct: null,
        significance: "untested" as const,
        spend: 0,
        incrementalRevenue: null,
        incrementalMargin: null,
        provenance: "synthetic" as const,
      },
      measurementDesign: { type: "none" as const, unit: "customer" as const },
    };
    t.check(validationInputSchema.safeParse(syntheticUntested).success, equals(true));
    t.check(
      validationInputSchema.safeParse({
        ...syntheticUntested,
        brief: {
          ...syntheticUntested.brief,
          scope: {
            ...syntheticUntested.brief.scope,
            brands: Array.from({ length: 21 }, (_, index) => `Brand-${index}`),
          },
        },
      }).success,
      equals(false),
    );
    t.check(
      validationInputSchema.safeParse({
        ...syntheticUntested,
        claimedResult: {
          ...syntheticUntested.claimedResult,
          measuredUpliftPct: 5,
          significance: "significant",
        },
      }).success,
      equals(false),
    );
  },
});
