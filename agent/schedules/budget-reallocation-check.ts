import { defineSchedule } from "eve/schedules";
import eveChannel from "../channels/eve";

/**
 * Daily Budget Reallocation Check — runs every weekday 06:00 UTC.
 *
 * Lightweight scan for delegations that have reported results but are still
 * "untested" (awaiting measurement validation) or "not-significant" (awaiting
 * reallocation). This prevents the weekly control tower from accumulating a
 * backlog of unvalidated claims.
 *
 * Each fire starts a new session. It therefore uses recalled operations memory,
 * not defineState, to find approved snapshots from earlier sessions.
 */
export default defineSchedule({
  cron: "0 6 * * 1-5", // Weekdays 06:00 UTC
  async run({ to, waitUntil, appAuth }) {
    // `$(date ...)` is shell substitution — inside a JS template literal it
    // renders literally into the message. Only `${...}` interpolates.
    const today = new Date().toISOString().slice(0, 10);
    waitUntil(
      to(eveChannel, {}).send(
        `**Daily Budget Reallocation Check — ${today}**

Run a lightweight reallocation scan:

1. Read the recalled \`operations\` memory. Do not call \`get_plan_state\`: schedule fires do not share session state.
2. If no approved operational snapshot was recalled, post exactly: "Operational snapshot unavailable; scan not performed." and stop. Do not infer a plan.
3. From the recalled snapshot, identify delegations needing action:
   - **Awaiting validation**: status="reported" AND significance="untested"
   - **Awaiting reallocation**: significance="not-significant" AND status!=="reallocated"
4. For each **awaiting validation**: delegate to \`measurement\`, then call \`validate_result\` with its causal read.
5. For each **awaiting reallocation**: DO NOT call \`reallocate_budget\`. Post a structured alert here with:
   - Delegation ID, service, budget, measured uplift %, measurement evidence
   - Proposed \`releaseFrom\` and \`retainPctOnReleased\` (default 0)
   - Ask operator for explicit confirmation before calling \`reallocate_budget\`.
6. If no actions are needed, post: "No pending validations or reallocations."

**Output budget**: maximum 350 words and one compact table. Do not repeat the recalled snapshot.

**Disclosure**: You are an automated system. State when using sample data.`,
        { auth: appAuth }
      )
    );
  },
});
