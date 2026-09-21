import { z } from "zod";

const labelSchema = z.string().trim().min(1).max(120);
const conciseTextSchema = z.string().trim().min(1).max(800);

/** ============================================================
 *  TEAM DIRECTIVE — una acción concreta para un equipo
 * ============================================================ */
export const teamDirectiveSchema = z.object({
  team: z.enum(["growth", "creative", "data", "media", "pricing", "crm", "field", "finance", "legal", "brand"]),
  task: conciseTextSchema,
  deadline: z.union([z.iso.date(), z.iso.datetime()]),
  evidence: conciseTextSchema,
  owner: labelSchema,
  priority: z.enum(["P0-blocker", "P1-this-week", "P2-this-sprint", "P3-backlog"]),
  dependencies: z.array(labelSchema).max(8).optional(),
});

/** ============================================================
 *  INDIVIDUAL CHECK RESULTS
 * ============================================================ */
export const significanceCheckSchema = z.object({
  pass: z.boolean(),
  reasoning: conciseTextSchema,
  evidence: conciseTextSchema,
});

export const guardrailsCheckSchema = z.object({
  pass: z.boolean(),
  reasoning: conciseTextSchema,
  violations: z.array(z.object({
    guardrail: labelSchema,
    limit: z.number(),
    actual: z.number(),
    severity: z.enum(["warning", "breach"]),
  })).max(8).optional(),
});

export const economicsCheckSchema = z.object({
  pass: z.boolean(),
  reasoning: conciseTextSchema,
  incrementalMargin: z.number(),
  cost: z.number().nonnegative(),
  roi: z.number(),
  buffer: z.number().nonnegative(),
});

export const measurementCheckSchema = z.object({
  pass: z.boolean(),
  reasoning: conciseTextSchema,
  designQuality: z.enum(["clean", "acceptable", "contaminated", "unreadable"]),
  mdeVsObserved: z.number().optional(),
});

export const checksSchema = z.object({
  significance: significanceCheckSchema,
  guardrails: guardrailsCheckSchema,
  economics: economicsCheckSchema,
  measurement: measurementCheckSchema,
});

/** ============================================================
 *  KPI TO WATCH — métricas a monitorear post-validación
 * ============================================================ */
export const kpiToWatchSchema = z.object({
  kpi: labelSchema,
  currentValue: z.number(),
  threshold: z.number(),
  direction: z.enum(["above", "below"]),
  alertChannel: labelSchema.optional(),
});

/** ============================================================
 *  BLOCKER — algo que impide avanzar
 * ============================================================ */
export const blockerSchema = z.object({
  blocker: conciseTextSchema,
  impact: conciseTextSchema,
  resolutionOwner: labelSchema,
  resolutionDeadline: z.union([z.iso.date(), z.iso.datetime()]).optional(),
});

/** ============================================================
 *  VALIDATION OUTPUT — salida completa de JEV
 * ============================================================ */
export const validationDecisionSchema = z.object({
  directive: z.enum(["EXECUTE", "REBRIEF", "ESCALATE", "HOLD"]),
  confidence: z.number().min(0).max(1),
  checks: checksSchema,
  directives: z.array(teamDirectiveSchema).max(8),
  kpisToWatch: z.array(kpiToWatchSchema).max(8),
  blockers: z.array(blockerSchema).max(8),
}).superRefine((value, ctx) => {
  const checks = Object.values(value.checks);
  if (value.directive === "EXECUTE" && checks.some((check) => !check.pass)) {
    ctx.addIssue({
      code: "custom",
      path: ["directive"],
      message: "EXECUTE requires every validation check to pass",
    });
  }
  if (value.directive === "EXECUTE" && value.blockers.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["blockers"],
      message: "EXECUTE cannot include unresolved blockers",
    });
  }
  if (value.directive === "HOLD" && value.checks.measurement.pass) {
    ctx.addIssue({
      code: "custom",
      path: ["checks", "measurement", "pass"],
      message: "HOLD requires the measurement check to fail",
    });
  }
});

export const validationOutputSchema = validationDecisionSchema.safeExtend({
  jevReview: z.object({
    accepted: z.boolean(),
    supportProbability: z.number().min(0).max(1),
    recommendedDirective: z.enum(["EXECUTE", "REBRIEF", "ESCALATE", "HOLD"]),
    model: z.literal("typesafe-ai/jev"),
  }),
  validatedAt: z.iso.datetime(),
  validatedBy: z.literal("jev"),
  schemaVersion: z.literal("1.0"),
});

export type TeamDirective = z.infer<typeof teamDirectiveSchema>;
export type ValidationDecision = z.infer<typeof validationDecisionSchema>;
export type JevReview = z.infer<typeof validationOutputSchema>["jevReview"];
export type ValidationOutput = z.infer<typeof validationOutputSchema>;
export const validationResultSchema = validationOutputSchema.extend({
  validationId: z.string().min(1),
});
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type SignificanceCheck = z.infer<typeof significanceCheckSchema>;
export type GuardrailsCheck = z.infer<typeof guardrailsCheckSchema>;
export type EconomicsCheck = z.infer<typeof economicsCheckSchema>;
export type MeasurementCheck = z.infer<typeof measurementCheckSchema>;
export type Checks = z.infer<typeof checksSchema>;
export type KpiToWatch = z.infer<typeof kpiToWatchSchema>;
export type Blocker = z.infer<typeof blockerSchema>;
