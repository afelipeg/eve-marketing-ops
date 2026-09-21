import { defineEval } from "eve/evals";
import weeklyBusinessSweepSchedule from "../../agent/schedules/weekly-business-sweep";
import { includes } from "eve/evals/expect";

/**
 * Eval for weekly-business-sweep schedule.
 * Verifies the schedule handler runs and produces the capacity traffic light.
 */
export default defineEval({
  description: "Weekly business sweep schedule handler executes and produces capacity traffic light",
  async test(t) {
    const schedule = weeklyBusinessSweepSchedule;

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

    t.check(sentMessage, includes("Weekly Business Sweep-Review"));
    t.check(sentMessage, includes("Creative Supply"));
    t.check(sentMessage, includes("Data & Engineering"));
    t.check(sentMessage, includes("Measurement Capacity"));
    t.check(sentMessage, includes("Trade"));
    t.check(sentMessage, includes("Sub-Agent Concurrency"));
    t.check(sentMessage, includes("traffic-light"));
    t.check(sentMessage, includes("UNKNOWN / NOT CONNECTED"));
    t.check(sentMessage, includes("operations"));
    t.check(sentMessage, includes("Disclosure"));
  },
});
