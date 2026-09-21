import { defineTool } from "eve/tools";
import { z } from "zod";
import { applyRules, mineRules } from "../lib/assoc";
import { buildContentIndex, buildUserProfile, cosine, nonPersonalized, scoreAgainstProfile } from "../lib/content";
import { loadBaskets, loadInteractions, loadItems, popularityMap } from "../lib/data";
import { buildMatrix, temporalSplit } from "../lib/matrix";
import { predictMf, trainMf } from "../lib/mf";
import { buildItemSimilarity, predictItemBased } from "../lib/similarity";
import { channelSchema, occasionSchema } from "../lib/types";

/**
 * Hybrid recommender with explicit context routing.
 *
 * switching            — pick one model by data availability (the cold-start router)
 * weighted             — blend normalized scores from every available model
 * feature_augmentation — one model's output becomes a feature of another
 *                        (here: content similarity boosts the CF score)
 */
export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Produce recommendations by combining collaborative, latent-factor, content and association-rule models under an explicit strategy: switching (route by data availability), weighted (blend normalized scores), or feature_augmentation (content similarity boosts the collaborative score). Applies request context — channel, occasion, cash-flow band, seed item, time — before ranking. This is the default entry point for a recommendation request.",
  inputSchema: z.object({
    userId: z.string().optional(),
    seedItemId: z.string().optional(),
    strategy: z.enum(["switching", "weighted", "feature_augmentation"]).default("switching"),
    channel: channelSchema.default("web"),
    occasion: occasionSchema.default("everyday"),
    cashFlowBand: z.enum(["low", "mid", "high"]).optional(),
    atDay: z.number().min(0).optional(),
    slots: z.number().int().min(1).max(50).default(10),
    weights: z
      .object({
        latent: z.number().min(0).default(0.45),
        collaborative: z.number().min(0).default(0.25),
        content: z.number().min(0).default(0.2),
        association: z.number().min(0).default(0.1),
      })
      .optional(),
    candidatePool: z.number().int().min(10).max(500).default(80),
  }),
  label: { start: ({ strategy, userId, seedItemId }) => `Hybrid (${strategy}) · ${userId ?? seedItemId ?? "cold"}` },
  async execute(input) {
    const [interactions, items, baskets] = await Promise.all([loadInteractions(), loadItems(), loadBaskets()]);
    const matrix = buildMatrix(interactions.rows);
    const index = buildContentIndex(items.rows);
    const itemById = new Map(items.rows.map((i) => [i.id, i]));
    const popularity = popularityMap(items.rows);
    const split = temporalSplit(interactions.rows, 0.8);
    const day = input.atDay ?? split.cutoffDay + 10;

    const history = input.userId ? matrix.byUser.get(input.userId) ?? [] : [];
    const seen = new Set(history.map((h) => h.itemId));

    // Context filters applied before scoring: what may be shown at all.
    const prices = items.rows.map((i) => i.price).sort((a, b) => a - b);
    const lowCut = prices[Math.floor(prices.length * 0.33)] ?? 0;
    const highCut = prices[Math.floor(prices.length * 0.66)] ?? Infinity;
    const eligible = items.rows.filter((item) => {
      if (seen.has(item.id)) return false;
      if (item.stockCoverWeeks < 0.5) return false;
      // All three bands, against their own cut. The previous version compared
      // the high band against lowCut and had no mid branch at all, so a
      // high-band customer was shown 33rd-percentile items and a mid-band
      // customer was not filtered at all.
      if (input.cashFlowBand === "low" && item.price > lowCut) return false;
      if (input.cashFlowBand === "mid" && (item.price <= lowCut || item.price >= highCut)) return false;
      if (input.cashFlowBand === "high" && item.price < highCut) return false;
      if (input.occasion !== "everyday" && !item.seasonality.includes(input.occasion)) return false;
      // Email slates are cheap to send but expensive to waste: require stock.
      if (input.channel === "email" && item.stockCoverWeeks < 2) return false;
      return true;
    });

    const contextNote = `channel=${input.channel} occasion=${input.occasion} cashFlow=${input.cashFlowBand ?? "any"} seen=${seen.size} eligible=${eligible.length}`;
    if (eligible.length === 0) {
      return { refused: true, reason: "No item survives the context filters.", context: contextNote };
    }

    const availability = {
      interactions: history.length,
      collaborative: history.length >= 3,
      content: history.length >= 1,
      latent: history.length >= 3,
      association: Boolean(input.seedItemId) || history.length > 0,
    };

    // --- individual model scores, each normalized to [0,1] within the pool ---
    const normalize = (rows: { itemId: string; score: number }[]) => {
      if (rows.length === 0) return new Map<string, number>();
      const values = rows.map((r) => r.score);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = Math.max(1e-9, max - min);
      return new Map(rows.map((r) => [r.itemId, (r.score - min) / range]));
    };

    const scores: Record<string, Map<string, number>> = {};
    const reasons = new Map<string, string>();

    if (availability.content) {
      const profile = buildUserProfile(index, input.userId!, history, { globalMean: matrix.globalMean });
      const liked = [...history].sort((a, b) => b.rating - a.rating)[0];
      const rows = eligible.map((item) => ({ itemId: item.id, score: scoreAgainstProfile(index, profile, item.id) }));
      scores.content = normalize(rows);
      for (const row of rows) {
        if (row.score > 0 && liked) {
          reasons.set(row.itemId, `Because you liked ${itemById.get(liked.itemId)?.title ?? liked.itemId}`);
        }
      }
    } else if (input.seedItemId) {
      const rows = eligible.map((item) => ({ itemId: item.id, score: cosine(index, input.seedItemId!, item.id) }));
      scores.content = normalize(rows);
      for (const row of rows) {
        reasons.set(row.itemId, `Similar to ${itemById.get(input.seedItemId)?.title ?? input.seedItemId}`);
      }
    }

    if (availability.collaborative) {
      const similarity = buildItemSimilarity(matrix, { topK: 40, minSupport: 3 });
      const rows = eligible
        .map((item) => {
          const prediction = predictItemBased({ matrix, similarity, userId: input.userId!, itemId: item.id, k: 20 });
          if (prediction.prediction === null) return null;
          if (prediction.contributors.length > 0) {
            reasons.set(
              item.id,
              `Because you rated ${prediction.contributors.map((id) => itemById.get(id)?.title ?? id).slice(0, 2).join(" and ")}`,
            );
          }
          return { itemId: item.id, score: prediction.prediction };
        })
        .filter((r): r is { itemId: string; score: number } => r !== null);
      scores.collaborative = normalize(rows);
    }

    if (availability.latent) {
      const model = trainMf(matrix, split.train, { factors: 8, epochs: 30, implicit: true, temporal: true, seed: 11 });
      const rows = eligible
        .map((item) => ({ itemId: item.id, score: predictMf(model, input.userId!, item.id, day) ?? 0 }))
        .filter((r) => r.score > 0);
      scores.latent = normalize(rows);
    }

    const context = input.seedItemId ? [input.seedItemId] : history.slice(-3).map((h) => h.itemId);
    if (context.length > 0) {
      const mined = mineRules(baskets.rows, { minSupport: 0.002, minConfidence: 0.05, minLift: 1.2, maxRules: 200 });
      const hits = applyRules(mined.rules, context);
      const rows = hits.filter((h) => !seen.has(h.itemId)).map((h) => ({ itemId: h.itemId, score: h.lift }));
      scores.association = normalize(rows);
      for (const hit of hits) {
        if (!reasons.has(hit.itemId)) {
          reasons.set(
            hit.itemId,
            `Frequently bought with ${hit.rule.antecedent.map((id) => itemById.get(id)?.title ?? id).join(" + ")}`,
          );
        }
      }
    }

    // --------------------------------- combine ---------------------------------
    const weights = { latent: 0.45, collaborative: 0.25, content: 0.2, association: 0.1, ...input.weights };
    let combined: { itemId: string; score: number; source: string; reason: string }[] = [];
    let strategyUsed = input.strategy;

    if (input.strategy === "switching" || !availability.collaborative) {
      const order: [string, Map<string, number> | undefined][] = [
        ["latent", scores.latent],
        ["collaborative", scores.collaborative],
        ["content", scores.content],
        ["association", scores.association],
      ];
      const picked = order.find(([, map]) => map && map.size > 0);
      strategyUsed = "switching";
      if (!picked) {
        const baseline = nonPersonalized(eligible, interactions.rows).slice(0, input.slots);
        return {
          provenance: interactions.provenance,
          warning: interactions.warning,
          strategy: "switching",
          routedTo: "non_personalized",
          context: contextNote,
          availability,
          recommendations: baseline.map((row) => ({
            itemId: row.itemId,
            score: row.bayesianScore,
            source: "non_personalized",
            reason: `Popular in the catalog (${row.ratings} ratings)`,
          })),
        };
      }
      const [name, map] = picked;
      combined = [...map!.entries()].map(([itemId, score]) => ({
        itemId,
        score,
        source: name,
        reason: reasons.get(itemId) ?? "Recommended for you",
      }));
    } else if (input.strategy === "weighted") {
      const all = new Set(Object.values(scores).flatMap((m) => [...m.keys()]));
      combined = [...all].map((itemId) => {
        let score = 0;
        const parts: string[] = [];
        for (const [name, map] of Object.entries(scores)) {
          const value = map.get(itemId);
          if (value === undefined) continue;
          score += (weights as Record<string, number>)[name]! * value;
          parts.push(name);
        }
        return { itemId, score, source: `weighted(${parts.join("+")})`, reason: reasons.get(itemId) ?? "Recommended for you" };
      });
    } else {
      // feature augmentation: content similarity to the user's liked set boosts CF.
      const base = scores.latent ?? scores.collaborative ?? scores.content ?? new Map<string, number>();
      combined = [...base.entries()].map(([itemId, score]) => {
        const contentBoost = scores.content?.get(itemId) ?? 0;
        return {
          itemId,
          score: score * (1 + 0.35 * contentBoost),
          source: "feature_augmentation",
          reason: reasons.get(itemId) ?? "Recommended for you",
        };
      });
    }

    const ranked = combined.sort((a, b) => b.score - a.score).slice(0, input.candidatePool);

    return {
      provenance: interactions.provenance,
      source: interactions.source,
      warning: interactions.warning,
      strategy: strategyUsed,
      requestedStrategy: input.strategy,
      context: contextNote,
      availability,
      weights: input.strategy === "weighted" ? weights : undefined,
      modelsAvailable: Object.keys(scores),
      candidates: ranked.length,
      recommendations: ranked.slice(0, input.slots).map((r) => ({
        ...r,
        score: Math.round(r.score * 1e6) / 1e6,
        popularity: popularity.get(r.itemId) ?? 0,
        margin: itemById.get(r.itemId)?.margin ?? null,
      })),
      candidatePool: ranked.map((r) => r.itemId),
      nextStep:
        "Pass candidatePool to optimize_multi_objective when secondary objectives apply, then always to rerank_for_diversity before presentation.",
    };
  },
});
