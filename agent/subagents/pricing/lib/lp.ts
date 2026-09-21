import { round } from "./random";

/**
 * Two-phase simplex for linear programs.
 *
 *   maximize/minimize  c'x
 *   subject to         A x  (<= | >= | =)  b,   x >= 0
 *
 * Used for the LP relaxation of discrete pricing problems: choosing one price
 * point per SKU from a ladder, subject to shared constraints (margin floor,
 * average price index versus competition, capacity, promotion count). The
 * relaxation is solved first because the integer problem is large; the solution
 * is then rounded and the rounding gap is reported, never hidden.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — optimization
 * under constraints in pricing.
 */

export type Constraint = {
  coefficients: number[];
  op: "<=" | ">=" | "=";
  rhs: number;
  name?: string;
};

export type LpResult = {
  status: "optimal" | "infeasible" | "unbounded" | "iteration-limit";
  objective: number;
  solution: number[];
  variableNames: string[];
  iterations: number;
  bindingConstraints: string[];
  message: string;
};

export function solveLp(input: {
  objective: number[];
  maximize?: boolean;
  constraints: Constraint[];
  variableNames?: string[];
  maxIterations?: number;
}): LpResult {
  const maximize = input.maximize ?? true;
  const n = input.objective.length;
  const names = input.variableNames ?? Array.from({ length: n }, (_, i) => `x${i + 1}`);
  const maxIterations = input.maxIterations ?? 5_000;

  // Normalize: make every rhs non-negative.
  const constraints = input.constraints.map((constraint) => {
    if (constraint.rhs < 0) {
      return {
        ...constraint,
        coefficients: constraint.coefficients.map((v) => -v),
        rhs: -constraint.rhs,
        op: constraint.op === "<=" ? (">=" as const) : constraint.op === ">=" ? ("<=" as const) : ("=" as const),
      };
    }
    return constraint;
  });

  const m = constraints.length;
  const slackCount = constraints.filter((c) => c.op !== "=").length;
  const artificialCount = constraints.filter((c) => c.op !== "<=").length;
  const totalCols = n + slackCount + artificialCount;

  const tableau: number[][] = Array.from({ length: m + 2 }, () => new Array<number>(totalCols + 1).fill(0));
  const basis: number[] = new Array(m).fill(-1);

  let slackIndex = n;
  let artificialIndex = n + slackCount;
  const artificialColumns: number[] = [];

  constraints.forEach((constraint, row) => {
    for (let j = 0; j < n; j++) tableau[row]![j] = constraint.coefficients[j] ?? 0;
    tableau[row]![totalCols] = constraint.rhs;

    if (constraint.op === "<=") {
      tableau[row]![slackIndex] = 1;
      basis[row] = slackIndex;
      slackIndex++;
    } else if (constraint.op === ">=") {
      tableau[row]![slackIndex] = -1;
      slackIndex++;
      tableau[row]![artificialIndex] = 1;
      basis[row] = artificialIndex;
      artificialColumns.push(artificialIndex);
      artificialIndex++;
    } else {
      tableau[row]![artificialIndex] = 1;
      basis[row] = artificialIndex;
      artificialColumns.push(artificialIndex);
      artificialIndex++;
    }
  });

  // Objective row (row m): maximize c'x, stored as -c for the simplex test.
  for (let j = 0; j < n; j++) tableau[m]![j] = maximize ? -input.objective[j]! : input.objective[j]!;
  // Phase-1 row (row m+1): minimize the sum of artificials.
  for (const col of artificialColumns) tableau[m + 1]![col] = 1;
  for (let row = 0; row < m; row++) {
    if (artificialColumns.includes(basis[row]!)) {
      for (let j = 0; j <= totalCols; j++) tableau[m + 1]![j]! -= tableau[row]![j]!;
    }
  }

  let iterations = 0;
  const pivot = (
    objectiveRow: number,
    allowed: (col: number) => boolean,
  ): "optimal" | "unbounded" | "iteration-limit" => {
    for (;;) {
      // Never report a stalled tableau as optimal. There is no Bland or
      // lexicographic anti-cycling rule here, so degeneracy genuinely reaches
      // this branch — and a non-optimal tableau announced as "optimal" is a
      // wrong answer with a confident label on it.
      if (iterations++ > maxIterations) return "iteration-limit";
      let entering = -1;
      let best = -1e-9;
      for (let j = 0; j < totalCols; j++) {
        if (!allowed(j)) continue;
        if (tableau[objectiveRow]![j]! < best) {
          best = tableau[objectiveRow]![j]!;
          entering = j;
        }
      }
      if (entering === -1) return "optimal";

      let leaving = -1;
      let bestRatio = Infinity;
      for (let row = 0; row < m; row++) {
        const coefficient = tableau[row]![entering]!;
        if (coefficient <= 1e-9) continue;
        const ratio = tableau[row]![totalCols]! / coefficient;
        if (ratio < bestRatio - 1e-12) {
          bestRatio = ratio;
          leaving = row;
        }
      }
      if (leaving === -1) return "unbounded";

      const pv = tableau[leaving]![entering]!;
      for (let j = 0; j <= totalCols; j++) tableau[leaving]![j]! /= pv;
      for (let row = 0; row <= m + 1; row++) {
        if (row === leaving) continue;
        const factor = tableau[row]![entering]!;
        if (Math.abs(factor) < 1e-12) continue;
        for (let j = 0; j <= totalCols; j++) tableau[row]![j]! -= factor * tableau[leaving]![j]!;
      }
      basis[leaving] = entering;
    }
  };

  if (artificialColumns.length > 0) {
    const phase1 = pivot(m + 1, () => true);
    if (phase1 === "iteration-limit") {
      return {
        status: "iteration-limit",
        objective: 0,
        solution: new Array(n).fill(0),
        variableNames: names,
        iterations,
        bindingConstraints: [],
        message: `Phase 1 hit the ${maxIterations}-iteration limit, so feasibility was never established. The result is not a solution — raise maxIterations or rescale the problem.`,
      };
    }
    if (Math.abs(tableau[m + 1]![totalCols]!) > 1e-6) {
      return {
        status: "infeasible",
        objective: 0,
        solution: new Array(n).fill(0),
        variableNames: names,
        iterations,
        bindingConstraints: [],
        message: "No feasible point satisfies the constraints. Relax a floor or a capacity before re-solving.",
      };
    }
  }

  const status = pivot(m, (col) => !artificialColumns.includes(col));
  if (status === "iteration-limit") {
    return {
      status: "iteration-limit",
      objective: 0,
      solution: new Array(n).fill(0),
      variableNames: names,
      iterations,
      bindingConstraints: [],
      message: `Phase 2 hit the ${maxIterations}-iteration limit before reaching an optimum. The tableau is feasible but NOT optimal — do not read the objective as a solution.`,
    };
  }
  if (status === "unbounded") {
    return {
      status: "unbounded",
      objective: Infinity,
      solution: new Array(n).fill(0),
      variableNames: names,
      iterations,
      bindingConstraints: [],
      message: "Objective is unbounded: a constraint that should cap it is missing (usually a price ceiling or a capacity).",
    };
  }

  const solution = new Array<number>(n).fill(0);
  for (let row = 0; row < m; row++) {
    if (basis[row]! < n) solution[basis[row]!] = tableau[row]![totalCols]!;
  }
  const objective = input.objective.reduce((s, c, j) => s + c * solution[j]!, 0);

  const binding = constraints
    .map((constraint, index) => {
      const lhs = constraint.coefficients.reduce((s, c, j) => s + c * (solution[j] ?? 0), 0);
      // Relative tolerance: an absolute 1e-6 is a 1e-15 relative test at
      // rhs ~1e9, and binding constraints then go unreported.
      const tolerance = 1e-6 * Math.max(1, Math.abs(constraint.rhs));
      return Math.abs(lhs - constraint.rhs) < tolerance
        ? constraint.name ?? `constraint_${index + 1}`
        : null;
    })
    .filter((v): v is string => v !== null);

  return {
    status: "optimal",
    objective: round(objective, 6),
    solution: solution.map((v) => round(v, 6)),
    variableNames: names,
    iterations,
    bindingConstraints: binding,
    message: `Optimal at objective ${round(objective, 4)}. Binding: ${binding.join(", ") || "none"}.`,
  };
}

/**
 * Round an LP relaxation of a one-price-per-SKU selection into an integer
 * assignment, and report the optimality gap rather than hiding it.
 */
export function roundSelection(input: {
  relaxed: number[];
  groups: { name: string; variableIndices: number[] }[];
  objective: number[];
}): {
  assignment: { group: string; chosenIndex: number; weight: number }[];
  integerObjective: number;
  relaxedObjective: number;
  gapPct: number | null;
  fractionalGroups: string[];
  roundingWarning: string | null;
} {
  const assignment: { group: string; chosenIndex: number; weight: number }[] = [];
  const fractional: string[] = [];

  for (const group of input.groups) {
    let bestIndex = group.variableIndices[0]!;
    let bestWeight = -Infinity;
    for (const index of group.variableIndices) {
      const weight = input.relaxed[index] ?? 0;
      if (weight > bestWeight) {
        bestWeight = weight;
        bestIndex = index;
      }
    }
    if (bestWeight < 0.999) fractional.push(group.name);
    assignment.push({ group: group.name, chosenIndex: bestIndex, weight: round(bestWeight, 6) });
  }

  const integerObjective = assignment.reduce((s, a) => s + (input.objective[a.chosenIndex] ?? 0), 0);
  const relaxedObjective = input.relaxed.reduce((s, v, j) => s + v * (input.objective[j] ?? 0), 0);

  const gapPct =
    relaxedObjective === 0
      ? null
      : round(((relaxedObjective - integerObjective) / Math.abs(relaxedObjective)) * 100, 4);

  return {
    assignment,
    integerObjective: round(integerObjective, 6),
    relaxedObjective: round(relaxedObjective, 6),
    gapPct,
    fractionalGroups: fractional,
    // The relaxation is an UPPER bound on the integer optimum. A rounded
    // assignment that beats it has not found a better plan — it has left the
    // feasible region, and the constraints were never rechecked after
    // rounding. Surface that rather than printing a negative gap as if it
    // were a win.
    roundingWarning:
      gapPct !== null && gapPct < 0
        ? "The rounded assignment scores ABOVE the relaxation, which is an upper bound. That means the rounding almost certainly violates a constraint: this is not a feasible plan. Re-solve with the chosen variables fixed before using it."
        : null,
  };
}
