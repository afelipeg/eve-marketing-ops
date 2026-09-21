import { round } from "./random";
import type { Creative, Publisher, UserProfile } from "./types";

/**
 * Inventory quality omega_a(u, i).
 *
 * What the impression is actually worth to this advertiser, before any
 * response estimate: can it be seen, is the traffic real, is the adjacency
 * safe, is the slot visible, does the placement fit the creative, and has this
 * user already been hit too often.
 *
 * omega multiplies the bid through s2(omega / omega_bar), so the normalizer
 * omega_bar is the average quality of the inventory actually available — not a
 * constant. Bidding above the pool average is a decision about *this*
 * impression relative to what else can be bought right now.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — inventory
 * quality and ad exchange mechanics.
 */

export type InventoryWeights = {
  viewabilityExponent: number;
  fraudExponent: number;
  brandSafetyExponent: number;
  positionDecay: number;
  /** Impressions to this user after which quality is discounted. */
  frequencySoftCap: number;
  frequencyPenalty: number;
};

export const DEFAULT_INVENTORY_WEIGHTS: InventoryWeights = {
  viewabilityExponent: 1,
  fraudExponent: 2,
  brandSafetyExponent: 1,
  positionDecay: 0.15,
  frequencySoftCap: 8,
  frequencyPenalty: 0.6,
};

export type InventoryScore = {
  publisherId: string;
  omega: number;
  components: {
    viewability: number;
    validTraffic: number;
    brandSafety: number;
    positionFactor: number;
    placementFit: number;
    frequencyFactor: number;
  };
  flags: string[];
};

export function inventoryQuality(input: {
  publisher: Publisher;
  user: UserProfile;
  creative: Creative;
  position?: number;
  weights?: InventoryWeights;
}): InventoryScore {
  const { publisher, user, creative } = input;
  const weights = input.weights ?? DEFAULT_INVENTORY_WEIGHTS;
  const position = input.position ?? publisher.averagePosition;

  const viewability = Math.pow(publisher.viewability, weights.viewabilityExponent);
  // Squared by default: invalid traffic is penalized harder than it is priced.
  const validTraffic = Math.pow(1 - publisher.fraudProbability, weights.fraudExponent);
  const brandSafety = Math.pow(publisher.brandSafety, weights.brandSafetyExponent);
  const positionFactor = Math.exp(-weights.positionDecay * Math.max(0, position - 1));
  const placementFit = publisher.contentCategories.includes(creative.category) ? 1 : 0.8;
  const frequencyFactor =
    user.impressionsServed <= weights.frequencySoftCap
      ? 1
      : Math.pow(weights.frequencyPenalty, user.impressionsServed - weights.frequencySoftCap);

  const omega =
    viewability * validTraffic * brandSafety * positionFactor * placementFit * frequencyFactor;

  const flags: string[] = [];
  if (publisher.fraudProbability >= 0.15) {
    flags.push(
      `fraud probability ${round(publisher.fraudProbability, 3)}: clicks from this source are not evidence of interest`,
    );
  }
  if (publisher.viewability < 0.4) flags.push(`viewability ${round(publisher.viewability, 3)} below 0.40`);
  if (publisher.brandSafety < 0.5) flags.push(`brand safety ${round(publisher.brandSafety, 3)} below 0.50`);
  if (user.impressionsServed > weights.frequencySoftCap) {
    flags.push(`frequency ${user.impressionsServed} above soft cap ${weights.frequencySoftCap}`);
  }

  return {
    publisherId: publisher.id,
    omega: round(omega, 6),
    components: {
      viewability: round(viewability, 4),
      validTraffic: round(validTraffic, 4),
      brandSafety: round(brandSafety, 4),
      positionFactor: round(positionFactor, 4),
      placementFit,
      frequencyFactor: round(frequencyFactor, 4),
    },
    flags,
  };
}

/** omega_bar: mean quality of the inventory pool currently biddable. */
export function poolAverageQuality(scores: number[]): number {
  if (scores.length === 0) return 1;
  return round(scores.reduce((s, v) => s + v, 0) / scores.length, 6);
}
