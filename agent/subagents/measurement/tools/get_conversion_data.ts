import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadJourneys } from "../lib/data";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Read conversion journeys: ordered touchpoint paths with conversion flags, counts, and values, plus per-channel exposure and conversion summaries. Input for attribution_v_star. Always report the returned `provenance`.",
  inputSchema: z.object({
    channel: z.string().optional().describe("Return only journeys that touched this channel."),
    convertedOnly: z.boolean().default(false),
    maxPaths: z.number().int().min(1).max(500).default(100),
  }),
  label: { start: () => "Read conversion journeys" },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadJourneys();

    const filtered = rows.filter(
      (r) =>
        (!input.channel || r.path.includes(input.channel)) &&
        (!input.convertedOnly || r.converted),
    );

    const channels = [...new Set(rows.flatMap((r) => r.path))].sort();
    const perChannel = channels.map((channel) => {
      const touched = rows.filter((r) => r.path.includes(channel));
      const exposures = touched.reduce((s, r) => s + r.count, 0);
      const conversions = touched.filter((r) => r.converted).reduce((s, r) => s + r.count, 0);
      return {
        channel,
        exposures,
        conversions,
        rawConversionRate: exposures === 0 ? 0 : Math.round((conversions / exposures) * 1e6) / 1e6,
      };
    });

    const totalJourneys = rows.reduce((s, r) => s + r.count, 0);
    const totalConversions = rows.filter((r) => r.converted).reduce((s, r) => s + r.count, 0);

    return {
      provenance,
      source,
      warning,
      channels,
      totals: {
        journeys: totalJourneys,
        conversions: totalConversions,
        conversionRate: totalJourneys === 0 ? 0 : Math.round((totalConversions / totalJourneys) * 1e6) / 1e6,
        averagePathLength:
          totalJourneys === 0
            ? 0
            : Math.round((rows.reduce((s, r) => s + r.path.length * r.count, 0) / totalJourneys) * 100) / 100,
      },
      perChannel,
      caution:
        "Per-channel rates here are raw co-occurrence, not causal credit. Use attribution_v_star before assigning any contribution.",
      journeys: filtered.slice(0, input.maxPaths),
    };
  },
});
