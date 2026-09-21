import { defineTool } from "eve/tools";
import { z } from "zod";
import { auditDesign, loadExperiments } from "../lib/data";
import { hierarchicalUplift } from "../lib/gibbs";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Fit a hierarchical beta-binomial model across cells (territories, segments, stores) with Gibbs sampling plus Metropolis steps on the hyperparameters. Returns per-cell shrunk uplift with credible intervals, the population-level uplift, shrinkage magnitude, and MCMC diagnostics. Use whenever an experiment has several thin cells instead of reading each cell separately.",
  inputSchema: z.object({
    experimentId: z.string().optional(),
    cells: z
      .array(
        z.object({
          label: z.string(),
          control: z.object({ n: z.number().int().min(0), conversions: z.number().min(0) }),
          treatment: z.object({ n: z.number().int().min(0), conversions: z.number().min(0) }),
        }),
      )
      .min(2)
      .optional(),
    iterations: z.number().int().min(1_000).max(50_000).default(6_000),
    burnIn: z.number().int().min(100).max(20_000).default(1_500),
    thin: z.number().int().min(1).max(20).default(2),
    ciLevel: z.number().min(0.5).max(0.999).default(0.9),
    seed: z.number().int().optional(),
  }),
  label: {
    start: ({ experimentId }) => `Gibbs hierarchical uplift${experimentId ? ` · ${experimentId}` : ""}`,
  },
  async execute(input) {
    let cells = input.cells;
    let provenance = "caller-supplied cells";
    let warning: string | undefined;

    if (input.experimentId) {
      const { rows, provenance: p, warning: w } = await loadExperiments();
      const experiment = rows.find((r) => r.id === input.experimentId);
      if (!experiment) throw new Error(`No experiment with id "${input.experimentId}".`);
      const audit = auditDesign(experiment);
      if (!audit.valid) {
        return {
          refused: true,
          reason: "Design is not identified; no uplift will be estimated.",
          blocking: audit.blocking,
        };
      }
      if (experiment.cells.length < 2) {
        throw new Error(
          `Experiment "${experiment.id}" has one cell. Use beta_binomial_uplift instead.`,
        );
      }
      cells = experiment.cells.map((c) => ({
        label: c.label,
        control: { n: c.control.n, conversions: c.control.conversions },
        treatment: { n: c.treatment.n, conversions: c.treatment.conversions },
      }));
      provenance = p;
      warning = w;
    }

    if (!cells) throw new Error("Supply either experimentId or an explicit cells array.");

    // Both bounds are independently legal, but burnIn >= iterations retains
    // zero draws, and every quantile downstream becomes NaN — which the
    // significance test then reports as a confident "not significant".
    if (input.burnIn >= input.iterations) {
      throw new Error(
        `burnIn (${input.burnIn}) must be below iterations (${input.iterations}); otherwise no draws survive the burn-in and every interval comes back NaN. Raise iterations or lower burnIn.`,
      );
    }

    const result = hierarchicalUplift({
      cells,
      iterations: input.iterations,
      burnIn: input.burnIn,
      thin: input.thin,
      ciLevel: input.ciLevel,
      seed: input.seed,
    });

    const pooled = result.pooled.relativeLiftPct;
    const pop = result.population.relativeLiftPct;
    return {
      provenance,
      warning,
      model:
        "p_i ~ Beta(mu*kappa, (1-mu)*kappa); conjugate Gibbs draws for cell rates, Metropolis random walk on logit(mu) and log(kappa), step sizes tuned during burn-in",
      ...result,
      verdict: result.pooled.significant
        ? `Pooled uplift across the observed cells is significant: ${pooled.estimate}% (CI ${pooled.ci[0]}% to ${pooled.ci[1]}%).`
        : `Pooled uplift across the observed cells is NOT significant: ${pooled.estimate}% (CI ${pooled.ci[0]}% to ${pooled.ci[1]}%) spans zero.`,
      estimandNote: `Two different questions: "pooled" is the exposure-weighted effect across the cells measured (${pooled.estimate}% CI ${pooled.ci[0]}-${pooled.ci[1]}); "population" is the effect expected in a NEW cell drawn from this population (${pop.estimate}% CI ${pop.ci[0]}-${pop.ci[1]}), which is wider because between-cell variation is part of it. Quote the one that matches the decision, and say which.`,
      shrinkageNote:
        "Per-cell estimates are pulled toward the population mean in proportion to how thin the cell is. Report the shrunk estimate, and the observed rate beside it.",
    };
  },
});
