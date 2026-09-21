import { round } from "./random";
import { cosine, type ContentIndex } from "./content";
import type { Item, Scored } from "./types";

/**
 * Ranking layer: multi-objective selection (TOPSIS), diversity re-ranking
 * (MMR), popularity penalties, and the offline metrics.
 *
 * Accuracy alone collapses a catalog onto its best-sellers: the most-rated
 * items are the easiest to predict, so an accuracy-optimal list is a
 * popularity list. Coverage, novelty, diversity and serendipity are what stop
 * the recommender from re-selling what the customer would have found anyway.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — recommender
 * evaluation, diversity, and multi-objective ranking.
 */

/* ------------------------------------------------------------------ TOPSIS */

export type TopsisCriterion = {
  name: string;
  weight: number;
  /** true = higher is better (benefit), false = lower is better (cost). */
  benefit: boolean;
};

export type TopsisRow = { id: string; values: Record<string, number> };

export type TopsisResult = {
  ranked: { id: string; closeness: number; normalized: Record<string, number> }[];
  idealBest: Record<string, number>;
  idealWorst: Record<string, number>;
  criteria: TopsisCriterion[];
};

/**
 * TOPSIS — Technique for Order of Preference by Similarity to Ideal Solution.
 * Vector-normalize each criterion, weight it, then rank alternatives by
 * relative closeness to the ideal and distance from the anti-ideal.
 */
export function topsis(rows: TopsisRow[], criteria: TopsisCriterion[]): TopsisResult {
  if (rows.length === 0) throw new Error("TOPSIS needs at least one alternative.");
  if (criteria.length === 0) throw new Error("TOPSIS needs at least one criterion.");

  const weightTotal = criteria.reduce((s, c) => s + c.weight, 0);
  if (weightTotal <= 0) throw new Error("Criterion weights must sum to a positive number.");
  const weights = criteria.map((c) => c.weight / weightTotal);

  // Vector normalization: divide by the column's Euclidean norm.
  const norms: Record<string, number> = {};
  for (const criterion of criteria) {
    let squared = 0;
    for (const row of rows) squared += Math.pow(row.values[criterion.name] ?? 0, 2);
    norms[criterion.name] = Math.sqrt(squared) || 1;
  }

  const weighted = rows.map((row) => {
    const normalized: Record<string, number> = {};
    criteria.forEach((criterion, index) => {
      normalized[criterion.name] =
        ((row.values[criterion.name] ?? 0) / norms[criterion.name]!) * weights[index]!;
    });
    return { id: row.id, normalized };
  });

  const idealBest: Record<string, number> = {};
  const idealWorst: Record<string, number> = {};
  for (const criterion of criteria) {
    const column = weighted.map((row) => row.normalized[criterion.name]!);
    const max = Math.max(...column);
    const min = Math.min(...column);
    idealBest[criterion.name] = criterion.benefit ? max : min;
    idealWorst[criterion.name] = criterion.benefit ? min : max;
  }

  const ranked = weighted
    .map((row) => {
      let distanceBest = 0;
      let distanceWorst = 0;
      for (const criterion of criteria) {
        distanceBest += Math.pow(row.normalized[criterion.name]! - idealBest[criterion.name]!, 2);
        distanceWorst += Math.pow(row.normalized[criterion.name]! - idealWorst[criterion.name]!, 2);
      }
      const dBest = Math.sqrt(distanceBest);
      const dWorst = Math.sqrt(distanceWorst);
      const denominator = dBest + dWorst;
      return {
        id: row.id,
        closeness: round(denominator === 0 ? 0 : dWorst / denominator, 6),
        normalized: Object.fromEntries(
          Object.entries(row.normalized).map(([k, v]) => [k, round(v, 6)]),
        ),
      };
    })
    .sort((a, b) => b.closeness - a.closeness);

  return { ranked, idealBest, idealWorst, criteria };
}

/* -------------------------------------------------------------- Re-ranking */

/**
 * Popularity penalty.
 *
 * Scores are min-max normalized within the candidate set FIRST, so lambda means
 * the same thing whatever scale the upstream model produced. A penalty of 0.3
 * against raw 1-5 predicted ratings is nearly inert; against a normalized score
 * it removes 30% of the available range. Popularity enters as log(1 + rank
 * share), which flattens the head of a Zipf catalog instead of only shaving the
 * single most popular item.
 */
export function penalizePopularity(
  scored: Scored[],
  popularity: Map<string, number>,
  lambda: number,
): Scored[] {
  if (scored.length === 0) return [];
  const scores = scored.map((s) => s.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = Math.max(1e-9, max - min);

  // Popularity share within the candidate set, so the penalty is relative to
  // what is actually on offer.
  const candidatePopularity = scored.map((s) => popularity.get(s.itemId) ?? 0);
  const popTotal = Math.max(1e-9, candidatePopularity.reduce((s, v) => s + v, 0));

  return scored
    .map((row) => {
      const normalized = (row.score - min) / range;
      const share = (popularity.get(row.itemId) ?? 0) / popTotal;
      const penalty = lambda * Math.log(1 + share * scored.length);
      return {
        ...row,
        score: round(normalized - penalty, 6),
        reason: row.reason,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Maximal Marginal Relevance: greedily pick the item that maximizes
 *   lambda·relevance - (1-lambda)·max similarity to what is already picked.
 */
export function mmrRerank(input: {
  candidates: Scored[];
  index: ContentIndex;
  slots: number;
  lambda: number;
}): { selected: Scored[]; droppedForDiversity: string[] } {
  const { candidates, index, slots, lambda } = input;
  if (candidates.length === 0) return { selected: [], droppedForDiversity: [] };

  const pool = [...candidates].sort((a, b) => b.score - a.score);
  // No 1e-9 floor on the max: penalizePopularity legitimately returns an
  // all-negative pool, and clamping the max to ~0 there made every normalized
  // relevance collapse toward 0, letting diversity silently win the lambda
  // tradeoff. `range` below already guards the degenerate case.
  const maxScore = Math.max(...pool.map((c) => c.score));
  const minScore = Math.min(...pool.map((c) => c.score));
  const range = Math.max(1e-9, maxScore - minScore);

  const selected: Scored[] = [];
  const remaining = [...pool];
  const dropped: string[] = [];

  while (selected.length < slots && remaining.length > 0) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      const relevance = (candidate.score - minScore) / range;
      let maxSimilarity = 0;
      for (const chosen of selected) {
        maxSimilarity = Math.max(maxSimilarity, cosine(index, candidate.itemId, chosen.itemId));
      }
      const value = lambda * relevance - (1 - lambda) * maxSimilarity;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }
    const [chosen] = remaining.splice(bestIndex, 1);
    if (chosen) selected.push(chosen);
  }

  // Items that ranked above a selected item but lost on diversity.
  const selectedIds = new Set(selected.map((s) => s.itemId));
  for (const candidate of pool.slice(0, slots)) {
    if (!selectedIds.has(candidate.itemId)) dropped.push(candidate.itemId);
  }

  return { selected, droppedForDiversity: dropped };
}

/* ----------------------------------------------------------------- Metrics */

export function precisionRecallAtK(
  recommended: string[],
  relevant: Set<string>,
  k: number,
): { precision: number; recall: number; hits: number } {
  const top = recommended.slice(0, k);
  const hits = top.filter((id) => relevant.has(id)).length;
  return {
    precision: round(top.length === 0 ? 0 : hits / top.length, 6),
    recall: round(relevant.size === 0 ? 0 : hits / relevant.size, 6),
    hits,
  };
}

export function ndcgAtK(recommended: string[], relevance: Map<string, number>, k: number): number {
  const top = recommended.slice(0, k);
  let dcg = 0;
  top.forEach((id, index) => {
    const gain = relevance.get(id) ?? 0;
    dcg += (Math.pow(2, gain) - 1) / Math.log2(index + 2);
  });
  const ideal = [...relevance.values()].sort((a, b) => b - a).slice(0, k);
  let idcg = 0;
  ideal.forEach((gain, index) => {
    idcg += (Math.pow(2, gain) - 1) / Math.log2(index + 2);
  });
  return round(idcg === 0 ? 0 : dcg / idcg, 6);
}

/** Catalog coverage: share of the catalog that appears in anyone's list. */
export function coverage(allRecommended: string[][], catalogSize: number): number {
  const distinct = new Set(allRecommended.flat());
  return round(catalogSize === 0 ? 0 : distinct.size / catalogSize, 6);
}

/** Novelty: mean self-information of recommended items, -log2 of their popularity share. */
export function novelty(recommended: string[], popularity: Map<string, number>): number {
  const total = [...popularity.values()].reduce((s, v) => s + v, 0);
  if (recommended.length === 0) return 0;
  // Laplace smoothing, and it is not cosmetic. Scoring a zero-popularity item
  // as 0 made a brand-new item look *less* novel than a best-seller — the
  // metric ranked backwards in exactly the cold-start case it exists to
  // reward. Smoothing gives an unseen item the largest finite self-information
  // in the catalog instead of the smallest.
  const catalogSize = Math.max(1, popularity.size);
  let sum = 0;
  for (const id of recommended) {
    const share = ((popularity.get(id) ?? 0) + 1) / (total + catalogSize);
    sum += -Math.log2(share);
  }
  return round(sum / recommended.length, 6);
}

/** Intra-list diversity: 1 - mean pairwise content similarity. */
export function intraListDiversity(recommended: string[], index: ContentIndex): number {
  if (recommended.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let a = 0; a < recommended.length; a++) {
    for (let b = a + 1; b < recommended.length; b++) {
      total += cosine(index, recommended[a]!, recommended[b]!);
      pairs++;
    }
  }
  return round(1 - total / pairs, 6);
}

/**
 * Serendipity: relevant AND unexpected. Share of hits that a
 * popularity-only baseline would not have shown.
 */
export function serendipity(
  recommended: string[],
  relevant: Set<string>,
  popularityBaseline: string[],
): { serendipity: number; unexpectedHits: string[] } {
  const baseline = new Set(popularityBaseline);
  const unexpectedHits = recommended.filter((id) => relevant.has(id) && !baseline.has(id));
  return {
    serendipity: round(recommended.length === 0 ? 0 : unexpectedHits.length / recommended.length, 6),
    unexpectedHits,
  };
}

/** Business view of a slate: margin, stock risk, sponsored share. */
export function slateEconomics(recommended: string[], items: Map<string, Item>) {
  const rows = recommended.map((id) => items.get(id)).filter((i): i is Item => Boolean(i));
  if (rows.length === 0) return { items: 0, expectedMargin: 0, sponsoredShare: 0, lowStockShare: 0 };
  return {
    items: rows.length,
    expectedMargin: round(rows.reduce((s, i) => s + i.margin, 0) / rows.length, 4),
    sponsoredShare: round(rows.filter((i) => i.sponsored).length / rows.length, 4),
    lowStockShare: round(rows.filter((i) => i.stockCoverWeeks < 2).length / rows.length, 4),
  };
}
