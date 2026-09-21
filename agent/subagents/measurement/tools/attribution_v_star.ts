import { defineTool } from "eve/tools";
import { z } from "zod";
import { attribute } from "../lib/attribution";
import { loadJourneys } from "../lib/data";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Multi-touch attribution with the causal effect model V_k*: the contribution of each touchpoint measured as the conversion probability the journey graph loses when that touchpoint is removed (removal effect on a first-order Markov model), or by exact Shapley decomposition. Optional bootstrap credible intervals on the credit shares. Positional heuristics (last-click, first-click, linear) are not implemented and must not be substituted.",
  inputSchema: z.object({
    method: z.enum(["removal-effect", "shapley"]).default("removal-effect"),
    journeys: z
      .array(
        z.object({
          path: z.array(z.string()).min(1),
          converted: z.boolean(),
          count: z.number().int().min(1).default(1),
          value: z.number().optional(),
        }),
      )
      .optional()
      .describe("Omit to use the logged conversion journeys."),
    bootstrapReplicates: z.number().int().min(0).max(500).default(0),
    ciLevel: z.number().min(0.5).max(0.999).default(0.9),
    seed: z.number().int().optional(),
  }),
  label: { start: ({ method }) => `Attribution V_k* · ${method}` },
  async execute(input) {
    // `[]` is truthy, so an explicitly empty array used to reach attribute()
    // with nothing to attribute. Falling back to the log instead would be
    // worse: it would silently analyse different data than the caller passed.
    if (input.journeys && input.journeys.length === 0) {
      throw new Error(
        "journeys was supplied as an empty array. Omit the parameter entirely to use the logged conversion journeys, or supply at least one journey — an empty array is not a request to fall back.",
      );
    }
    let journeys = input.journeys;
    let provenance = "caller-supplied journeys";
    let warning: string | undefined;

    if (!journeys) {
      const loaded = await loadJourneys();
      journeys = loaded.rows;
      provenance = loaded.provenance;
      warning = loaded.warning;
    }

    const result = attribute({
      journeys,
      method: input.method,
      bootstrapReplicates: input.bootstrapReplicates,
      ciLevel: input.ciLevel,
      seed: input.seed,
    });

    return {
      provenance,
      warning,
      definition:
        input.method === "removal-effect"
          ? "V_k* = (P(convert | full graph) - P(convert | graph without k)) / P(convert | full graph)"
          : "V_k* = Shapley value of channel k over coalitions of touched channels",
      ...result,
      caution:
        "V_k* is a counterfactual on the observed journey graph, not a randomized experiment. It is identified only under the assumption that journey composition is not itself caused by the channel being removed. State that assumption whenever these shares are reported.",
    };
  },
});
