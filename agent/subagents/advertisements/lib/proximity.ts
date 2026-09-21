import { round } from "./random";
import type { Creative, UserProfile } from "./types";

/**
 * Brand proximity phi(u).
 *
 * How close a user already is to the brand, from behavioural signal only:
 * category affinity out of URL history, recency of brand contact, depth of
 * brand contact, and whether they have converted before.
 *
 * phi is not a response prediction. It is the state of the relationship, and
 * it enters bidding through the response model and through frequency policy —
 * a user at phi = 0.9 usually needs fewer impressions, not a higher bid.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — brand proximity
 * and audience targeting in advertisements.
 */

export type ProximityWeights = {
  categoryAffinity: number;
  recency: number;
  depth: number;
  priorConversion: number;
  /** Half-life in days for the recency decay. */
  recencyHalfLifeDays: number;
  /** Brand page views at which depth saturates. */
  depthSaturation: number;
};

export const DEFAULT_PROXIMITY_WEIGHTS: ProximityWeights = {
  categoryAffinity: 0.55,
  recency: 0.25,
  depth: 0.15,
  priorConversion: 0.1,
  recencyHalfLifeDays: 21,
  depthSaturation: 6,
};

export type ProximityResult = {
  userId: string;
  phi: number;
  components: {
    categoryAffinity: number;
    recencyDecay: number;
    depth: number;
    priorConversion: number;
  };
  band: "cold" | "aware" | "engaged" | "loyal";
};

export function brandProximity(
  user: UserProfile,
  creative: Creative,
  weights: ProximityWeights = DEFAULT_PROXIMITY_WEIGHTS,
): ProximityResult {
  const affinity = Math.min(1, Math.max(0, user.categoryAffinity[creative.category] ?? 0));
  // Exponential decay on brand-contact recency, expressed as a half-life.
  const recencyDecay = Math.pow(0.5, user.daysSinceBrandVisit / weights.recencyHalfLifeDays);
  const depth = Math.min(1, user.brandPageViews / weights.depthSaturation);
  const prior = user.priorConversion ? 1 : 0;

  const raw =
    weights.categoryAffinity * affinity +
    weights.recency * recencyDecay +
    weights.depth * depth +
    weights.priorConversion * prior;

  const maxPossible =
    weights.categoryAffinity + weights.recency + weights.depth + weights.priorConversion;
  const phi = Math.min(1, raw / maxPossible);

  return {
    userId: user.id,
    phi: round(phi, 6),
    components: {
      categoryAffinity: round(affinity, 4),
      recencyDecay: round(recencyDecay, 4),
      depth: round(depth, 4),
      priorConversion: prior,
    },
    band: phi >= 0.7 ? "loyal" : phi >= 0.45 ? "engaged" : phi >= 0.2 ? "aware" : "cold",
  };
}
