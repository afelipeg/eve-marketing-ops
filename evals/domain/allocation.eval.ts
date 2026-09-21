import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import {
  assertBudgetCheck,
  buildAllocation,
  redistribute,
} from "../../agent/lib/allocation";

export default defineEval({
  description: "Budget allocation preserves money and rejects unverified overspend",
  async test(t) {
    const plan = buildAllocation({
      objective: "acquisition",
      period: "2026-Q4",
      territory: "MX",
      currency: "USD",
      totalBudget: 100.01,
      measurementReservePct: 10,
      excludeServices: ["pricing"],
    });
    const lineTotal = plan.lines.reduce((sum, line) => sum + line.amount, 0);
    t.check(Math.round(lineTotal * 100), equals(Math.round(plan.allocatable * 100)));
    t.check(plan.lines.some((line) => line.service === "pricing"), equals(false));

    const next = redistribute({ plan, releaseFrom: ["promotions"] });
    const nextTotal = next.plan.lines.reduce((sum, line) => sum + line.amount, 0);
    t.check(Math.round(nextTotal * 100), equals(Math.round(lineTotal * 100)));

    t.check(
      assertBudgetCheck({
        totalBudget: 80,
        currency: "usd",
        budgetCheck: { available: 100, currency: "USD" },
      }),
      equals("USD"),
    );

    let overspendRejected = false;
    try {
      assertBudgetCheck({
        totalBudget: 101,
        currency: "USD",
        budgetCheck: { available: 100, currency: "USD" },
      });
    } catch {
      overspendRejected = true;
    }
    t.check(overspendRejected, equals(true));
  },
});
