import { round } from "./random";
import type { Basket } from "./types";

/**
 * Association-rule mining over baskets.
 *
 *   support(A→B)    = P(A ∧ B)
 *   confidence(A→B) = P(B | A)
 *   lift(A→B)       = confidence / P(B)
 *
 * Lift is the one that matters. High confidence with lift ≈ 1 means B is simply
 * popular — the rule has discovered the best-seller list, not a relationship.
 * Rules with lift ≤ 1 are dropped by default for that reason.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — association
 * rules and market-basket analysis.
 */

export type Rule = {
  antecedent: string[];
  consequent: string;
  support: number;
  confidence: number;
  lift: number;
  leverage: number;
  transactions: number;
};

export function mineRules(
  baskets: Basket[],
  options: {
    minSupport?: number;
    minConfidence?: number;
    minLift?: number;
    maxAntecedentSize?: 1 | 2;
    maxRules?: number;
  } = {},
): { rules: Rule[]; itemsConsidered: number; basketsScanned: number } {
  const minSupport = options.minSupport ?? 0.005;
  const minConfidence = options.minConfidence ?? 0.1;
  const minLift = options.minLift ?? 1;
  const maxAntecedentSize = options.maxAntecedentSize ?? 1;
  const maxRules = options.maxRules ?? 100;

  const n = baskets.length;
  if (n === 0) return { rules: [], itemsConsidered: 0, basketsScanned: 0 };

  const singles = new Map<string, number>();
  for (const basket of baskets) {
    for (const itemId of new Set(basket.itemIds)) {
      singles.set(itemId, (singles.get(itemId) ?? 0) + 1);
    }
  }

  // Apriori pruning: only items that individually clear support can appear.
  const frequent = [...singles.entries()].filter(([, count]) => count / n >= minSupport);
  const frequentSet = new Set(frequent.map(([itemId]) => itemId));

  const pairs = new Map<string, number>();
  const triples = new Map<string, number>();

  for (const basket of baskets) {
    const items = [...new Set(basket.itemIds)].filter((id) => frequentSet.has(id)).sort();
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        const key = `${items[a]}|${items[b]}`;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
        if (maxAntecedentSize === 2) {
          for (let c = b + 1; c < items.length; c++) {
            const tripleKey = `${items[a]}|${items[b]}|${items[c]}`;
            triples.set(tripleKey, (triples.get(tripleKey) ?? 0) + 1);
          }
        }
      }
    }
  }

  const rules: Rule[] = [];
  const pushRule = (antecedent: string[], consequent: string, jointCount: number, antecedentCount: number) => {
    const support = jointCount / n;
    if (support < minSupport) return;
    const confidence = jointCount / antecedentCount;
    if (confidence < minConfidence) return;
    const consequentSupport = (singles.get(consequent) ?? 0) / n;
    if (consequentSupport === 0) return;
    const lift = confidence / consequentSupport;
    if (lift < minLift) return;
    rules.push({
      antecedent,
      consequent,
      support: round(support, 6),
      confidence: round(confidence, 6),
      lift: round(lift, 4),
      leverage: round(support - (antecedentCount / n) * consequentSupport, 6),
      transactions: jointCount,
    });
  };

  for (const [key, count] of pairs) {
    const [a, b] = key.split("|") as [string, string];
    pushRule([a], b, count, singles.get(a)!);
    pushRule([b], a, count, singles.get(b)!);
  }

  if (maxAntecedentSize === 2) {
    for (const [key, count] of triples) {
      const [a, b, c] = key.split("|") as [string, string, string];
      const pairCount = (x: string, y: string) => pairs.get(x < y ? `${x}|${y}` : `${y}|${x}`) ?? 0;
      if (pairCount(a, b) > 0) pushRule([a, b], c, count, pairCount(a, b));
      if (pairCount(a, c) > 0) pushRule([a, c], b, count, pairCount(a, c));
      if (pairCount(b, c) > 0) pushRule([b, c], a, count, pairCount(b, c));
    }
  }

  rules.sort((a, b) => b.lift - a.lift);

  return {
    rules: rules.slice(0, maxRules),
    itemsConsidered: frequent.length,
    basketsScanned: n,
  };
}

/** Rules whose antecedent is satisfied by the current basket or seed item. */
export function applyRules(rules: Rule[], context: string[]): { itemId: string; lift: number; rule: Rule }[] {
  const present = new Set(context);
  const hits = rules
    .filter((rule) => rule.antecedent.every((a) => present.has(a)) && !present.has(rule.consequent))
    .map((rule) => ({ itemId: rule.consequent, lift: rule.lift, rule }));

  const best = new Map<string, { itemId: string; lift: number; rule: Rule }>();
  for (const hit of hits) {
    const existing = best.get(hit.itemId);
    if (!existing || hit.lift > existing.lift) best.set(hit.itemId, hit);
  }
  return [...best.values()].sort((a, b) => b.lift - a.lift);
}
