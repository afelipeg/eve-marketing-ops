import { z } from "zod";

const labelSchema = z.string().trim().min(1).max(120);

const delegateSchema = z.enum([
  "promotions",
  "advertisements",
  "recommendations",
  "pricing",
  "measurement",
]);

const claimedResultSchema = z.object({
  summary: z.string().trim().min(1).max(2_000),
  measuredUpliftPct: z.number().finite().nullable(),
  upliftCiLow: z.number().finite().nullable().optional(),
  upliftCiHigh: z.number().finite().nullable().optional(),
  powerAchieved: z.number().min(0).max(1).optional(),
  significance: z.enum(["significant", "not-significant", "untested"]),
  spend: z.number().nonnegative(),
  incrementalRevenue: z.number().finite().nullable(),
  incrementalMargin: z.number().finite().nullable(),
  provenance: z.enum(["external", "sample", "synthetic", "none"]),

  upliftBreakdown: z.object({
    incremental: z.number().finite(),
    switched: z.number().finite(),
    pulledForward: z.number().finite(),
    sleepingDogDestruction: z.number().finite().optional(),
  }).optional(),
  targetingDepth: z.number().min(0).max(1).optional(),
  discountDepth: z.number().min(0).max(100).optional(),
  redemptionRate: z.number().min(0).max(1).optional(),

  roas: z.number().nonnegative().optional(),
  cpa: z.number().nonnegative().optional(),
  viewabilityRate: z.number().min(0).max(1).optional(),
  fraudRate: z.number().min(0).max(1).optional(),
  frequency: z.number().nonnegative().optional(),
  brandProximityScore: z.number().finite().optional(),
  inventoryQualityScore: z.number().finite().optional(),

  elasticityEstimate: z.number().finite().optional(),
  crossElasticity: z.record(labelSchema, z.number().finite()).optional(),
  priceChangePct: z.number().finite().optional(),
  volumeImpactPct: z.number().finite().optional(),
  marginImpactPct: z.number().finite().optional(),
  cannibalizationMatrix: z.record(labelSchema, z.number().finite()).optional(),
  psychologicalThresholdBreached: z.boolean().optional(),

  ctr: z.number().min(0).max(1).optional(),
  cvr: z.number().min(0).max(1).optional(),
  diversity: z.number().min(0).max(1).optional(),
  novelty: z.number().min(0).max(1).optional(),
  serendipity: z.number().min(0).max(1).optional(),
  coldStartCoverage: z.number().min(0).max(1).optional(),
  popularityBias: z.number().min(0).max(1).optional(),

  pValue: z.number().min(0).max(1).optional(),
  qiniCoefficient: z.number().finite().optional(),
  poolingMethod: z.enum(["none", "gibbs", "hierarchical"]).optional(),
});

/**
 * One root object is intentional. AI Gateway/Anthropic requires every custom
 * tool input schema to declare `type: "object"` at the root; a top-level Zod
 * discriminated union serializes as oneOf/anyOf and is rejected upstream.
 */
export const validationInputSchema = z.object({
  delegate: delegateSchema,
  brief: z.object({
    objective: z.enum(["acquisition", "maximization", "retention", "revenue"]),
    kpi: labelSchema,
    targetValue: z.number().finite(),
    budget: z.number().nonnegative(),
    currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("USD"),
    deadline: z.union([z.iso.date(), z.iso.datetime()]),
    guardrails: z.object({
      minMarginPct: z.number().min(0).max(1).optional(),
      priceFloor: z.number().nonnegative().optional(),
      stockCoverWeeks: z.number().nonnegative().optional(),
      brandEquityMaxDiscount: z.number().min(0).max(100).optional(),
      capacityNote: z.string().trim().min(1).max(1_000).optional(),
    }),
    scope: z.object({
      brands: z.array(labelSchema).min(1).max(20),
      categories: z.array(labelSchema).min(1).max(20),
      territories: z.array(labelSchema).min(1).max(20),
      channels: z.array(labelSchema).min(1).max(20),
    }),
  }),
  claimedResult: claimedResultSchema,
  measurementDesign: z.object({
    type: z.enum(["randomized", "geo-holdout", "switchback", "observational", "none"]),
    unit: z.enum(["customer", "session", "geo", "store"]),
    sampleSize: z.number().int().positive().optional(),
    mde: z.number().positive().optional(),
    holdoutIds: z.array(labelSchema).max(50).optional(),
    contaminationRisk: z.enum(["low", "medium", "high"]).optional(),
  }).optional(),
}).superRefine((input, ctx) => {
  const result = input.claimedResult;
  const design = input.measurementDesign;
  const low = result.upliftCiLow;
  const high = result.upliftCiHigh;

  for (const field of ["crossElasticity", "cannibalizationMatrix"] as const) {
    const record = result[field];
    if (record && Object.keys(record).length > 50) {
      ctx.addIssue({
        code: "custom",
        path: ["claimedResult", field],
        message: `${field} is limited to 50 entries in the prototype contract`,
      });
    }
  }

  if (low != null && high != null && low > high) {
    ctx.addIssue({
      code: "custom",
      path: ["claimedResult", "upliftCiLow"],
      message: "upliftCiLow must be less than or equal to upliftCiHigh",
    });
  }

  if (result.measuredUpliftPct != null && low != null && high != null &&
      (result.measuredUpliftPct < low || result.measuredUpliftPct > high)) {
    ctx.addIssue({
      code: "custom",
      path: ["claimedResult", "measuredUpliftPct"],
      message: "measuredUpliftPct must fall inside the supplied interval",
    });
  }

  if (result.significance !== "untested") {
    if (result.measuredUpliftPct == null || low == null || high == null) {
      ctx.addIssue({
        code: "custom",
        path: ["claimedResult"],
        message: "A measured significance claim requires uplift, upliftCiLow, and upliftCiHigh",
      });
    }
    if (!design || design.type === "none") {
      ctx.addIssue({
        code: "custom",
        path: ["measurementDesign"],
        message: "A measured significance claim requires a non-none measurement design",
      });
    }
  }

  if (result.significance === "significant" && low != null && high != null && low <= 0 && high >= 0) {
    ctx.addIssue({
      code: "custom",
      path: ["claimedResult", "significance"],
      message: "A significant claim requires an interval that excludes zero",
    });
  }

  if (result.significance === "not-significant" && low != null && high != null &&
      (low > 0 || high < 0) && design?.mde !== undefined && result.measuredUpliftPct != null &&
      Math.abs(result.measuredUpliftPct) >= design.mde) {
    ctx.addIssue({
      code: "custom",
      path: ["claimedResult", "significance"],
      message: "A not-significant claim must include zero or remain below the stated MDE",
    });
  }
});

export type ValidationInput = z.infer<typeof validationInputSchema>;
