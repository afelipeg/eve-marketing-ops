import { round } from "./random";
import type { RatingMatrix } from "./matrix";
import type { Interaction } from "./types";

/**
 * Neighborhood collaborative filtering.
 *
 * Item-based is the default: item-item similarities are more stable than
 * user-user (items accumulate ratings, users churn), they can be precomputed,
 * and they explain themselves — "because you rated X".
 *
 * Similarity is ADJUSTED cosine: each rating is centred on the rating user's
 * mean before the cosine, which removes the "this user rates everything 5"
 * effect that plain cosine mistakes for agreement.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — neighborhood
 * methods in collaborative filtering.
 */

export type SimilarityMatrix = {
  neighbors: Map<string, { itemId: string; similarity: number; support: number }[]>;
  metric: "adjusted_cosine" | "pearson" | "cosine";
  shrinkage: number;
  minSupport: number;
};

export function userMeans(matrix: RatingMatrix): Map<string, number> {
  const means = new Map<string, number>();
  for (const [userId, rows] of matrix.byUser) {
    means.set(userId, rows.reduce((s, r) => s + r.rating, 0) / rows.length);
  }
  return means;
}

export function buildItemSimilarity(
  matrix: RatingMatrix,
  options: {
    metric?: "adjusted_cosine" | "pearson" | "cosine";
    topK?: number;
    minSupport?: number;
    shrinkage?: number;
  } = {},
): SimilarityMatrix {
  const { metric = "adjusted_cosine", topK = 40, minSupport = 3, shrinkage = 10 } = options;
  const means = userMeans(matrix);
  const itemMeans = new Map<string, number>();
  for (const [itemId, rows] of matrix.byItem) {
    itemMeans.set(itemId, rows.reduce((s, r) => s + r.rating, 0) / rows.length);
  }

  const centred = (row: Interaction): number => {
    if (metric === "cosine") return row.rating;
    if (metric === "pearson") return row.rating - (itemMeans.get(row.itemId) ?? 0);
    return row.rating - (means.get(row.userId) ?? 0);
  };

  // Co-rating accumulation, keyed by item pair.
  const vectors = new Map<string, Map<string, number>>();
  for (const [itemId, rows] of matrix.byItem) {
    const vector = new Map<string, number>();
    for (const row of rows) vector.set(row.userId, centred(row));
    vectors.set(itemId, vector);
  }

  const itemsByUser = matrix.byUser;
  const pairNumerator = new Map<string, number>();
  const pairSupport = new Map<string, number>();

  for (const rows of itemsByUser.values()) {
    for (let a = 0; a < rows.length; a++) {
      for (let b = a + 1; b < rows.length; b++) {
        const itemA = rows[a]!.itemId;
        const itemB = rows[b]!.itemId;
        const key = itemA < itemB ? `${itemA}|${itemB}` : `${itemB}|${itemA}`;
        const valueA = vectors.get(itemA)!.get(rows[a]!.userId)!;
        const valueB = vectors.get(itemB)!.get(rows[b]!.userId)!;
        pairNumerator.set(key, (pairNumerator.get(key) ?? 0) + valueA * valueB);
        pairSupport.set(key, (pairSupport.get(key) ?? 0) + 1);
      }
    }
  }

  const norms = new Map<string, number>();
  for (const [itemId, vector] of vectors) {
    let sum = 0;
    for (const value of vector.values()) sum += value * value;
    norms.set(itemId, Math.sqrt(sum));
  }

  const neighbors = new Map<string, { itemId: string; similarity: number; support: number }[]>();
  const push = (from: string, to: string, similarity: number, support: number) => {
    const list = neighbors.get(from) ?? [];
    list.push({ itemId: to, similarity: round(similarity, 6), support });
    neighbors.set(from, list);
  };

  for (const [key, numerator] of pairNumerator) {
    const support = pairSupport.get(key) ?? 0;
    if (support < minSupport) continue;
    const [itemA, itemB] = key.split("|") as [string, string];
    const denominator = (norms.get(itemA) ?? 0) * (norms.get(itemB) ?? 0);
    if (denominator === 0) continue;
    // Shrink toward zero when the pair is supported by few co-ratings.
    const raw = numerator / denominator;
    const similarity = (support / (support + shrinkage)) * raw;
    push(itemA, itemB, similarity, support);
    push(itemB, itemA, similarity, support);
  }

  for (const [itemId, list] of neighbors) {
    list.sort((a, b) => b.similarity - a.similarity);
    neighbors.set(itemId, list.slice(0, topK));
  }

  return { neighbors, metric, shrinkage, minSupport };
}

/** Item-based kNN prediction for one (user, item) pair. */
export function predictItemBased(input: {
  matrix: RatingMatrix;
  similarity: SimilarityMatrix;
  userId: string;
  itemId: string;
  k?: number;
}): { prediction: number | null; usedNeighbors: number; contributors: string[] } {
  const { matrix, similarity, userId, itemId, k = 20 } = input;
  const history = matrix.byUser.get(userId) ?? [];
  if (history.length === 0) return { prediction: null, usedNeighbors: 0, contributors: [] };

  const rated = new Map(history.map((r) => [r.itemId, r.rating]));
  const neighbors = (similarity.neighbors.get(itemId) ?? [])
    .filter((n) => rated.has(n.itemId) && n.similarity > 0)
    .slice(0, k);

  if (neighbors.length === 0) return { prediction: null, usedNeighbors: 0, contributors: [] };

  let numerator = 0;
  let denominator = 0;
  for (const neighbor of neighbors) {
    numerator += neighbor.similarity * rated.get(neighbor.itemId)!;
    denominator += Math.abs(neighbor.similarity);
  }

  return {
    prediction: denominator === 0 ? null : round(numerator / denominator, 6),
    usedNeighbors: neighbors.length,
    contributors: neighbors.slice(0, 3).map((n) => n.itemId),
  };
}
