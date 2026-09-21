import { z } from "zod";

/**
 * Recommender domain.
 *
 * Structure follows Katsov, "Introduction to Algorithmic Marketing" — the
 * recommendations chapter: content filtering, neighborhood and model-based
 * collaborative filtering, latent factor models (SVD / SVD++ / timeSVD++),
 * hybrids, contextual recommendation, and multi-objective ranking.
 */

export const channelSchema = z.enum(["web", "mobile", "email", "pdp"]);
export type Channel = z.infer<typeof channelSchema>;

export const occasionSchema = z.enum([
  "everyday",
  "restock",
  "gifting",
  "party",
  "back_to_school",
  "holiday",
]);
export type Occasion = z.infer<typeof occasionSchema>;

export const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  brand: z.string(),
  /** Free-form content tags, the input to content-based filtering. */
  tags: z.array(z.string()),
  price: z.number().min(0),
  /** Gross margin in currency per unit. */
  margin: z.number(),
  /** Weeks of stock cover; low values should suppress recommendation. */
  stockCoverWeeks: z.number().min(0),
  sponsored: z.boolean(),
  /** Observed interaction count, used for popularity penalties and novelty. */
  popularity: z.number().min(0),
  seasonality: z.array(occasionSchema),
});
export type Item = z.infer<typeof itemSchema>;

export const interactionSchema = z.object({
  userId: z.string(),
  itemId: z.string(),
  /** Explicit rating 1-5. */
  rating: z.number().min(1).max(5),
  /** Days since the start of the observation window. */
  day: z.number().min(0),
  channel: channelSchema,
  occasion: occasionSchema,
});
export type Interaction = z.infer<typeof interactionSchema>;

export const userSchema = z.object({
  id: z.string(),
  segment: z.string(),
  territory: z.string(),
  /** Spend capacity signal: constrains price band of what should be shown. */
  cashFlowBand: z.enum(["low", "mid", "high"]),
  preferredChannel: channelSchema,
  firstSeenDay: z.number().min(0),
  interactionCount: z.number().min(0),
});
export type User = z.infer<typeof userSchema>;

/** A transaction basket, the input to association-rule mining. */
export const basketSchema = z.object({
  id: z.string(),
  userId: z.string(),
  day: z.number().min(0),
  itemIds: z.array(z.string()).min(1),
});
export type Basket = z.infer<typeof basketSchema>;

/** Request context. Every recommendation is conditional on it. */
export const contextSchema = z.object({
  userId: z.string().optional(),
  seedItemId: z.string().optional().describe("Item being viewed, for PDP recommendations."),
  channel: channelSchema.default("web"),
  occasion: occasionSchema.default("everyday"),
  day: z.number().min(0).optional(),
  territory: z.string().optional(),
  cashFlowBand: z.enum(["low", "mid", "high"]).optional(),
  slots: z.number().int().min(1).max(50).default(10),
});
export type RecContext = z.infer<typeof contextSchema>;

export type Scored = {
  itemId: string;
  score: number;
  reason: string;
  source: string;
};
