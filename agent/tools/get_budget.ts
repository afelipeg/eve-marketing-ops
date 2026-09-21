import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadBudget } from "../lib/marketing-data";
import { delegateSchema } from "../lib/types";

const round2 = (n: number) => Math.round(n * 100) / 100;

export default defineTool({
  outputSchema: z.looseObject({
    provenance: z.enum(["external", "sample", "none"]),
    source: z.string().min(1),
    warning: z.string().optional(),
    matched: z.number().int().nonnegative(),
    currency: z.string().nullable(),
    currencies: z.array(z.string()),
    envelopes: z.array(z.looseObject({ available: z.number(), currency: z.string() })),
    totals: z.looseObject({}).nullable(),
    totalsByCurrency: z.record(z.string(), z.looseObject({})),
  }),
  description:
    "Read budget envelopes (planned, committed, spent, available) by period, territory, and service. Use to verify the budget constraint before allocating or briefing any sub-agent. Always report the returned `provenance`.",
  inputSchema: z.object({
    period: z.string().optional(),
    territory: z.string().optional(),
    services: z.array(delegateSchema).optional(),
  }),
  label: {
    start: ({ period, territory }) =>
      `Read budget${period ? ` · ${period}` : ""}${territory ? ` · ${territory}` : ""}`,
  },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadBudget();

    const envelopes = rows.filter(
      (r) =>
        (!input.period || r.period === input.period) &&
        (!input.territory || r.territory === input.territory) &&
        (!input.services?.length || input.services.includes(r.service)),
    );

    const currencies = [...new Set(envelopes.map((e) => e.currency))].sort();
    const totalsByCurrency = Object.fromEntries(
      currencies.map((currency) => {
        const totals = envelopes
          .filter((envelope) => envelope.currency === currency)
          .reduce(
            (acc, envelope) => ({
              planned: acc.planned + envelope.planned,
              committed: acc.committed + envelope.committed,
              spent: acc.spent + envelope.spent,
            }),
            { planned: 0, committed: 0, spent: 0 },
          );
        return [
          currency,
          {
            planned: round2(totals.planned),
            committed: round2(totals.committed),
            spent: round2(totals.spent),
            available: round2(totals.planned - totals.committed - totals.spent),
          },
        ];
      }),
    );
    const totals = currencies.length === 1 ? totalsByCurrency[currencies[0]] : null;

    return {
      provenance,
      source,
      warning,
      matched: envelopes.length,
      emptyMatch:
        envelopes.length === 0
          ? `No budget envelope matches those filters (period=${input.period ?? "any"}, territory=${input.territory ?? "any"}). Totals below are zero because nothing matched, NOT because the budget is exhausted — check availablePeriods and availableTerritories before concluding there is no money.`
          : null,
      currency: currencies.length === 1 ? currencies[0] : null,
      currencies,
      aggregationWarning:
        currencies.length > 1
          ? "Matched rows contain multiple currencies. totals is null because adding currencies is invalid; use totalsByCurrency or narrow the filters."
          : null,
      availablePeriods: [...new Set(rows.map((r) => r.period))].sort(),
      availableTerritories: [...new Set(rows.map((r) => r.territory))].sort(),
      envelopes: envelopes.map((e) => ({
        ...e,
        available: round2(e.planned - e.committed - e.spent),
      })),
      totals,
      totalsByCurrency,
    };
  },
});
