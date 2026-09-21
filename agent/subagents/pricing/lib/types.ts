import { z } from "zod";

/**
 * Pricing domain.
 *
 * Structure follows Katsov, "Introduction to Algorithmic Marketing" — the
 * pricing chapter: demand prediction, price structures (unit, segmented,
 * multi-part, bundle), dynamic pricing under finite capacity and
 * perishability, markdowns, and resource allocation.
 */

export const channelSchema = z.enum(["pos", "ecommerce", "wholesale"]);
export type Channel = z.infer<typeof channelSchema>;

export const structureSchema = z.enum(["unit", "segmented", "two_part", "bundle"]);
export type PriceStructure = z.infer<typeof structureSchema>;

export const productSchema = z.object({
  sku: z.string(),
  title: z.string(),
  category: z.string(),
  brand: z.string(),
  packSize: z.number().min(0),
  /** Marginal cost per unit. */
  unitCost: z.number().min(0),
  currentPrice: z.number().min(0),
  /** Price floor from legal, contractual or strategic constraints. */
  priceFloor: z.number().min(0).optional(),
  priceCeiling: z.number().min(0).optional(),
  /** Units on hand. */
  inventory: z.number().min(0),
  /** Weeks until the stock is unsellable; null for non-perishable. */
  shelfLifeWeeks: z.number().min(0).nullable(),
  /** Salvage value per unit after the selling horizon. */
  salvageValue: z.number().min(0),
  perishable: z.boolean(),
});
export type Product = z.infer<typeof productSchema>;

export const salesRecordSchema = z.object({
  sku: z.string(),
  week: z.number().min(0),
  channel: channelSchema,
  price: z.number().min(0),
  competitorPrice: z.number().min(0),
  units: z.number().min(0),
  revenue: z.number().min(0),
  grossMargin: z.number(),
  promoted: z.boolean(),
  /** Units available that week; a stockout censors observed demand. */
  inventoryStart: z.number().min(0),
  stockedOut: z.boolean(),
});
export type SalesRecord = z.infer<typeof salesRecordSchema>;

export const competitorPriceSchema = z.object({
  sku: z.string(),
  week: z.number().min(0),
  competitor: z.string(),
  price: z.number().min(0),
  onPromotion: z.boolean(),
});
export type CompetitorPrice = z.infer<typeof competitorPriceSchema>;

/**
 * A willingness-to-pay segment. Fences are what make differentiation
 * sustainable: without them, everyone buys at the lowest fenced price.
 */
export const segmentSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Share of the addressable population. */
  share: z.number().min(0).max(1),
  /** Mean reservation price. */
  wtpMean: z.number().min(0),
  wtpStdDev: z.number().min(0),
  /** Price sensitivity multiplier applied to the category elasticity. */
  elasticityMultiplier: z.number().min(0).default(1),
  /** What stops another segment from taking this price. */
  fence: z.string(),
});
export type Segment = z.infer<typeof segmentSchema>;

export const bundleSchema = z.object({
  id: z.string(),
  skus: z.array(z.string()).min(2),
  /** Bundle price; null when it is still to be optimized. */
  price: z.number().min(0).nullable(),
  type: z.enum(["pure", "mixed"]),
});
export type Bundle = z.infer<typeof bundleSchema>;
