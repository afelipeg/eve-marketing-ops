import { mulberry32, randomNormal, round } from "../random";
import type { Basket, Channel, Interaction, Item, Occasion, User } from "../types";

/**
 * SAMPLE DATA — generated deterministically, not a real catalog or log.
 *
 * The generator plants the structure the models are then asked to recover:
 *
 *  - A rank-4 latent factor structure behind the ratings, so SVD has a real
 *    signal to find and reconstruction error is meaningful.
 *  - A Zipf popularity law over items, so popularity bias exists and the
 *    popularity penalty and coverage metrics have something to correct.
 *  - A temporal drift in user bias plus a rising trend on a third of the items,
 *    both large relative to the rating noise, so timeSVD++ can be shown to beat
 *    plain SVD++ on a late holdout instead of being taken on faith.
 *  - Two planted association rules with high lift, for rule mining to find.
 *  - Cold users with 0-2 interactions, so cold-start routing is exercised.
 */

const SEED = 20260921;
const USERS = 600;
const ITEMS = 250;
const LATENT = 4;
const DAYS = 400;
const MU = 3.6;

const CATEGORIES = ["beverages", "snacks", "home", "personal_care", "pantry", "frozen"] as const;
const BRANDS = ["Andina", "Sierra", "Costa", "Valle"] as const;
const TAG_POOL = [
  "sugar_free", "family_pack", "single_serve", "premium", "value", "organic",
  "local", "imported", "spicy", "sweet", "salty", "refrigerated", "gift_ready", "bulk",
];
const CHANNELS: Channel[] = ["web", "mobile", "email", "pdp"];
const OCCASIONS: Occasion[] = ["everyday", "restock", "gifting", "party", "back_to_school", "holiday"];

const clampRating = (x: number) => Math.min(5, Math.max(1, x));

function build() {
  const rng = mulberry32(SEED);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;

  // Zipf-ish popularity weights: a few items dominate exposure.
  const popularityWeight = Array.from({ length: ITEMS }, (_, i) => 1 / Math.pow(i + 1, 0.85));
  const popularityTotal = popularityWeight.reduce((s, v) => s + v, 0);

  const itemFactors: number[][] = [];
  const itemBias: number[] = [];
  const items: Item[] = Array.from({ length: ITEMS }, (_, i) => {
    itemFactors.push(Array.from({ length: LATENT }, () => randomNormal(rng) * 0.55));
    itemBias.push(randomNormal(rng) * 0.45);
    const category = pick(CATEGORIES);
    const price = round(1.2 + rng() * 22, 2);
    const tags = [...new Set([pick(TAG_POOL), pick(TAG_POOL), pick(TAG_POOL)])];
    return {
      id: `item-${String(i + 1).padStart(4, "0")}`,
      title: `${pick(BRANDS)} ${category} ${i + 1}`,
      category,
      brand: pick(BRANDS),
      tags,
      price,
      margin: round(price * (0.18 + rng() * 0.3), 2),
      stockCoverWeeks: round(rng() < 0.12 ? rng() * 1.5 : 2 + rng() * 10, 2),
      sponsored: rng() < 0.12,
      popularity: 0,
      seasonality: rng() < 0.3 ? [pick(OCCASIONS)] : ["everyday"],
    };
  });

  const userFactors: number[][] = [];
  const userBias: number[] = [];
  const userDrift: number[] = [];
  const users: User[] = Array.from({ length: USERS }, (_, u) => {
    userFactors.push(Array.from({ length: LATENT }, () => randomNormal(rng) * 0.55));
    userBias.push(randomNormal(rng) * 0.4);
    // Planted temporal drift in taste, deliberately strong relative to the
    // rating noise (sd 0.32) so that timeSVD++ is *testable*: a drift smaller
    // than the noise cannot be detected by any model, and a benchmark that
    // cannot separate the models proves nothing.
    userDrift.push(randomNormal(rng) * 1.2);
    return {
      id: `user-${String(u + 1).padStart(4, "0")}`,
      segment: rng() < 0.3 ? "champions" : rng() < 0.6 ? "loyal" : "occasional",
      territory: pick(["CO-Bogota", "CO-Medellin", "CO-Cali", "CO-Barranquilla"]),
      cashFlowBand: rng() < 0.3 ? "low" : rng() < 0.75 ? "mid" : "high",
      preferredChannel: pick(CHANNELS),
      firstSeenDay: Math.floor(rng() * (DAYS * 0.6)),
      interactionCount: 0,
    };
  });

  // A third of items are "trending": their appeal rises over the window.
  // This gives the item time-bins real signal, distinct from the user drift.
  const itemTrend = Array.from({ length: ITEMS }, () => (rng() < 0.33 ? 0.8 + rng() * 0.6 : 0));

  const trueRating = (u: number, i: number, day: number): number => {
    let dot = 0;
    for (let k = 0; k < LATENT; k++) dot += userFactors[u]![k]! * itemFactors[i]![k]!;
    const phase = (day - DAYS / 2) / DAYS;
    const drift = userDrift[u]! * phase;
    const trend = itemTrend[i]! * phase;
    return MU + userBias[u]! + drift + itemBias[i]! + trend + dot + randomNormal(rng) * 0.32;
  };

  const interactions: Interaction[] = [];
  const seen = new Set<string>();

  for (let u = 0; u < USERS; u++) {
    // 8% of users stay cold, so cold-start routing is exercised.
    const cold = rng() < 0.08;
    const count = cold ? Math.floor(rng() * 3) : 6 + Math.floor(rng() * 45);
    for (let n = 0; n < count; n++) {
      // Sample an item by popularity, tilted toward latent affinity.
      let item = 0;
      const target = rng() * popularityTotal;
      let cumulative = 0;
      for (let i = 0; i < ITEMS; i++) {
        cumulative += popularityWeight[i]!;
        if (cumulative >= target) {
          item = i;
          break;
        }
      }
      if (rng() < 0.45) {
        // Affinity-driven draw: pick the better of two candidates.
        const alternative = Math.floor(rng() * ITEMS);
        const day = users[u]!.firstSeenDay;
        if (trueRating(u, alternative, day) > trueRating(u, item, day)) item = alternative;
      }
      const key = `${u}:${item}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const day = Math.min(
        DAYS,
        users[u]!.firstSeenDay + Math.floor(rng() * (DAYS - users[u]!.firstSeenDay)),
      );
      interactions.push({
        userId: users[u]!.id,
        itemId: items[item]!.id,
        rating: round(clampRating(trueRating(u, item, day)), 1),
        day,
        channel: pick(CHANNELS),
        occasion: items[item]!.seasonality[0] ?? "everyday",
      });
      items[item]!.popularity += 1;
      users[u]!.interactionCount += 1;
    }
  }

  // Baskets, with two planted high-lift rules.
  const ruleA: [number, number] = [2, 17];
  const ruleB: [number, number] = [5, 41];
  const baskets: Basket[] = [];
  for (let b = 0; b < 4_000; b++) {
    const user = users[Math.floor(rng() * USERS)]!;
    const size = 2 + Math.floor(rng() * 4);
    const chosen = new Set<number>();
    for (let s = 0; s < size; s++) {
      const target = rng() * popularityTotal;
      let cumulative = 0;
      for (let i = 0; i < ITEMS; i++) {
        cumulative += popularityWeight[i]!;
        if (cumulative >= target) {
          chosen.add(i);
          break;
        }
      }
    }
    if (chosen.has(ruleA[0]) && rng() < 0.72) chosen.add(ruleA[1]);
    if (chosen.has(ruleB[0]) && rng() < 0.65) chosen.add(ruleB[1]);
    baskets.push({
      id: `basket-${String(b + 1).padStart(5, "0")}`,
      userId: user.id,
      day: Math.floor(rng() * DAYS),
      itemIds: [...chosen].map((i) => items[i]!.id),
    });
  }

  return {
    items,
    users,
    interactions,
    baskets,
    plantedRules: [
      { antecedent: items[ruleA[0]]!.id, consequent: items[ruleA[1]]!.id },
      { antecedent: items[ruleB[0]]!.id, consequent: items[ruleB[1]]!.id },
    ],
  };
}

const generated = build();

export const SAMPLE_ITEMS = generated.items;
export const SAMPLE_USERS = generated.users;
export const SAMPLE_INTERACTIONS = generated.interactions;
export const SAMPLE_BASKETS = generated.baskets;
/** Exposed for self-testing only; never presented as a finding. */
export const PLANTED_RULES = generated.plantedRules;
