import { defineEval } from "eve/evals";
import {
  buildQbrPrompt,
  isFirstMondayOfQuarterMonth,
} from "../../agent/schedules/qbr-generator";
import { equals, includes } from "eve/evals/expect";

/**
 * Eval for qbr-generator schedule.
 * Verifies the schedule handler runs and produces the QBR executive memo structure.
 */
export default defineEval({
  description: "QBR generator schedule handler executes and produces executive memo structure",
  async test(t) {
    const firstMonday = new Date("2026-04-06T07:00:00.000Z");
    const sentMessage = buildQbrPrompt(firstMonday);

    t.check(isFirstMondayOfQuarterMonth(firstMonday), equals(true));
    t.check(
      isFirstMondayOfQuarterMonth(new Date("2026-04-13T07:00:00.000Z")),
      equals(false),
    );

    t.check(sentMessage, includes("Quarterly Business Review"));
    t.check(sentMessage, includes("KPI Cascade"));
    t.check(sentMessage, includes("Delivery & Execution"));
    t.check(sentMessage, includes("Media & CRM"));
    t.check(sentMessage, includes("Financials"));
    t.check(sentMessage, includes("Risks & Decisions"));
    t.check(sentMessage, includes("Learnings"));
    t.check(sentMessage, includes("Next-Quarter Priorities"));
    t.check(sentMessage, includes("Provenance disclosure"));
    t.check(sentMessage, includes("operations"));
    t.check(sentMessage, includes("UNKNOWN / NOT CONNECTED"));
    t.check(sentMessage, includes("Disclosure"));
  },
});
