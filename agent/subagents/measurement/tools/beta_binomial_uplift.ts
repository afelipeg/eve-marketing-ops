import { defineTool } from "eve/tools";
import { z } from "zod";
import { betaBinomialUplift } from "../lib/bayes";
import { auditDesign, loadExperiments } from "../lib/data";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Estimate uplift for a two-arm test with a beta-binomial model: posterior conversion rates, absolute and relative lift with a credible interval, P(treatment > control), expected loss, significance, sample size, and the minimum detectable effect. Supply counts directly, or an experimentId to pull the logged arms. Deterministic given the same seed.",
  inputSchema: z.object({
    experimentId: z.string().optional().describe("Pull arms from the experiment log instead of passing counts."),
    cellLabel: z.string().optional().describe("Analyze one cell of a multi-cell experiment; omit to aggregate all cells."),
    control: z.object({ n: z.number().int().min(0), conversions: z.number().min(0) }).optional(),
    treatment: z.object({ n: z.number().int().min(0), conversions: z.number().min(0) }).optional(),
    priorAlpha: z.number().positive().default(1),
    priorBeta: z.number().positive().default(1),
    ciLevel: z.number().min(0.5).max(0.999).default(0.9),
    draws: z.number().int().min(1_000).max(200_000).default(20_000),
    seed: z.number().int().optional(),
  }),
  label: {
    start: ({ experimentId, cellLabel }) =>
      `Beta-binomial uplift${experimentId ? ` · ${experimentId}` : ""}${cellLabel ? ` · ${cellLabel}` : ""}`,
  },
  async execute(input) {
    let control = input.control;
    let treatment = input.treatment;
    let provenance: string = "caller-supplied counts";
    let warning: string | undefined;
    let audit: ReturnType<typeof auditDesign> | undefined;

    if (input.experimentId) {
      const { rows, provenance: p, warning: w } = await loadExperiments();
      const experiment = rows.find((r) => r.id === input.experimentId);
      if (!experiment) {
        throw new Error(
          `No experiment with id "${input.experimentId}". Call get_experiment_log to list available ids.`,
        );
      }
      audit = auditDesign(experiment);
      if (!audit.valid) {
        return {
          refused: true,
          reason: "Design is not identified; no uplift will be estimated.",
          blocking: audit.blocking,
          cautions: audit.cautions,
          nextStep:
            "Propose an observational design with its identifying assumption, or specify a valid randomized test.",
        };
      }
      const cells = input.cellLabel
        ? experiment.cells.filter((c) => c.label === input.cellLabel)
        : experiment.cells;
      if (cells.length === 0) {
        throw new Error(
          `Cell "${input.cellLabel}" not found. Available: ${experiment.cells.map((c) => c.label).join(", ")}.`,
        );
      }
      control = {
        n: cells.reduce((s, c) => s + c.control.n, 0),
        conversions: cells.reduce((s, c) => s + c.control.conversions, 0),
      };
      treatment = {
        n: cells.reduce((s, c) => s + c.treatment.n, 0),
        conversions: cells.reduce((s, c) => s + c.treatment.conversions, 0),
      };
      provenance = p;
      warning = w;
      if (!input.cellLabel && experiment.cells.length > 1) {
        warning = [
          warning,
          "Cells were aggregated: Simpson's paradox is possible when cell sizes and base rates differ. Cross-check with gibbs_hierarchical_uplift.",
        ]
          .filter(Boolean)
          .join(" ");
      }
    }

    if (!control || !treatment) {
      throw new Error("Supply either experimentId, or both control and treatment counts.");
    }

    // The same identification check the experimentId path refuses on. Passing
    // the counts directly must not buy a posterior that the logged experiment
    // would have been denied.
    if (control.n === 0 || treatment.n === 0) {
      return {
        refused: true,
        reason:
          control.n === 0
            ? "No control exposures: causal uplift is not identified from these counts. Propose an observational design, or supply the control arm."
            : "No treatment exposures: there is nothing to measure.",
        supplied: { control, treatment },
      };
    }

    const result = betaBinomialUplift({
      control: { label: "control", ...control },
      treatment: { label: "treatment", ...treatment },
      priorAlpha: input.priorAlpha,
      priorBeta: input.priorBeta,
      ciLevel: input.ciLevel,
      draws: input.draws,
      seed: input.seed,
    });

    return {
      provenance,
      warning,
      audit,
      model: `Beta(${input.priorAlpha}, ${input.priorBeta}) prior, binomial likelihood, ${input.draws} posterior draws`,
      ...result,
      verdict: result.significant
        ? `Significant at the ${Math.round(input.ciLevel * 100)}% credible level: relative lift ${result.relativeLiftPct.estimate}% (CI ${result.relativeLiftPct.ci[0]}% to ${result.relativeLiftPct.ci[1]}%).`
        : `NOT significant: the ${Math.round(input.ciLevel * 100)}% credible interval on absolute lift spans zero. Relative lift ${result.relativeLiftPct.estimate}% (CI ${result.relativeLiftPct.ci[0]}% to ${result.relativeLiftPct.ci[1]}%). This test could only resolve effects of about ${result.minimumDetectableEffectPct}% or larger.`,
    };
  },
});
