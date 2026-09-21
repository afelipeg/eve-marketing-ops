import { round } from "./random";
import type { Interaction } from "./types";

/**
 * Rating-matrix plumbing: index maps, per-user and per-item views, and the
 * temporal train/test split every offline evaluation here uses.
 *
 * The split is by TIME, not at random. A random split lets the model see a
 * user's future when predicting their past, which inflates every offline metric
 * and is the most common reason an offline winner loses online.
 */

export type RatingMatrix = {
  interactions: Interaction[];
  users: string[];
  items: string[];
  userIndex: Map<string, number>;
  itemIndex: Map<string, number>;
  byUser: Map<string, Interaction[]>;
  byItem: Map<string, Interaction[]>;
  globalMean: number;
  density: number;
};

export function buildMatrix(interactions: Interaction[]): RatingMatrix {
  const users = [...new Set(interactions.map((i) => i.userId))].sort();
  const items = [...new Set(interactions.map((i) => i.itemId))].sort();
  const byUser = new Map<string, Interaction[]>();
  const byItem = new Map<string, Interaction[]>();

  for (const interaction of interactions) {
    (byUser.get(interaction.userId) ?? byUser.set(interaction.userId, []).get(interaction.userId)!).push(interaction);
    (byItem.get(interaction.itemId) ?? byItem.set(interaction.itemId, []).get(interaction.itemId)!).push(interaction);
  }

  const globalMean =
    interactions.length === 0 ? 0 : interactions.reduce((s, i) => s + i.rating, 0) / interactions.length;

  return {
    interactions,
    users,
    items,
    userIndex: new Map(users.map((u, i) => [u, i])),
    itemIndex: new Map(items.map((it, i) => [it, i])),
    byUser,
    byItem,
    globalMean: round(globalMean, 6),
    density: round(interactions.length / Math.max(1, users.length * items.length), 6),
  };
}

export type Split = {
  train: Interaction[];
  test: Interaction[];
  cutoffDay: number;
  testUsers: string[];
};

/** Temporal split: everything after `cutoffQuantile` of the day range is held out. */
export function temporalSplit(interactions: Interaction[], cutoffQuantile = 0.8): Split {
  const days = [...interactions.map((i) => i.day)].sort((a, b) => a - b);
  const cutoffDay = days[Math.floor((days.length - 1) * cutoffQuantile)] ?? 0;
  const train = interactions.filter((i) => i.day <= cutoffDay);
  const test = interactions.filter((i) => i.day > cutoffDay);
  return {
    train,
    test,
    cutoffDay,
    testUsers: [...new Set(test.map((i) => i.userId))],
  };
}

export function sparsityReport(matrix: RatingMatrix) {
  const perUser = [...matrix.byUser.values()].map((v) => v.length).sort((a, b) => a - b);
  const perItem = [...matrix.byItem.values()].map((v) => v.length).sort((a, b) => a - b);
  const at = (arr: number[], q: number) => (arr.length === 0 ? 0 : arr[Math.floor((arr.length - 1) * q)]!);
  const head = [...matrix.byItem.entries()].sort((a, b) => b[1].length - a[1].length);
  const totalRatings = matrix.interactions.length;
  const top10Share =
    totalRatings === 0
      ? 0
      : head.slice(0, Math.ceil(head.length * 0.1)).reduce((s, [, v]) => s + v.length, 0) / totalRatings;

  return {
    users: matrix.users.length,
    items: matrix.items.length,
    ratings: totalRatings,
    density: matrix.density,
    ratingsPerUser: { p10: at(perUser, 0.1), median: at(perUser, 0.5), p90: at(perUser, 0.9) },
    ratingsPerItem: { p10: at(perItem, 0.1), median: at(perItem, 0.5), p90: at(perItem, 0.9) },
    coldUsers: perUser.filter((n) => n < 3).length,
    coldItems: perItem.filter((n) => n < 3).length,
    popularityConcentration: {
      top10PctItemsShareOfRatings: round(top10Share, 4),
      note:
        "A long tail this steep is why accuracy-only ranking collapses onto best-sellers. Read coverage and novelty beside precision.",
    },
  };
}
