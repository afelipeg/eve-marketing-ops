import { defineSchedule } from "eve/schedules";
import eveChannel from "../channels/eve";

/**
 * Weekly Business Sweep-Review — runs every Monday 08:00 UTC (1 hour before Control Tower).
 *
 * Operational capacity check across the five binding constraints (resource-allocation skill):
 * 1. Creative supply — assets per variant per channel, fatigue risk
 * 2. Data & engineering — feed freshness, model refresh status, integration health
 * 3. Measurement capacity — concurrent clean holdouts, contamination risk
 * 4. Trade/field — store visits, planogram changes, PPA deployment status
 * 5. Sub-agent concurrency — overlapping scopes, conflicting decisions
 *
 * Output: a capacity traffic light (green/yellow/red per constraint) + recommended
 * plan resizing before the Control Tower commits budget.
 */
export default defineSchedule({
  cron: "0 8 * * 1", // Monday 08:00 UTC
  async run({ to, waitUntil, appAuth }) {
    // `$(date ...)` is shell substitution — inside a JS template literal it
    // renders literally into the message. Only `${...}` interpolates.
    const today = new Date().toISOString().slice(0, 10);
    waitUntil(
      to(eveChannel, {}).send(
        `**Weekly Business Sweep-Review — ${today}**

Run the operational capacity sweep before the Control Tower. Check the five capacities (resource-allocation skill):

Use recalled \`operations\` memory for approved plan/delegation context and the available data tools for sourced metrics. Do not call \`get_plan_state\`, because a schedule fire has a fresh session. If a requested source is not connected, mark that row **UNKNOWN / NOT CONNECTED** and name the missing source; never infer GREEN/YELLOW/RED.

### 1. Creative Supply
- Assets needed this period (per briefed service: advertisements creatives, promotions variants, recommendations slots)
- Assets available (fresh, approved, correct formats)
- Fatigue risk: impressions per creative vs threshold
- **Status**: GREEN / YELLOW / RED + gap count

### 2. Data & Engineering
- Feed freshness: last successful ingest per source (CDP, ad platforms, warehouse)
- Model refresh status: when were propensity/uplift/demand models last retrained?
- Integration health: any broken APIs, schema drift, auth failures
- **Status**: GREEN / YELLOW / RED + stale feeds count

### 3. Measurement Capacity
- Active holdouts this period (list: service, territory, design, end date)
- Holdout contamination risk: overlapping scopes, shared control groups
- Minimum detectable effect (MDE) per holdout vs expected uplift
- **Status**: GREEN / YELLOW / RED + unreadable tests count

### 4. Trade / Field
- Assortment/PPA changes scheduled this period (list: SKU, territory, deployment date)
- Planogram compliance rate (last read)
- Stock cover weeks per power couple (top EBITDA brand-pack-channel)
- **Status**: GREEN / YELLOW / RED + at-risk deployments

### 5. Sub-Agent Concurrency
- Active delegations per service (from recalled \`operations\` memory; if absent, mark UNKNOWN / NOT CONNECTED)
- Overlapping scopes: same brand/category/territory + overlapping windows
- Conflicting decisions risk: e.g., pricing testing elasticity on SKU while promotions discounts it
- **Status**: GREEN / YELLOW / RED + collision count

### Output Format
Post a single traffic-light table:

| Capacity | Status | Gap / Risk | Recommended Action |
|----------|--------|------------|-------------------|
| Creative Supply | 🟢/🟡/🔴 | ... | ... |
| Data & Engineering | 🟢/🟡/🔴 | ... | ... |
| Measurement | 🟢/🟡/🔴 | ... | ... |
| Trade/Field | 🟢/🟡/🔴 | ... | ... |
| Sub-Agent Concurrency | 🟢/🟡/🔴 | ... | ... |

**If any RED**: Recommend plan resize (cut a play, don't cut measurement reserve) before Control Tower.
**If all GREEN/YELLOW**: Control Tower proceeds as planned.
**If any UNKNOWN**: Do not authorize the Control Tower; request the missing source or an operator decision.

**Output budget**: maximum 500 words and the single required table. Do not reproduce source rows.

**Disclosure**: You are an automated system. State when using sample data.`,
        { auth: appAuth }
      )
    );
  },
});
