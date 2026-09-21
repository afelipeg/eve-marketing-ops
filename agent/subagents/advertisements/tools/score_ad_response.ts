import { defineTool } from "eve/tools";
import { z } from "zod";
import { FEATURE_NAMES, loadCreatives, loadImpressions, loadPublishers, loadUsers, responseFeatures } from "../lib/data";
import { fitLogistic, predictLogistic } from "../lib/models";
import { brandProximity } from "../lib/proximity";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Fit the ad response model psi_a(u) on impression logs and return fit quality, coefficients, decile lift, and the pool mean psi_bar used to scale bids. Defaults to training on conversions. Training on clicks is available for diagnosis and is reported with an explicit warning, because invalid traffic produces clicks and no conversions — a click-trained bidder overpays for exactly the worst inventory.",
  inputSchema: z.object({
    creativeId: z.string().optional().describe("Fit on one creative's impressions; omit to pool."),
    target: z.enum(["conversion", "click"]).default("conversion"),
    iterations: z.number().int().min(50).max(2_000).default(300),
    l2: z.number().min(0).max(1).default(0.001),
  }),
  label: { start: ({ target, creativeId }) => `Fit psi_a(u) on ${target}${creativeId ? ` · ${creativeId}` : ""}` },
  async execute(input) {
    const [impressions, users, publishers, creatives] = await Promise.all([
      loadImpressions(),
      loadUsers(),
      loadPublishers(),
      loadCreatives(),
    ]);
    const U = new Map(users.rows.map((u) => [u.id, u]));
    const P = new Map(publishers.rows.map((p) => [p.id, p]));
    const C = new Map(creatives.rows.map((c) => [c.id, c]));

    const pool = input.creativeId
      ? impressions.rows.filter((i) => i.creativeId === input.creativeId)
      : impressions.rows;
    if (pool.length < 500) {
      throw new Error(`Only ${pool.length} impressions after filtering; need at least 500 to fit psi.`);
    }

    const rows = pool.map((impression) => {
      const user = U.get(impression.userId)!;
      const publisher = P.get(impression.publisherId)!;
      const creative = C.get(impression.creativeId)!;
      const phi = brandProximity(user, creative).phi;
      return {
        features: responseFeatures({ phi, user, publisher, position: impression.position, hour: impression.hour }),
        label: input.target === "conversion" ? (impression.converted ? 1 : 0) : impression.clicked ? 1 : 0,
        impression,
        publisher,
      };
    });

    const positives = rows.filter((r) => r.label === 1).length;
    if (positives < 20) {
      throw new Error(
        `Only ${positives} positive outcomes in this slice. Fitting psi on fewer than 20 events produces a model that cannot be used for bidding — widen the window or pool creatives.`,
      );
    }

    const model = fitLogistic(rows, [...FEATURE_NAMES], { iterations: input.iterations, l2: input.l2 });
    const scored = rows
      .map((r) => ({ psi: predictLogistic(model, r.features), label: r.label, tier: r.publisher.tier }))
      .sort((a, b) => b.psi - a.psi);

    const size = Math.floor(scored.length / 10);
    const deciles = Array.from({ length: 10 }, (_, d) => {
      const slice = scored.slice(d * size, (d + 1) * size);
      const rate = slice.reduce((s, r) => s + r.label, 0) / slice.length;
      return {
        decile: d + 1,
        impressions: slice.length,
        outcomeRate: Math.round(rate * 1e6) / 1e6,
        lift: Math.round((rate / model.baseRate) * 100) / 100,
      };
    });

    const byTier = ["premium", "mid", "long_tail"].map((tier) => {
      const slice = scored.filter((s) => s.tier === tier);
      return {
        tier,
        impressions: slice.length,
        meanPsi: slice.length === 0 ? 0 : Math.round((slice.reduce((s, r) => s + r.psi, 0) / slice.length) * 1e6) / 1e6,
        observedRate:
          slice.length === 0 ? 0 : Math.round((slice.reduce((s, r) => s + r.label, 0) / slice.length) * 1e6) / 1e6,
      };
    });

    return {
      provenance: impressions.provenance,
      warning: impressions.warning,
      target: input.target,
      trainingWarning:
        input.target === "click"
          ? "TRAINED ON CLICKS. Do not bid on this model: click rate is inflated by invalid traffic, so it ranks fraudulent inventory highest. Use it only to compare against the conversion model."
          : undefined,
      model: {
        n: model.n,
        positives,
        baseRate: model.baseRate,
        auc: model.auc,
        logLoss: model.logLoss,
        psiBar: model.baseRate,
        coefficients: model.featureNames
          .map((name, i) => ({ feature: name, standardizedWeight: model.weights[i]! }))
          .sort((a, b) => Math.abs(b.standardizedWeight) - Math.abs(a.standardizedWeight)),
      },
      fitQuality:
        model.auc >= 0.7
          ? "Usable for bidding."
          : model.auc >= 0.6
            ? "Weak: bid scalings will be noisy. Widen features or window before trusting thin slices."
            : "Not usable for bidding: close to random ordering.",
      deciles,
      byPublisherTier: byTier,
      caution:
        "psi_bar here is the pool mean used by s1(psi). Recompute it whenever the inventory mix changes, or every bid is scaled against a stale baseline.",
    };
  },
});
