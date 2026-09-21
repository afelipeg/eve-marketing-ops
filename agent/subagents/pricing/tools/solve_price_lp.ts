import { defineTool } from "eve/tools";
import { z } from "zod";
import { roundSelection, solveLp } from "../lib/lp";

export default defineTool({
  outputSchema: z.looseObject({}),
  description:
    "Solve a constrained pricing problem as a linear program, optionally as the LP relaxation of a discrete one-price-per-SKU selection which is then rounded with the optimality gap reported. Handles <=, >= and = constraints by two-phase simplex, and names the binding constraints — which is usually the useful output, since it says what is actually limiting margin.",
  inputSchema: z.object({
    mode: z.enum(["generic", "price_selection"]).default("generic"),
    objective: z.array(z.number()).min(1),
    maximize: z.boolean().default(true),
    constraints: z
      .array(
        z.object({
          coefficients: z.array(z.number()),
          op: z.enum(["<=", ">=", "="]),
          rhs: z.number(),
          name: z.string().optional(),
        }),
      )
      .min(1),
    variableNames: z.array(z.string()).optional(),
    groups: z
      .array(z.object({ name: z.string(), variableIndices: z.array(z.number().int().min(0)).min(1) }))
      .optional()
      .describe("price_selection mode: one group per SKU, its variables being the candidate price points."),
  }),
  label: { start: ({ mode, objective }) => `Solve LP (${mode}) · ${objective.length} variables` },
  execute(input) {
    for (const constraint of input.constraints) {
      if (constraint.coefficients.length !== input.objective.length) {
        throw new Error(
          `Constraint "${constraint.name ?? "unnamed"}" has ${constraint.coefficients.length} coefficients but the objective has ${input.objective.length} variables.`,
        );
      }
    }

    // Constraint widths are validated above; group indices were not, and
    // lp.ts swallows an out-of-range index with `?? 0` — the group silently
    // contributes zero and the reported optimality gap is wrong with no error.
    for (const group of input.groups ?? []) {
      for (const index of group.variableIndices) {
        if (index >= input.objective.length) {
          throw new Error(
            `Group "${group.name}" references variable index ${index}, but the objective has only ${input.objective.length} variables (valid indices 0-${input.objective.length - 1}).`,
          );
        }
      }
    }

    const relaxed = solveLp({
      objective: input.objective,
      maximize: input.maximize,
      constraints: input.constraints,
      variableNames: input.variableNames,
    });

    if (relaxed.status !== "optimal") {
      return {
        status: relaxed.status,
        message: relaxed.message,
        remedy:
          relaxed.status === "infeasible"
            ? "Constraints conflict. Relax the margin floor, the price index cap, or the capacity — and say which one was relaxed to make the plan feasible."
            : "Add the missing cap: an unbounded pricing objective almost always means no price ceiling or no capacity constraint.",
      };
    }

    if (input.mode === "generic" || !input.groups) {
      return {
        status: relaxed.status,
        objective: relaxed.objective,
        solution: relaxed.variableNames.map((name, i) => ({ variable: name, value: relaxed.solution[i]! })),
        bindingConstraints: relaxed.bindingConstraints,
        iterations: relaxed.iterations,
        reading:
          relaxed.bindingConstraints.length === 0
            ? "No constraint binds at the optimum: the solution is interior, and the limit is the objective itself."
            : `Binding: ${relaxed.bindingConstraints.join(", ")}. These are the constraints costing margin — relaxing one of them is where the next gain is, and the shadow price says how much.`,
      };
    }

    const rounded = roundSelection({
      relaxed: relaxed.solution,
      groups: input.groups,
      objective: input.objective,
    });

    return {
      status: relaxed.status,
      relaxedObjective: rounded.relaxedObjective,
      integerObjective: rounded.integerObjective,
      optimalityGapPct: rounded.gapPct,
      assignment: rounded.assignment.map((a) => ({
        sku: a.group,
        chosen: relaxed.variableNames[a.chosenIndex] ?? `x${a.chosenIndex + 1}`,
        relaxedWeight: a.weight,
      })),
      fractionalGroups: rounded.fractionalGroups,
      bindingConstraints: relaxed.bindingConstraints,
      reading:
        rounded.fractionalGroups.length === 0
          ? "The relaxation landed on an integral solution, so the rounding is exact and the gap is zero."
          : `${rounded.fractionalGroups.length} SKUs came back fractional (${rounded.fractionalGroups.join(", ")}), meaning the LP wanted to split them between price points. The rounded plan gives up ${rounded.gapPct}% against the relaxation — that gap is the honest cost of having to pick one price.`,
      cautions: [
        "An LP relaxation is an upper bound on the integer optimum, never a plan by itself. Report the gap; do not present the relaxed objective as achievable.",
        "The objective is only as good as the demand estimates behind each price point. Their confidence intervals do not appear in the LP, so a tight optimum can be inside the noise.",
      ],
    };
  },
});
