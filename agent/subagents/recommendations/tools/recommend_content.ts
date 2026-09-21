import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadInteractions, loadItems } from "../lib/data";
import { buildMatrix } from "../lib/matrix";
import { buildContentIndex, buildUserProfile, cosine, nonPersonalized, scoreAgainstProfile } from "../lib/content";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Content-based filtering over TF-IDF item vectors (tags, category, brand, occasion), plus the non-personalized Bayesian-shrunk baseline. This is the cold-start path: it needs no other user's data. On a history of fewer than three ratings the profile is centred on the catalog mean rather than the user's own mean, and the tool says which centring it used.",
  inputSchema: z.object({
    userId: z.string().optional(),
    seedItemId: z.string().optional().describe("Content-similar items to a seed, for PDP or a brand-new user."),
    slots: z.number().int().min(1).max(50).default(10),
    priceBand: z.enum(["low", "mid", "high"]).optional().describe("Cash-flow constraint on what to show."),
    occasion: z.string().optional(),
    includeNonPersonalized: z.boolean().default(true),
  }),
  label: { start: ({ userId, seedItemId }) => `Content filtering · ${seedItemId ?? userId ?? "baseline"}` },
  async execute(input) {
    const [interactions, items] = await Promise.all([loadInteractions(), loadItems()]);
    const matrix = buildMatrix(interactions.rows);
    const index = buildContentIndex(items.rows);
    const itemById = new Map(items.rows.map((i) => [i.id, i]));

    const prices = items.rows.map((i) => i.price).sort((a, b) => a - b);
    const lowCut = prices[Math.floor(prices.length * 0.33)] ?? 0;
    const highCut = prices[Math.floor(prices.length * 0.66)] ?? Infinity;
    const inBand = (price: number) =>
      input.priceBand === "low"
        ? price <= lowCut
        : input.priceBand === "high"
          ? price >= highCut
          : input.priceBand === "mid"
            ? price > lowCut && price < highCut
            : true;

    const eligible = items.rows.filter(
      (i) => inBand(i.price) && (!input.occasion || i.seasonality.includes(input.occasion as never)),
    );

    const baseline = input.includeNonPersonalized
      ? nonPersonalized(eligible, interactions.rows).slice(0, input.slots)
      : [];

    if (input.seedItemId) {
      const seed = itemById.get(input.seedItemId);
      if (!seed) throw new Error(`No item "${input.seedItemId}".`);
      const similar = eligible
        .filter((i) => i.id !== seed.id)
        .map((i) => ({
          itemId: i.id,
          score: cosine(index, seed.id, i.id),
          reason: `Similar to ${seed.title}: shares ${i.tags.filter((t) => seed.tags.includes(t)).join(", ") || i.category}`,
          source: "content",
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, input.slots);
      return {
        provenance: items.provenance,
        warning: items.warning,
        mode: "content_similar",
        seedItemId: seed.id,
        recommendations: similar,
        nonPersonalizedBaseline: baseline,
      };
    }

    if (!input.userId) {
      return {
        provenance: items.provenance,
        warning: items.warning,
        mode: "non_personalized",
        recommendations: baseline.map((row) => ({
          itemId: row.itemId,
          score: row.bayesianScore,
          reason: `Popular in the catalog (${row.ratings} ratings, mean ${row.meanRating})`,
          source: "non_personalized",
        })),
        note: "No user supplied: this is the cold-start baseline, shrunk toward the catalog mean so one 5-star rating cannot top the list.",
      };
    }

    const history = matrix.byUser.get(input.userId) ?? [];
    if (history.length === 0) {
      return {
        provenance: items.provenance,
        warning: items.warning,
        mode: "non_personalized",
        userId: input.userId,
        recommendations: baseline.map((row) => ({
          itemId: row.itemId,
          score: row.bayesianScore,
          reason: `Popular in the catalog (${row.ratings} ratings)`,
          source: "non_personalized",
        })),
        note: "User has no history at all. Content filtering needs at least one interaction; serving the non-personalized baseline.",
      };
    }

    const profile = buildUserProfile(index, input.userId, history, { globalMean: matrix.globalMean });
    const seen = new Set(history.map((h) => h.itemId));
    const recommendations = eligible
      .filter((i) => !seen.has(i.id))
      .map((i) => {
        const score = scoreAgainstProfile(index, profile, i.id);
        const liked = history
          .filter((h) => h.rating >= matrix.globalMean)
          .sort((a, b) => b.rating - a.rating)[0];
        return {
          itemId: i.id,
          score,
          reason: liked
            ? `Because you liked ${itemById.get(liked.itemId)?.title ?? liked.itemId} — same ${i.category}${
                i.tags.length ? ` / ${i.tags[0]}` : ""
              }`
            : `Matches your ${i.category} interest`,
          source: "content",
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    return {
      provenance: items.provenance,
      source: items.source,
      warning: items.warning,
      mode: "content_personalized",
      userId: input.userId,
      profile: { basedOn: profile.basedOn, centring: profile.centring, norm: Math.round(profile.norm * 1e4) / 1e4 },
      priceBand: input.priceBand ?? "any",
      recommendations: recommendations.slice(0, input.slots),
      nonPersonalizedBaseline: baseline,
      caution:
        "Content filtering can only return more of what the user already touched. As soon as the user clears the collaborative threshold, switch — otherwise the list narrows into a filter bubble.",
    };
  },
});
