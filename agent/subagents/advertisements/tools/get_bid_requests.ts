import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadBidRequests, loadPublishers } from "../lib/data";
import { placementSchema } from "../lib/types";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Read the incoming bid-request stream: user, publisher, placement, device, slot position, hour, floor CPM, and the exchange timeout in milliseconds. Returns the floor distribution and the publisher mix of the available inventory. Always report the returned `provenance`.",
  inputSchema: z.object({
    placements: z.array(placementSchema).optional(),
    maxFloorCpm: z.number().optional(),
    publisherTier: z.enum(["premium", "mid", "long_tail"]).optional(),
    limit: z.number().int().min(1).max(500).default(25),
  }),
  label: { start: () => "Read bid requests" },
  async execute(input) {
    const [requests, publishers] = await Promise.all([loadBidRequests(), loadPublishers()]);
    const byId = new Map(publishers.rows.map((p) => [p.id, p]));

    const filtered = requests.rows.filter((r) => {
      const publisher = byId.get(r.publisherId);
      return (
        (!input.placements?.length || input.placements.includes(r.placement)) &&
        (input.maxFloorCpm === undefined || r.floorCpm <= input.maxFloorCpm) &&
        (!input.publisherTier || publisher?.tier === input.publisherTier)
      );
    });

    const floors = filtered.map((r) => r.floorCpm).sort((a, b) => a - b);
    const timeouts = filtered.map((r) => r.timeoutMs).sort((a, b) => a - b);
    const at = (arr: number[], q: number) => (arr.length === 0 ? 0 : arr[Math.floor((arr.length - 1) * q)]!);

    return {
      provenance: requests.provenance,
      source: requests.source,
      warning: requests.warning,
      available: filtered.length,
      floorCpm: { p10: at(floors, 0.1), median: at(floors, 0.5), p90: at(floors, 0.9) },
      timeoutMs: { min: timeouts[0] ?? 0, median: at(timeouts, 0.5), max: timeouts[timeouts.length - 1] ?? 0 },
      tierMix: ["premium", "mid", "long_tail"].map((tier) => ({
        tier,
        requests: filtered.filter((r) => byId.get(r.publisherId)?.tier === tier).length,
      })),
      latencyNote:
        "The whole pipeline — phi, psi, omega, bid — must fit inside the shortest timeout above, minus network. Budget scoring work accordingly; a late bid is a lost auction, not a cheap one.",
      requests: filtered.slice(0, input.limit),
    };
  },
});
