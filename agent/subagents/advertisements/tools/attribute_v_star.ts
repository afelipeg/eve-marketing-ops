import { defineTool } from "eve/tools";
import { z } from "zod";
import { attribute, type Journey } from "../lib/attribution";
import { loadImpressions, loadPublishers } from "../lib/data";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Attribute conversions across publishers, publisher tiers, or placements with the causal model V_k* — the conversion probability the journey graph loses when a touchpoint is ablated — and derive CPA_a, the attributed cost per acquisition per channel, from realized clearing prices. Last-touch is deliberately not implemented. Planning-time estimate: the measurement agent owns the validated read.",
  inputSchema: z.object({
    dimension: z.enum(["publisher", "tier", "placement"]).default("tier"),
    method: z.enum(["removal-effect", "shapley"]).default("removal-effect"),
    creativeId: z.string().optional(),
    bootstrapReplicates: z.number().int().min(0).max(300).default(0),
    ciLevel: z.number().min(0.5).max(0.999).default(0.9),
    seed: z.number().int().optional(),
    maxChannels: z.number().int().min(2).max(40).default(12),
  }),
  label: { start: ({ dimension, method }) => `V_k* by ${dimension} · ${method}` },
  async execute(input) {
    const [impressions, publishers] = await Promise.all([loadImpressions(), loadPublishers()]);
    const P = new Map(publishers.rows.map((p) => [p.id, p]));

    const pool = input.creativeId
      ? impressions.rows.filter((i) => i.creativeId === input.creativeId)
      : impressions.rows;
    if (pool.length === 0) throw new Error("No impressions in this slice.");

    const channelOf = (impressionPublisherId: string, placement: string): string => {
      if (input.dimension === "placement") return placement;
      const publisher = P.get(impressionPublisherId);
      if (!publisher) return "unknown";
      return input.dimension === "tier" ? publisher.tier : publisher.domain;
    };

    // Build one journey per user: ordered distinct touchpoints, converted flag.
    const byUser = new Map<string, { path: string[]; converted: boolean; spendCpm: number }>();
    const spendByChannel = new Map<string, number>();

    for (const impression of pool) {
      const channel = channelOf(impression.publisherId, impression.placement);
      const journey = byUser.get(impression.userId) ?? { path: [], converted: false, spendCpm: 0 };
      if (!journey.path.includes(channel)) journey.path.push(channel);
      journey.converted = journey.converted || impression.converted;
      journey.spendCpm += impression.clearingCpm;
      byUser.set(impression.userId, journey);
      spendByChannel.set(channel, (spendByChannel.get(channel) ?? 0) + impression.clearingCpm / 1_000);
    }

    const allChannels = [...spendByChannel.keys()];
    if (allChannels.length > input.maxChannels) {
      // Keep the highest-spend channels, fold the rest into "other".
      const keep = new Set(
        [...spendByChannel.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, input.maxChannels - 1)
          .map(([channel]) => channel),
      );
      for (const journey of byUser.values()) {
        journey.path = [...new Set(journey.path.map((c) => (keep.has(c) ? c : "other")))];
      }
      let otherSpend = 0;
      for (const [channel, spend] of spendByChannel) if (!keep.has(channel)) otherSpend += spend;
      for (const channel of allChannels) if (!keep.has(channel)) spendByChannel.delete(channel);
      if (otherSpend > 0) spendByChannel.set("other", otherSpend);
    }

    const journeys: Journey[] = [...byUser.values()]
      .filter((j) => j.path.length > 0)
      .map((j) => ({ path: j.path, converted: j.converted, count: 1 }));

    const result = attribute({
      journeys,
      method: input.method,
      bootstrapReplicates: input.bootstrapReplicates,
      ciLevel: input.ciLevel,
      seed: input.seed,
    });

    const totalSpend = [...spendByChannel.values()].reduce((s, v) => s + v, 0);
    const channels = result.channels.map((channel) => {
      const spend = spendByChannel.get(channel.channel) ?? 0;
      return {
        ...channel,
        spend: Math.round(spend * 100) / 100,
        spendShare: totalSpend === 0 ? 0 : Math.round((spend / totalSpend) * 1e4) / 1e4,
        cpaAttributed:
          channel.attributedConversions <= 0 ? null : Math.round((spend / channel.attributedConversions) * 100) / 100,
        creditVsSpendGap:
          totalSpend === 0 ? null : Math.round((channel.sharePct / 100 - spend / totalSpend) * 1e4) / 1e4,
      };
    });

    const blendedCpa =
      result.totalConversions <= 0 ? null : Math.round((totalSpend / result.totalConversions) * 100) / 100;

    return {
      provenance: impressions.provenance,
      warning: impressions.warning,
      dimension: input.dimension,
      method: input.method,
      definition: result.method === "shapley"
        ? "V_k* = Shapley value of touchpoint k over coalitions of touched channels"
        : "V_k* = (P(convert | full graph) - P(convert | graph without k)) / P(convert | full graph)",
      totals: {
        journeys: result.totalJourneys,
        conversions: result.totalConversions,
        spend: Math.round(totalSpend * 100) / 100,
        cpaBlended: blendedCpa,
      },
      channels,
      warnings: result.warnings,
      reading:
        "creditVsSpendGap is the attribution share minus the spend share. Positive means the channel is underfunded relative to its causal contribution; negative means it is overfunded. Move budget in small steps and re-measure.",
      caution:
        "This is a counterfactual on observed journeys, not an experiment: it is identified only if journey composition is not itself caused by the channel being removed. Unobserved touchpoints (offline, organic, in-store) are absorbed into the observed channels and inflate them. Where a holdout disagrees with these shares, the holdout wins.",
    };
  },
});
