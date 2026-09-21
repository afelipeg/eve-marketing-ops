import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  loadKpiHistory,
  notSignificantServices,
  summarizeKpis,
} from "../lib/marketing-data";
import { serviceSchema } from "../lib/types";

export default defineTool({
  outputSchema: z.looseObject({
    provenance: z.enum(["external", "sample", "none"]),
    source: z.string().min(1),
    warning: z.string().optional(),
    rowCount: z.number().int().nonnegative(),
    currency: z.string().nullable(),
    currencies: z.array(z.string()),
    aggregates: z.looseObject({}).nullable(),
    aggregatesByCurrency: z.record(z.string(), z.looseObject({})),
    notSignificantServices: z.array(z.string()),
    rows: z.array(z.looseObject({})),
  }),
  description:
    "Read historical KPI rows (spend, revenue, gross margin, units, orders, customers, measured uplift) filtered by period, brand, category, territory, or service, with derived ROI/ROAS/CAC/AOV aggregates. Use before setting any target or splitting any budget. Always report the returned `provenance`: 'sample' rows are placeholder data, not the client's numbers.",
  inputSchema: z.object({
    periods: z.array(z.string()).optional().describe('e.g. ["2026-Q1","2026-Q2"]'),
    brand: z.string().optional(),
    category: z.string().optional(),
    territory: z.string().optional(),
    services: z.array(z.union([serviceSchema, z.literal("baseline")])).optional(),
    includeRows: z
      .boolean()
      .default(true)
      .describe("Set false to return only aggregates."),
    limit: z.number().int().min(1).max(500).default(100),
  }),
  label: {
    start: ({ brand, territory, periods }) =>
      `Read KPI history${brand ? ` · ${brand}` : ""}${territory ? ` · ${territory}` : ""}${
        periods?.length ? ` · ${periods.join(",")}` : ""
      }`,
  },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadKpiHistory();

    const filtered = rows.filter(
      (r) =>
        (!input.periods?.length || input.periods.includes(r.period)) &&
        (!input.brand || r.brand === input.brand) &&
        (!input.category || r.category === input.category) &&
        (!input.territory || r.territory === input.territory) &&
        (!input.services?.length || input.services.includes(r.service)),
    );
    const currencies = [...new Set(filtered.map((row) => row.currency))].sort();
    const aggregatesByCurrency = Object.fromEntries(
      currencies.map((currency) => [
        currency,
        summarizeKpis(filtered.filter((row) => row.currency === currency)),
      ]),
    );

    return {
      provenance,
      source,
      warning,
      rowCount: filtered.length,
      availableFilters: {
        periods: [...new Set(rows.map((r) => r.period))].sort(),
        brands: [...new Set(rows.map((r) => r.brand))].sort(),
        categories: [...new Set(rows.map((r) => r.category))].sort(),
        territories: [...new Set(rows.map((r) => r.territory))].sort(),
      },
      currency: currencies.length === 1 ? currencies[0] : null,
      currencies,
      aggregationWarning:
        currencies.length > 1
          ? "Matched rows contain multiple currencies. aggregates is null because monetary KPIs cannot be added across currencies without an FX policy."
          : null,
      aggregates:
        currencies.length === 1 ? aggregatesByCurrency[currencies[0]] : null,
      aggregatesByCurrency,
      notSignificantServices: notSignificantServices(filtered),
      rows: input.includeRows ? filtered.slice(0, input.limit) : [],
    };
  },
});
