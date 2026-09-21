import { defineSchedule } from "eve/schedules";
import eveChannel from "../channels/eve";

/**
 * Weekly Control Tower — runs every Monday 09:00 UTC.
 *
 * Triggers the full weekly review cycle:
 * 1. Read the recalled cross-session operations snapshot
 * 2. Read KPI history for the completed week (get_kpi_history)
 * 3. Read budget envelopes (get_budget)
 * 4. For each delegation with status "reported" + significance "untested":
 *    - Delegate validation to measurement agent
 * 5. For each delegation with significance "not-significant", request an
 *    operator decision. A schedule never approves its own reallocation.
 * 6. Produce executive summary: delivery status, campaign performance,
 *    CRM activity, media pacing, blockers, SLA risk, FTE load, margin drift,
 *    executive decisions needed.
 * 7. Post summary to the eve channel for the operator.
 */
export default defineSchedule({
  cron: "0 9 * * 1", // Monday 09:00 UTC
  async run({ to, waitUntil, appAuth }) {
    // `$(date ...)` is shell substitution — inside a JS template literal it
    // renders literally into the message. Only `${...}` interpolates.
    const today = new Date().toISOString().slice(0, 10);
    waitUntil(
      to(eveChannel, {}).send(
        `**Weekly Control Tower — ${today}**

Run the weekly control tower review. Follow the working method from instructions.md:

1. **Read durable context**: Use the recalled \`operations\` memory. Do not call \`get_plan_state\`: this schedule starts a new session and cannot see another session's state. If no approved snapshot was recalled, mark plan/delegation fields UNKNOWN and request an operator snapshot; never invent them.
2. **Read KPIs**: Call \`get_kpi_history\` for the last completed period (brand, category, territory from plan).
3. **Read budget**: Call \`get_budget\` for current period and territory.
4. **Validate pending results**: For each recalled delegation with status "reported" and significance "untested", delegate to \`measurement\`, then call \`validate_result\` with the brief, claimed result, and measurement design.
5. **Propose reallocation**: For each validated delegation with significance "not-significant" and status !== "reallocated", show the exact release, retain percentage, validation ID, and receivers. Do not call \`reallocate_budget\` from this schedule; ask the operator to approve it in an interactive session.
6. **Executive summary**: Produce a concise table covering:
   - Delivery status per service (on track / at risk / blocked)
   - KPI vs target per service (with provenance disclosure)
   - Spend vs plan per service
   - Significance status (validated / pending / not-significant → reallocated)
   - Blockers and SLA risks
   - FTE load vs capacity
   - Margin drift vs plan
   - Decisions needed from operator (budget commits, market-facing actions)
7. **Post the summary** here for the operator.

Every unavailable source is **UNKNOWN**, not GREEN and not zero. Never claim that a market-facing or budget action executed merely because it was proposed.

**Output budget**: maximum 800 words and two compact tables. Link decisions to evidence without
reproducing tool payloads or the recalled snapshot.

**Disclosure**: You are an automated system. State when you are using sample data (provenance: "sample").`,
        { auth: appAuth }
      )
    );
  },
});
