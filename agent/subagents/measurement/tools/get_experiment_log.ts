import { defineTool } from "eve/tools";
import { z } from "zod";
import { auditDesign, loadExperiments } from "../lib/data";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "List or read test/control exposure logs: design, unit of randomization, per-cell control and treatment counts, conversions, and revenue. Returns a design audit that says whether a valid control exists before anything is estimated. Always report the returned `provenance`.",
  inputSchema: z.object({
    id: z.string().optional().describe("Experiment id. Omit to list what is available."),
    service: z.string().optional(),
    period: z.string().optional(),
    territory: z.string().optional(),
  }),
  label: {
    start: ({ id, service }) => `Read experiment log${id ? ` · ${id}` : service ? ` · ${service}` : ""}`,
  },
  async execute(input) {
    const { rows, provenance, source, warning } = await loadExperiments();

    if (input.id) {
      const experiment = rows.find((r) => r.id === input.id);
      if (!experiment) {
        return {
          provenance,
          source,
          warning,
          error: `No experiment with id "${input.id}".`,
          availableIds: rows.map((r) => r.id),
        };
      }
      const audit = auditDesign(experiment);
      return {
        provenance,
        source,
        warning,
        experiment,
        audit,
        totals: {
          control: experiment.cells.reduce((s, c) => s + c.control.n, 0),
          treatment: experiment.cells.reduce((s, c) => s + c.treatment.n, 0),
          controlConversions: experiment.cells.reduce((s, c) => s + c.control.conversions, 0),
          treatmentConversions: experiment.cells.reduce((s, c) => s + c.treatment.conversions, 0),
        },
        nextStep: audit.valid
          ? experiment.cells.length > 1
            ? "Multiple cells: use gibbs_hierarchical_uplift to pool, or beta_binomial_uplift on the aggregate."
            : "Single cell: use beta_binomial_uplift."
          : "Design is not identified. State the blocking issue and propose an observational design instead.",
      };
    }

    const filtered = rows.filter(
      (r) =>
        (!input.service || r.service === input.service) &&
        (!input.period || r.period === input.period) &&
        (!input.territory || r.territory === input.territory),
    );

    return {
      provenance,
      source,
      warning,
      count: filtered.length,
      experiments: filtered.map((r) => ({
        id: r.id,
        service: r.service,
        design: r.design,
        period: r.period,
        brand: r.brand,
        territory: r.territory,
        metric: r.metric,
        cells: r.cells.length,
        hypothesis: r.hypothesis,
      })),
    };
  },
});
