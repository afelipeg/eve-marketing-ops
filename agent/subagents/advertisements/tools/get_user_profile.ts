import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadUsers } from "../lib/data";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Read user profiles assembled from URL history and DMP segments: per-category affinity, brand page views, days since the last brand visit, session intensity, prior conversion, device, geo, and impressions already served this period. This is the input to brand proximity and to frequency policy.",
  inputSchema: z.object({
    userId: z.string().optional(),
    geo: z.string().optional(),
    minBrandPageViews: z.number().min(0).optional(),
    segment: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(10),
  }),
  label: { start: ({ userId }) => `Read user profile${userId ? ` · ${userId}` : "s"}` },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadUsers();

    const filtered = rows.filter(
      (u) =>
        (!input.userId || u.id === input.userId) &&
        (!input.geo || u.geo === input.geo) &&
        (input.minBrandPageViews === undefined || u.brandPageViews >= input.minBrandPageViews) &&
        (!input.segment || u.dmpSegments.includes(input.segment)),
    );

    const avg = (pick: (u: (typeof rows)[number]) => number) =>
      filtered.length === 0 ? 0 : Math.round((filtered.reduce((s, u) => s + pick(u), 0) / filtered.length) * 1e4) / 1e4;

    return {
      provenance,
      source,
      warning,
      matched: filtered.length,
      summary: {
        avgSessions: avg((u) => u.sessions),
        avgBrandPageViews: avg((u) => u.brandPageViews),
        avgImpressionsServed: avg((u) => u.impressionsServed),
        priorConverterShare: avg((u) => (u.priorConversion ? 1 : 0)),
        coldShare: avg((u) => (u.daysSinceBrandVisit >= 90 ? 1 : 0)),
      },
      deviceMix: ["mobile", "desktop", "ctv", "tablet"].map((device) => ({
        device,
        users: filtered.filter((u) => u.device === device).length,
      })),
      segments: [...new Set(rows.flatMap((u) => u.dmpSegments))],
      profiles: filtered.slice(0, input.limit),
    };
  },
});
