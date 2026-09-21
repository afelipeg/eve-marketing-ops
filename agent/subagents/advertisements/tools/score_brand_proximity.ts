import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadCreatives, loadUsers } from "../lib/data";
import { DEFAULT_PROXIMITY_WEIGHTS, brandProximity } from "../lib/proximity";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Compute brand proximity phi(u) for one user or the whole pool: category affinity from URL history, exponential decay on brand-contact recency, contact depth, and prior conversion, returned with every component and a band (cold/aware/engaged/loyal). phi describes the state of the relationship, not the probability of response.",
  inputSchema: z.object({
    creativeId: z.string(),
    userId: z.string().optional(),
    weights: z
      .object({
        categoryAffinity: z.number().min(0).default(DEFAULT_PROXIMITY_WEIGHTS.categoryAffinity),
        recency: z.number().min(0).default(DEFAULT_PROXIMITY_WEIGHTS.recency),
        depth: z.number().min(0).default(DEFAULT_PROXIMITY_WEIGHTS.depth),
        priorConversion: z.number().min(0).default(DEFAULT_PROXIMITY_WEIGHTS.priorConversion),
        recencyHalfLifeDays: z.number().min(1).default(DEFAULT_PROXIMITY_WEIGHTS.recencyHalfLifeDays),
        depthSaturation: z.number().min(1).default(DEFAULT_PROXIMITY_WEIGHTS.depthSaturation),
      })
      .optional(),
    topN: z.number().int().min(0).max(200).default(10),
  }),
  label: { start: ({ creativeId }) => `Score phi(u) · ${creativeId}` },
  async execute(input) {
    const [users, creatives] = await Promise.all([loadUsers(), loadCreatives()]);
    const creative = creatives.rows.find((c) => c.id === input.creativeId);
    if (!creative) {
      throw new Error(
        `No creative "${input.creativeId}". Available: ${creatives.rows.map((c) => c.id).join(", ")}.`,
      );
    }
    const weights = { ...DEFAULT_PROXIMITY_WEIGHTS, ...input.weights };

    const pool = input.userId ? users.rows.filter((u) => u.id === input.userId) : users.rows;
    if (pool.length === 0) throw new Error(`No user "${input.userId}".`);

    const scored = pool.map((u) => brandProximity(u, creative, weights));
    const bands = ["cold", "aware", "engaged", "loyal"].map((band) => {
      const members = scored.filter((s) => s.band === band);
      return {
        band,
        users: members.length,
        share: Math.round((members.length / scored.length) * 1e4) / 1e4,
        meanPhi:
          members.length === 0
            ? 0
            : Math.round((members.reduce((s, m) => s + m.phi, 0) / members.length) * 1e4) / 1e4,
      };
    });

    return {
      provenance: users.provenance,
      warning: users.warning,
      creative: { id: creative.id, brand: creative.brand, category: creative.category },
      weights,
      scored: scored.length,
      meanPhi: Math.round((scored.reduce((s, m) => s + m.phi, 0) / scored.length) * 1e6) / 1e6,
      bands,
      top: [...scored].sort((a, b) => b.phi - a.phi).slice(0, input.topN),
      caution:
        "High phi means the user is already close to the brand. That is a reason to cap frequency and shift budget to prospecting, not an automatic reason to bid more — proximity and incrementality often move in opposite directions.",
    };
  },
});
