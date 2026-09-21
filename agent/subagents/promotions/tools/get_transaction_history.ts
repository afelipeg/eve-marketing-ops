import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadTransactions } from "../lib/data";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Read sell-out transaction history by customer, channel, brand, or category: units, revenue, gross margin, promoted share, and discount depth. Use to establish the baseline a campaign will be measured against and to check promo dependency before adding another offer.",
  inputSchema: z.object({
    customerId: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    promotedOnly: z.boolean().default(false),
    maxRows: z.number().int().min(0).max(200).default(20),
  }),
  label: { start: ({ customerId }) => `Read transactions${customerId ? ` · ${customerId}` : ""}` },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadTransactions();

    const filtered = rows.filter(
      (t) =>
        (!input.customerId || t.customerId === input.customerId) &&
        (!input.brand || t.brand === input.brand) &&
        (!input.category || t.category === input.category) &&
        (!input.promotedOnly || t.promoted),
    );

    const totals = filtered.reduce(
      (acc, t) => ({
        units: acc.units + t.units,
        revenue: acc.revenue + t.revenue,
        grossMargin: acc.grossMargin + t.grossMargin,
        discount: acc.discount + t.discountAmount,
        promoted: acc.promoted + (t.promoted ? 1 : 0),
      }),
      { units: 0, revenue: 0, grossMargin: 0, discount: 0, promoted: 0 },
    );

    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      provenance,
      source,
      warning,
      transactionCount: filtered.length,
      totals: {
        units: totals.units,
        revenue: round2(totals.revenue),
        grossMargin: round2(totals.grossMargin),
        discountSpend: round2(totals.discount),
        promotedShare: filtered.length === 0 ? 0 : round2(totals.promoted / filtered.length),
        grossMarginPct: totals.revenue === 0 ? null : round2(totals.grossMargin / totals.revenue),
        averageBasket: filtered.length === 0 ? 0 : round2(totals.revenue / filtered.length),
      },
      byChannel: [...new Set(filtered.map((t) => t.channel))].map((channel) => {
        const slice = filtered.filter((t) => t.channel === channel);
        return {
          channel,
          transactions: slice.length,
          revenue: round2(slice.reduce((s, t) => s + t.revenue, 0)),
          grossMargin: round2(slice.reduce((s, t) => s + t.grossMargin, 0)),
          promotedShare: round2(slice.filter((t) => t.promoted).length / slice.length),
        };
      }),
      caution:
        "Promoted share above roughly half signals promo dependency: baseline demand is being bought back each period. Flag it rather than deepening the discount.",
      rows: filtered.slice(0, input.maxRows),
    };
  },
});
