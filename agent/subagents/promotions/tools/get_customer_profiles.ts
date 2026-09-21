import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadCustomers } from "../lib/data";
import { channelSchema } from "../lib/types";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Read customer profiles: recency, frequency, monetary value, tenure, channel preference, opt-ins, contact pressure, lapse flag, and the historical treated/control campaign frame used to train uplift models. Returns population summaries plus a sample of rows. Always report the returned `provenance`.",
  inputSchema: z.object({
    territories: z.array(z.string()).optional(),
    brands: z.array(z.string()).optional(),
    channels: z.array(channelSchema).optional(),
    lapsedOnly: z.boolean().default(false),
    maxRows: z.number().int().min(0).max(200).default(20),
  }),
  label: { start: () => "Read customer profiles" },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadCustomers();

    const filtered = rows.filter(
      (c) =>
        (!input.territories?.length || input.territories.includes(c.territory)) &&
        (!input.brands?.length || input.brands.includes(c.brandAffinity)) &&
        (!input.channels?.length || input.channels.includes(c.preferredChannel)) &&
        (!input.lapsedOnly || c.isLapsed),
    );

    const avg = (pick: (c: (typeof rows)[number]) => number) =>
      filtered.length === 0
        ? 0
        : Math.round((filtered.reduce((s, c) => s + pick(c), 0) / filtered.length) * 100) / 100;

    const treated = filtered.filter((c) => c.history.treated);
    const control = filtered.filter((c) => !c.history.treated);
    const rate = (set: typeof filtered) =>
      set.length === 0 ? 0 : Math.round((set.filter((c) => c.history.responded).length / set.length) * 1e4) / 1e4;

    return {
      provenance,
      source,
      warning,
      population: filtered.length,
      summary: {
        avgRecencyDays: avg((c) => c.recencyDays),
        avgFrequency: avg((c) => c.frequency),
        avgMarginPerOrder: avg((c) => c.monetary),
        avgOrderValue: avg((c) => c.avgOrderValue),
        lapsedShare: filtered.length === 0 ? 0 : Math.round((filtered.filter((c) => c.isLapsed).length / filtered.length) * 1e4) / 1e4,
        emailOptInShare: filtered.length === 0 ? 0 : Math.round((filtered.filter((c) => c.optIns.email).length / filtered.length) * 1e4) / 1e4,
        smsOptInShare: filtered.length === 0 ? 0 : Math.round((filtered.filter((c) => c.optIns.sms).length / filtered.length) * 1e4) / 1e4,
      },
      historicalCampaignFrame: {
        treated: treated.length,
        control: control.length,
        treatedResponseRate: rate(treated),
        controlResponseRate: rate(control),
        observedRawUplift: Math.round((rate(treated) - rate(control)) * 1e4) / 1e4,
        note:
          "Raw difference across the whole frame. It is not the uplift of any target audience — score with score_uplift before targeting.",
      },
      territories: [...new Set(rows.map((c) => c.territory))].sort(),
      brands: [...new Set(rows.map((c) => c.brandAffinity))].sort(),
      rows: filtered.slice(0, input.maxRows),
    };
  },
});
