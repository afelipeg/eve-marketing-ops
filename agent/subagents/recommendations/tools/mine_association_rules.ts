import { defineTool } from "eve/tools";
import { z } from "zod";
import { applyRules, mineRules } from "../lib/assoc";
import { loadBaskets, loadItems } from "../lib/data";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Mine association rules from transaction baskets with support, confidence, lift and leverage, and optionally apply them to a current basket or seed item to produce cross-sell recommendations. Rules with lift at or below 1 are dropped: high confidence with lift ~1 has discovered the best-seller list, not a relationship.",
  inputSchema: z.object({
    minSupport: z.number().min(0.0001).max(0.5).default(0.002),
    minConfidence: z.number().min(0).max(1).default(0.05),
    minLift: z.number().min(0).max(100).default(1.2),
    maxAntecedentSize: z.union([z.literal(1), z.literal(2)]).default(1),
    basketItemIds: z.array(z.string()).optional().describe("Apply rules to this basket."),
    maxRules: z.number().int().min(1).max(500).default(50),
  }),
  label: { start: ({ basketItemIds }) => `Association rules${basketItemIds?.length ? " · apply to basket" : ""}` },
  async execute(input) {
    const [baskets, items] = await Promise.all([loadBaskets(), loadItems()]);
    const itemById = new Map(items.rows.map((i) => [i.id, i]));

    const mined = mineRules(baskets.rows, {
      minSupport: input.minSupport,
      minConfidence: input.minConfidence,
      minLift: input.minLift,
      maxAntecedentSize: input.maxAntecedentSize,
      maxRules: input.maxRules,
    });

    const applied = input.basketItemIds?.length
      ? applyRules(mined.rules, input.basketItemIds).map((hit) => ({
          itemId: hit.itemId,
          score: hit.lift,
          reason: `Frequently bought with ${hit.rule.antecedent
            .map((id) => itemById.get(id)?.title ?? id)
            .join(" + ")} (lift ${hit.rule.lift}, confidence ${Math.round(hit.rule.confidence * 100)}%)`,
          source: "association_rule",
          rule: hit.rule,
        }))
      : [];

    return {
      provenance: baskets.provenance,
      source: baskets.source,
      warning: baskets.warning,
      basketsScanned: mined.basketsScanned,
      frequentItems: mined.itemsConsidered,
      rulesFound: mined.rules.length,
      thresholds: {
        minSupport: input.minSupport,
        minConfidence: input.minConfidence,
        minLift: input.minLift,
      },
      topRules: mined.rules.slice(0, 20).map((rule) => ({
        ...rule,
        antecedentTitles: rule.antecedent.map((id) => itemById.get(id)?.title ?? id),
        consequentTitle: itemById.get(rule.consequent)?.title ?? rule.consequent,
      })),
      crossSell: applied,
      caution:
        "Association rules are co-occurrence, not causation: a rule says these items appear together, not that recommending one causes the other to sell. Rules also decay — re-mine on a rolling window, and check that a high-lift rule is not an artifact of one promotion.",
    };
  },
});
