import { round } from "./random";
import type { Interaction, Item } from "./types";

/**
 * Content-based filtering and non-personalized baselines.
 *
 * Item vectors are TF-IDF over content tokens (tags, category, brand). A user
 * profile is the rating-weighted centroid of the items they liked, centred on
 * their own mean so "rated 3 by a user who averages 4.5" counts as a negative.
 *
 * Content filtering is what answers cold start: it needs no other user's data,
 * only the item's own description. Its weakness is the mirror image — it can
 * only ever recommend more of what the user already touched, which is why the
 * hybrid switches away from it as soon as collaborative signal exists.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — content-based
 * filtering and the cold-start problem.
 */

export type ContentIndex = {
  vectors: Map<string, Map<string, number>>;
  idf: Map<string, number>;
  norms: Map<string, number>;
  tokens: string[];
};

const tokensOf = (item: Item): string[] => [
  `cat:${item.category}`,
  `brand:${item.brand}`,
  ...item.tags.map((t) => `tag:${t}`),
  ...item.seasonality.map((s) => `occ:${s}`),
];

export function buildContentIndex(items: Item[]): ContentIndex {
  const documentFrequency = new Map<string, number>();
  const raw = new Map<string, string[]>();

  for (const item of items) {
    const tokens = tokensOf(item);
    raw.set(item.id, tokens);
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const n = items.length;
  const idf = new Map<string, number>();
  for (const [token, df] of documentFrequency) idf.set(token, Math.log(n / (1 + df)) + 1);

  const vectors = new Map<string, Map<string, number>>();
  const norms = new Map<string, number>();
  for (const [itemId, tokens] of raw) {
    const counts = new Map<string, number>();
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
    const vector = new Map<string, number>();
    let squared = 0;
    for (const [token, count] of counts) {
      const weight = (count / tokens.length) * (idf.get(token) ?? 1);
      vector.set(token, weight);
      squared += weight * weight;
    }
    vectors.set(itemId, vector);
    norms.set(itemId, Math.sqrt(squared));
  }

  return { vectors, idf, norms, tokens: [...idf.keys()] };
}

export function cosine(index: ContentIndex, itemA: string, itemB: string): number {
  const a = index.vectors.get(itemA);
  const b = index.vectors.get(itemB);
  if (!a || !b) return 0;
  const normA = index.norms.get(itemA) ?? 0;
  const normB = index.norms.get(itemB) ?? 0;
  if (normA === 0 || normB === 0) return 0;
  let dot = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [token, value] of small) {
    const other = large.get(token);
    if (other !== undefined) dot += value * other;
  }
  return round(dot / (normA * normB), 6);
}

export type UserContentProfile = {
  userId: string;
  weights: Map<string, number>;
  norm: number;
  basedOn: number;
  centring: "user_mean" | "global_mean";
};

/**
 * Build a content profile from a rating history.
 *
 * Centring on the user's own mean is right once they have a few ratings and
 * catastrophic before that: with one rating, the mean IS that rating, every
 * weight is zero, and the profile is empty — the exact case content filtering
 * exists to serve. Below `minForSelfCentring` ratings the profile is centred on
 * the catalog's neutral point instead, and `centring` reports which was used.
 */
export function buildUserProfile(
  index: ContentIndex,
  userId: string,
  history: Interaction[],
  options: { globalMean?: number; minForSelfCentring?: number } = {},
): UserContentProfile {
  const minForSelfCentring = options.minForSelfCentring ?? 3;
  const globalMean = options.globalMean ?? 3;
  const selfCentred = history.length >= minForSelfCentring;
  const mean = history.length === 0
    ? 0
    : selfCentred
      ? history.reduce((s, r) => s + r.rating, 0) / history.length
      : globalMean;
  const weights = new Map<string, number>();

  for (const row of history) {
    const vector = index.vectors.get(row.itemId);
    if (!vector) continue;
    // Centred: liking is relative to how this user rates. On a thin history the
    // weight is floored at a small positive value, because the interaction
    // itself is evidence of interest even when the rating is mediocre —
    // otherwise a single below-average rating produces a profile that points
    // away from everything the user has touched.
    const centred = row.rating - mean;
    const weight = selfCentred ? centred : Math.max(0.25, centred);
    if (weight === 0) continue;
    for (const [token, value] of vector) {
      weights.set(token, (weights.get(token) ?? 0) + weight * value);
    }
  }

  let squared = 0;
  for (const value of weights.values()) squared += value * value;

  return {
    userId,
    weights,
    norm: Math.sqrt(squared),
    basedOn: history.length,
    centring: selfCentred ? "user_mean" : "global_mean",
  };
}

export function scoreAgainstProfile(
  index: ContentIndex,
  profile: UserContentProfile,
  itemId: string,
): number {
  const vector = index.vectors.get(itemId);
  if (!vector || profile.norm === 0) return 0;
  const norm = index.norms.get(itemId) ?? 0;
  if (norm === 0) return 0;
  let dot = 0;
  for (const [token, value] of vector) {
    const weight = profile.weights.get(token);
    if (weight !== undefined) dot += value * weight;
  }
  return round(dot / (profile.norm * norm), 6);
}

/**
 * Non-personalized baseline with Bayesian shrinkage: an item with one 5-star
 * rating is not the best item in the catalog.
 *
 *   score = (v·R + m·C) / (v + m)
 */
export function nonPersonalized(
  items: Item[],
  interactions: Interaction[],
  options: { shrinkage?: number; minRatings?: number } = {},
): { itemId: string; bayesianScore: number; ratings: number; meanRating: number }[] {
  const shrinkage = options.shrinkage ?? 20;
  const minRatings = options.minRatings ?? 1;

  const byItem = new Map<string, number[]>();
  for (const row of interactions) {
    (byItem.get(row.itemId) ?? byItem.set(row.itemId, []).get(row.itemId)!).push(row.rating);
  }
  const globalMean =
    interactions.length === 0 ? 0 : interactions.reduce((s, r) => s + r.rating, 0) / interactions.length;

  return items
    .map((item) => {
      const ratings = byItem.get(item.id) ?? [];
      const mean = ratings.length === 0 ? 0 : ratings.reduce((s, r) => s + r, 0) / ratings.length;
      const bayesian =
        (ratings.length * mean + shrinkage * globalMean) / (ratings.length + shrinkage);
      return {
        itemId: item.id,
        bayesianScore: round(bayesian, 6),
        ratings: ratings.length,
        meanRating: round(mean, 4),
      };
    })
    .filter((row) => row.ratings >= minRatings)
    .sort((a, b) => b.bayesianScore - a.bayesianScore);
}
