import { defineTool } from "eve/tools";
import { z } from "zod";
import { FEATURE_NAMES, featuresOf, loadCustomers } from "../lib/data";
import { fitLogistic, predictLogistic } from "../lib/models";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Build a look-alike audience: fit a logistic model that separates a seed group from the rest of the base, then rank non-seed customers by similarity. Seeds are defined by a rule (segment attributes) or an explicit id list. Returns the model's separability (AUC), the ranked audience at a chosen size, and how the audience differs from the seed on each feature.",
  inputSchema: z.object({
    seedCustomerIds: z.array(z.string()).optional(),
    seedRule: z
      .object({
        minFrequency: z.number().optional(),
        maxRecencyDays: z.number().optional(),
        minMonetary: z.number().optional(),
        territories: z.array(z.string()).optional(),
      })
      .optional(),
    audienceSize: z.number().int().min(1).max(100_000).default(500),
    topN: z.number().int().min(0).max(200).default(10),
  }),
  label: { start: ({ audienceSize }) => `Build look-alike audience (${audienceSize})` },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadCustomers();

    const isSeed = (c: (typeof rows)[number]): boolean => {
      if (input.seedCustomerIds?.length) return input.seedCustomerIds.includes(c.id);
      const rule = input.seedRule;
      if (!rule) return false;
      return (
        (rule.minFrequency === undefined || c.frequency >= rule.minFrequency) &&
        (rule.maxRecencyDays === undefined || c.recencyDays <= rule.maxRecencyDays) &&
        (rule.minMonetary === undefined || c.monetary >= rule.minMonetary) &&
        (!rule.territories?.length || rule.territories.includes(c.territory))
      );
    };

    const seeds = rows.filter(isSeed);
    if (seeds.length < 30) {
      throw new Error(
        `Seed group has ${seeds.length} customers. A look-alike model needs at least 30 seeds; widen the rule or supply more ids.`,
      );
    }

    const model = fitLogistic(
      rows.map((c) => ({ features: featuresOf(c), label: isSeed(c) ? 1 : 0 })),
      [...FEATURE_NAMES],
    );

    const candidates = rows
      .filter((c) => !isSeed(c))
      .map((c) => ({ customerId: c.id, similarity: Math.round(predictLogistic(model, featuresOf(c)) * 1e6) / 1e6, customer: c }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, input.audienceSize);

    const mean = (set: { customer: (typeof rows)[number] }[], pick: (c: (typeof rows)[number]) => number) =>
      set.length === 0 ? 0 : Math.round((set.reduce((s, r) => s + pick(r.customer), 0) / set.length) * 100) / 100;
    const seedMean = (pick: (c: (typeof rows)[number]) => number) =>
      Math.round((seeds.reduce((s, c) => s + pick(c), 0) / seeds.length) * 100) / 100;

    return {
      provenance,
      source,
      warning,
      seedSize: seeds.length,
      audienceSize: candidates.length,
      separability: {
        auc: model.auc,
        verdict:
          model.auc >= 0.75
            ? "Seed group is distinctive: the look-alike ranking is meaningful."
            : model.auc >= 0.6
              ? "Seed group is only moderately distinctive; the tail of this audience is close to random."
              : "Seed group is not separable from the base on these features. A look-alike audience here is effectively a random sample — say so.",
      },
      profileComparison: FEATURE_NAMES.map((name, i) => ({
        feature: name,
        seedMean: seedMean((c) => featuresOf(c)[i]!),
        audienceMean: mean(candidates, (c) => featuresOf(c)[i]!),
      })),
      topMatches: candidates.slice(0, input.topN).map(({ customerId, similarity }) => ({ customerId, similarity })),
      caution:
        "Look-alike similarity is not uplift. Score the resulting audience with score_uplift before contacting it, or the campaign targets people who resemble buyers rather than people the offer would move.",
    };
  },
});
