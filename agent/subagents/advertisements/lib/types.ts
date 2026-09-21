import { z } from "zod";

/**
 * Programmatic advertising domain.
 *
 * Notation follows Katsov, "Introduction to Algorithmic Marketing" — the
 * advertisements chapter: brand proximity phi(u), ad response psi_a(u),
 * inventory quality omega_a(u,i), and the bid
 *
 *     b(u) = b_base * s1(psi) * s2(omega / omega_bar)
 *
 * submitted into a second-price (Vickrey) exchange auction.
 */

export const CATEGORIES = [
  "beverages",
  "snacks",
  "home",
  "personal_care",
  "electronics",
  "travel",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const placementSchema = z.enum(["display", "video", "search", "native"]);
export type Placement = z.infer<typeof placementSchema>;

export const deviceSchema = z.enum(["mobile", "desktop", "ctv", "tablet"]);
export type Device = z.infer<typeof deviceSchema>;

export const qualityTierSchema = z.enum(["premium", "mid", "long_tail"]);
export type QualityTier = z.infer<typeof qualityTierSchema>;

export const publisherSchema = z.object({
  id: z.string(),
  domain: z.string(),
  tier: qualityTierSchema,
  /** Share of served impressions actually in view (MRC-style). */
  viewability: z.number().min(0).max(1),
  /** Modeled probability the traffic is invalid (bots, domain spoofing). */
  fraudProbability: z.number().min(0).max(1),
  /** 0-1, higher is safer adjacency for the brand. */
  brandSafety: z.number().min(0).max(1),
  /** Average slot position, 1 = above the fold. */
  averagePosition: z.number().min(1),
  contentCategories: z.array(z.string()),
});
export type Publisher = z.infer<typeof publisherSchema>;

export const userProfileSchema = z.object({
  id: z.string(),
  device: deviceSchema,
  geo: z.string(),
  /** Affinity weight per content category, 0-1, from URL history. */
  categoryAffinity: z.record(z.string(), z.number()),
  /** Distinct brand-owned URLs seen in the window. */
  brandPageViews: z.number().min(0),
  /** Days since the last brand-owned URL; large means cold. */
  daysSinceBrandVisit: z.number().min(0),
  /** Site visits in the window, a crude intensity signal. */
  sessions: z.number().min(0),
  /** Prior purchase of the advertised brand. */
  priorConversion: z.boolean(),
  /** Impressions already served to this user this period. */
  impressionsServed: z.number().min(0),
  dmpSegments: z.array(z.string()),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const creativeSchema = z.object({
  id: z.string(),
  brand: z.string(),
  category: z.string(),
  placement: placementSchema,
  /** Value of one conversion in currency, used to cap the bid. */
  conversionValue: z.number().min(0),
  /** Target cost per acquisition. */
  targetCpa: z.number().min(0),
  baseBidCpm: z.number().min(0).describe("b_base, cost per thousand impressions."),
});
export type Creative = z.infer<typeof creativeSchema>;

export const impressionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  publisherId: z.string(),
  creativeId: z.string(),
  placement: placementSchema,
  device: deviceSchema,
  position: z.number().min(1),
  hour: z.number().min(0).max(23),
  floorCpm: z.number().min(0),
  clearingCpm: z.number().min(0).describe("What the impression actually cleared at."),
  clicked: z.boolean(),
  converted: z.boolean(),
  viewable: z.boolean(),
});
export type Impression = z.infer<typeof impressionSchema>;

export const bidRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  publisherId: z.string(),
  placement: placementSchema,
  device: deviceSchema,
  position: z.number().min(1),
  hour: z.number().min(0).max(23),
  floorCpm: z.number().min(0),
  /** Milliseconds left in the exchange's response window. */
  timeoutMs: z.number().min(1).default(120),
});
export type BidRequest = z.infer<typeof bidRequestSchema>;
