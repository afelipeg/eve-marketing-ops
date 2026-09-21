import { z } from "zod";

/**
 * Promotions domain vocabulary.
 *
 * Structure follows Katsov, "Introduction to Algorithmic Marketing" —
 * promotions and advertisements: response modeling, uplift modeling, LTV,
 * and the targeting pipeline (hard conditions, then soft scores, then depth).
 */

export const objectiveSchema = z.enum([
  "acquisition",
  "maximization",
  "retention",
  "conversion",
]);
export type Objective = z.infer<typeof objectiveSchema>;

export const channelSchema = z.enum(["email", "sms", "in_store", "ecommerce"]);
export type Channel = z.infer<typeof channelSchema>;

export const offerTypeSchema = z.enum([
  "coupon_pct",
  "coupon_amount",
  "bogo",
  "dollar_off",
  "fsi",
  "threshold_discount",
  "loyalty_points",
]);
export type OfferType = z.infer<typeof offerTypeSchema>;

/** The four uplift response types. Only persuadables create value. */
export const responseTypeSchema = z.enum([
  "persuadable",
  "sure_thing",
  "lost_cause",
  "sleeping_dog",
]);
export type ResponseType = z.infer<typeof responseTypeSchema>;

export const customerSchema = z.object({
  id: z.string(),
  territory: z.string(),
  brandAffinity: z.string(),
  preferredChannel: channelSchema,
  optIns: z.object({
    email: z.boolean(),
    sms: z.boolean(),
  }),
  tenureDays: z.number().min(0),
  recencyDays: z.number().min(0).describe("Days since last purchase."),
  frequency: z.number().min(0).describe("Purchases in the observation window."),
  monetary: z.number().min(0).describe("Average gross margin per order."),
  avgOrderValue: z.number().min(0),
  categoriesBought: z.number().min(0),
  lastPromoDaysAgo: z.number().min(0),
  promosLast30d: z.number().min(0),
  isLapsed: z.boolean(),
  /** Historical campaign frame used to train uplift models. */
  history: z.object({
    treated: z.boolean(),
    responded: z.boolean(),
    campaignId: z.string(),
  }),
});
export type Customer = z.infer<typeof customerSchema>;

export const transactionSchema = z.object({
  customerId: z.string(),
  date: z.string(),
  channel: channelSchema,
  brand: z.string(),
  category: z.string(),
  units: z.number().min(0),
  revenue: z.number().min(0),
  grossMargin: z.number(),
  promoted: z.boolean(),
  discountAmount: z.number().min(0),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const offerSchema = z.object({
  type: offerTypeSchema,
  /** Percent for coupon_pct, currency amount otherwise. */
  depth: z.number().min(0),
  /** Expected share of targeted customers who redeem, 0-1. */
  expectedRedemptionRate: z.number().min(0).max(1),
  /** Fixed delivery cost per contact (print, SMS, postage). */
  costPerContact: z.number().min(0).default(0),
  minimumBasket: z.number().min(0).optional(),
});
export type Offer = z.infer<typeof offerSchema>;

/** Hard targeting conditions — applied before any model score. */
export const hardConditionsSchema = z.object({
  territories: z.array(z.string()).optional(),
  brands: z.array(z.string()).optional(),
  channels: z.array(channelSchema).optional(),
  requireOptIn: z.boolean().default(true),
  nonBuyersOnly: z.boolean().default(false).describe("Exclude anyone who bought in the window."),
  minFrequency: z.number().min(0).optional(),
  maxFrequency: z.number().min(0).optional(),
  minRecencyDays: z.number().min(0).optional(),
  maxRecencyDays: z.number().min(0).optional(),
  minMonetary: z.number().min(0).optional(),
  retargetingOnly: z.boolean().default(false).describe("Only customers exposed to a prior stage."),
  excludeRecentlyPromotedDays: z.number().min(0).optional(),
  stockAvailable: z.boolean().default(true),
});
export type HardConditions = z.infer<typeof hardConditionsSchema>;

/** Contact pressure rules. */
export const capsSchema = z.object({
  maxContactsPer30d: z.number().int().min(0).default(2),
  minDaysBetweenContacts: z.number().min(0).default(7),
  maxAudienceShare: z.number().min(0).max(1).optional(),
  budget: z.number().min(0).optional(),
});
export type Caps = z.infer<typeof capsSchema>;

/** Moments of truth used to stage a multi-step campaign. */
export const momentSchema = z.enum(["ZMOT", "FMOT", "SMOT"]);
export type Moment = z.infer<typeof momentSchema>;
