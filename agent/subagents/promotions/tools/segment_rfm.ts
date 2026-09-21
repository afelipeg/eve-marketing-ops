import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadCustomers } from "../lib/data";
import { rfmSegment } from "../lib/targeting";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Score the customer base on RFM quintiles and assign behavioural segments (champions, loyal, new_or_promising, needs_attention, at_risk, hibernating, lost) plus value tiers (platinum/gold/silver/bronze). Use for tiered segmentation and as the descriptive frame for a campaign brief — not as a targeting score on its own, since RFM describes who is valuable, not who is persuadable.",
  inputSchema: z.object({
    territories: z.array(z.string()).optional(),
    segment: z.string().optional().describe("Return the member list for one segment."),
    maxRows: z.number().int().min(0).max(500).default(0),
  }),
  label: { start: () => "Segment base on RFM" },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadCustomers();
    const pool = input.territories?.length
      ? rows.filter((c) => input.territories!.includes(c.territory))
      : rows;

    const scored = rfmSegment(pool);
    const byId = new Map(pool.map((c) => [c.id, c]));

    const segments = [...new Set(scored.map((s) => s.segment))].map((segment) => {
      const members = scored.filter((s) => s.segment === segment);
      const customers = members.map((m) => byId.get(m.customerId)!);
      const avg = (pick: (c: (typeof customers)[number]) => number) =>
        Math.round((customers.reduce((s, c) => s + pick(c), 0) / customers.length) * 100) / 100;
      return {
        segment,
        customers: members.length,
        share: Math.round((members.length / scored.length) * 1e4) / 1e4,
        avgRecencyDays: avg((c) => c.recencyDays),
        avgFrequency: avg((c) => c.frequency),
        avgMarginPerOrder: avg((c) => c.monetary),
      };
    }).sort((a, b) => b.customers - a.customers);

    const tiers = ["platinum", "gold", "silver", "bronze"].map((tier) => ({
      tier,
      customers: scored.filter((s) => s.valueTier === tier).length,
    }));

    return {
      provenance,
      source,
      warning,
      scoredCustomers: scored.length,
      segments,
      valueTiers: tiers,
      caution:
        "RFM is descriptive. Champions are usually sure things: promoting to them spends discount on demand that already exists. Use score_uplift before choosing who to contact.",
      rows: input.segment
        ? scored.filter((s) => s.segment === input.segment).slice(0, Math.max(input.maxRows, 50))
        : scored.slice(0, input.maxRows),
    };
  },
});
