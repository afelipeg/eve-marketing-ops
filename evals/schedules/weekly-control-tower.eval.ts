import { defineEval } from "eve/evals";
import weeklyControlTowerSchedule from "../../agent/schedules/weekly-control-tower";
import { includes } from "eve/evals/expect";

/**
 * Eval for weekly-control-tower schedule.
 * Verifies the schedule uses cross-session memory and never self-approves a reallocation.
 */
export default defineEval({
  description: "Weekly control tower uses durable context and requests reallocation approval",
  async test(t) {
    const schedule = weeklyControlTowerSchedule;

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

    t.check(sentMessage, includes("Weekly Control Tower"));
    t.check(sentMessage, includes("operations"));
    t.check(sentMessage, includes("get_kpi_history"));
    t.check(sentMessage, includes("get_budget"));
    t.check(sentMessage, includes("measurement"));
    t.check(sentMessage, includes("validate_result"));
    t.check(sentMessage, includes("reallocate_budget"));
    t.check(sentMessage, includes("Do not call"));
    t.check(sentMessage, includes("UNKNOWN"));
    t.check(sentMessage, includes("Disclosure"));
  },
});
