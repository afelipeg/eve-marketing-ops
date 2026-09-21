import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadInteractions, loadUsers } from "../lib/data";
import { buildMatrix, sparsityReport, temporalSplit } from "../lib/matrix";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Read the user-item rating matrix: size, density, ratings per user and per item, cold users and items, popularity concentration, and the temporal train/test split used for offline evaluation. Use before choosing an algorithm — density and cold-start share decide whether collaborative filtering is even available.",
  inputSchema: z.object({
    userId: z.string().optional().describe("Return one user's history."),
    cutoffQuantile: z.number().min(0.5).max(0.95).default(0.8),
    limit: z.number().int().min(0).max(200).default(20),
  }),
  label: { start: () => "Read rating matrix" },
  async execute(input) {
    const [interactions, users] = await Promise.all([loadInteractions(), loadUsers()]);
    const matrix = buildMatrix(interactions.rows);
    const report = sparsityReport(matrix);
    const split = temporalSplit(interactions.rows, input.cutoffQuantile);

    const history = input.userId ? matrix.byUser.get(input.userId) ?? [] : [];
    const profile = input.userId ? users.rows.find((u) => u.id === input.userId) : undefined;

    return {
      provenance: interactions.provenance,
      source: interactions.source,
      warning: interactions.warning,
      matrix: report,
      globalMeanRating: matrix.globalMean,
      split: {
        cutoffDay: split.cutoffDay,
        train: split.train.length,
        test: split.test.length,
        testUsers: split.testUsers.length,
        note:
          "Split is by time, not at random. A random split lets a model see a user's future when predicting their past, which inflates every offline metric.",
      },
      routing: {
        rule:
          "3+ interactions → collaborative filtering (item-based first). Fewer → content filtering. None → non-personalized.",
        coldUserShare: Math.round((report.coldUsers / Math.max(1, report.users)) * 1e4) / 1e4,
        coldItemShare: Math.round((report.coldItems / Math.max(1, report.items)) * 1e4) / 1e4,
      },
      user: input.userId
        ? {
            profile: profile ?? null,
            interactions: history.length,
            recent: [...history].sort((a, b) => b.day - a.day).slice(0, input.limit),
          }
        : undefined,
    };
  },
});
