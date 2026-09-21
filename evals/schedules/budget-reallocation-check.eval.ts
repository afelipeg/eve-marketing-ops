import { defineEval } from "eve/evals";
import budgetReallocationSchedule from "../../agent/schedules/budget-reallocation-check";
import { equals, includes } from "eve/evals/expect";

/**
 * Eval for budget-reallocation-check schedule.
 * Verifies the schedule handler runs and produces the expected message.
 */
export default defineEval({
  description: "Budget reallocation check schedule handler executes and produces alert message",
  async test(t) {
    const schedule = budgetReallocationSchedule;

    let sentMessage = "";
    const mockTo = (channel: any, target: any) => ({
      send: async (message: string) => {
        sentMessage = message;
        return { sessionId: "test-session" };
      },
    });
    const mockWaitUntil = (p: Promise<unknown>) => p;
    const mockAppAuth = { authenticator: "app", principalId: "eve:app", principalType: "runtime", attributes: {} };

    await schedule.run({
      to: mockTo as any,
      waitUntil: mockWaitUntil,
      appAuth: mockAppAuth,
    });

    t.check(sentMessage, includes("Daily Budget Reallocation Check"));
    t.check(sentMessage, includes("operations"));
    t.check(sentMessage, includes("measurement"));
    t.check(sentMessage, includes("validate_result"));
    t.check(sentMessage, includes("reallocate_budget"));
    t.check(sentMessage, includes("explicit confirmation"));
    t.check(sentMessage.includes("Call `get_plan_state`"), equals(false));
    t.check(sentMessage, includes("Disclosure"));
  },
});
