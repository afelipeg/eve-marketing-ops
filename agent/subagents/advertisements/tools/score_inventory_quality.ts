import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadCreatives, loadPublishers, loadUsers } from "../lib/data";
import { DEFAULT_INVENTORY_WEIGHTS, inventoryQuality, poolAverageQuality } from "../lib/inventory";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Score inventory quality omega_a(u,i) across publishers for one creative: viewability, valid-traffic (fraud) discount, brand safety, slot position, placement fit, and per-user frequency decay, with the pool average omega_bar used to scale bids. Returns per-publisher scores, flags, and the publishers that should be excluded outright.",
  inputSchema: z.object({
    creativeId: z.string(),
    userId: z.string().optional().describe("Score for one user; omit for a representative user."),
    fraudExponent: z.number().min(0).max(6).default(DEFAULT_INVENTORY_WEIGHTS.fraudExponent),
    frequencySoftCap: z.number().int().min(1).max(50).default(DEFAULT_INVENTORY_WEIGHTS.frequencySoftCap),
    excludeBelowOmega: z.number().min(0).max(1).default(0.1),
    topN: z.number().int().min(0).max(100).default(10),
  }),
  label: { start: ({ creativeId }) => `Score omega(u,i) · ${creativeId}` },
  async execute(input) {
    const [publishers, users, creatives] = await Promise.all([loadPublishers(), loadUsers(), loadCreatives()]);
    const creative = creatives.rows.find((c) => c.id === input.creativeId);
    if (!creative) throw new Error(`No creative "${input.creativeId}".`);
    const user = input.userId
      ? users.rows.find((u) => u.id === input.userId)
      : users.rows.find((u) => u.impressionsServed <= 2) ?? users.rows[0];
    if (!user) throw new Error(`No user "${input.userId}".`);

    const weights = {
      ...DEFAULT_INVENTORY_WEIGHTS,
      fraudExponent: input.fraudExponent,
      frequencySoftCap: input.frequencySoftCap,
    };

    const scored = publishers.rows
      .map((publisher) => ({
        publisher,
        score: inventoryQuality({ publisher, user, creative, weights }),
      }))
      .sort((a, b) => b.score.omega - a.score.omega);

    const omegaBar = poolAverageQuality(scored.map((s) => s.score.omega));
    const excluded = scored.filter((s) => s.score.omega < input.excludeBelowOmega);

    return {
      provenance: publishers.provenance,
      warning: publishers.warning,
      creative: creative.id,
      scoredForUser: { id: user.id, impressionsServed: user.impressionsServed },
      weights,
      omegaBar,
      byTier: ["premium", "mid", "long_tail"].map((tier) => {
        const slice = scored.filter((s) => s.publisher.tier === tier);
        return {
          tier,
          publishers: slice.length,
          meanOmega: poolAverageQuality(slice.map((s) => s.score.omega)),
          meanFraudProbability:
            slice.length === 0
              ? 0
              : Math.round((slice.reduce((s, r) => s + r.publisher.fraudProbability, 0) / slice.length) * 1e4) / 1e4,
        };
      }),
      best: scored.slice(0, input.topN).map((s) => ({
        publisherId: s.publisher.id,
        domain: s.publisher.domain,
        tier: s.publisher.tier,
        omega: s.score.omega,
        components: s.score.components,
      })),
      excludeList: excluded.map((s) => ({
        publisherId: s.publisher.id,
        domain: s.publisher.domain,
        omega: s.score.omega,
        flags: s.score.flags,
      })),
      caution:
        "Fraud is discounted here, in omega, and deliberately kept out of the response model. A click-trained psi would learn invalid traffic as a positive signal; omega is where it must be priced.",
    };
  },
});
