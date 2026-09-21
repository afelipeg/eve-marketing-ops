import { defineSchedule } from "eve/schedules";
import eveChannel from "../channels/eve";

/**
 * Quarterly Business Review (QBR) Generator — cron checks each Monday in a
 * quarter-opening month and the handler dispatches only the first Monday.
 *
 * Comprehensive quarterly synthesis for CEO/CFO/CRO/CMO-ready executive memo.
 * Follows the KPI cascade framework from weekly-control-tower.
 *
 * Sources:
 * - Approved cross-session snapshots recalled from operations memory
 * - KPI history for the quarter (get_kpi_history)
 * - Budget envelopes for the quarter (get_budget)
 * - Measurement experiment results (measurement sub-agent logs)
 * - Delegation ledger with significance outcomes
 * - Reallocation history
 *
 * Output: Executive memo + optional deck/data appendix.
 */
export function isFirstMondayOfQuarterMonth(now: Date): boolean {
  return (
    now.getUTCDay() === 1 &&
    now.getUTCDate() <= 7 &&
    [0, 3, 6, 9].includes(now.getUTCMonth())
  );
}

export function buildQbrPrompt(now: Date): string {
  const closedQuarter = Math.floor(now.getUTCMonth() / 3);
  const quarter = closedQuarter === 0 ? 4 : closedQuarter;
  const year = closedQuarter === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const period = `${year}-Q${quarter}`;

  return `**Quarterly Business Review (QBR) — ${period}**

Use recalled \`operations\` memory for approved cross-session decisions and the available KPI/budget tools for sourced figures. Do not call \`get_plan_state\`: schedule sessions do not share state. If durable context or a requested source is missing, label it UNKNOWN / NOT CONNECTED; never manufacture a quarter history.

Generate the executive QBR for the completed quarter. Synthesize:

### 1. Performance Summary (KPI Cascade)
- **Top-line**: Revenue, Gross Margin, Marketing Contribution vs target
- **By Objective**: Acquisition (CAC, new buyers, LTV:CAC), Maximization (AOV, SOM), Retention (repeat rate, churn), Revenue (incremental margin)
- **By Service**: Spend, ROI/ROAS, incremental revenue/margin, significance rate
- **Provenance disclosure** for every figure (sample vs external)

### 2. Delivery & Execution
- Plan vs actual per service (budget, timeline, scope)
- Completed delegations count, success rate (significant uplift %)
- Reallocations executed (from what, to what, reason, outcome)
- Capacity constraints that bound the plan (creative, data, measurement, trade, concurrency)

### 3. Media & CRM Performance
- Channel-level ROAS, CPA, incrementality (measurement-validated)
- CRM journey performance: flow completion, uplift per touch, LTV impact
- Creative fatigue: impression frequency, refresh cadence, test velocity

### 4. Pricing & Assortment (if applicable)
- Price changes deployed, elasticity reads, margin impact
- PPA changes, white space captures, cannibalization measured
- Stock cover protection on power couples

### 5. Financials
- Marketing P&L: spend by service, incremental margin, net contribution
- Margin drift vs plan (Monte Carlo bands if available)
- Leakage sources: unmeasured spend, holdout contamination, scope creep
- Fee sufficiency vs delivery cost (FTE economics, vendor costs)

### 6. Risks & Decisions
- **Strategic risks**: competitive moves, channel saturation, regulatory
- **Operational risks**: data gaps, model staleness, talent/Capacity
- **Decisions taken this quarter**: budget commits, market-facing actions, scope changes
- **Decisions needed next quarter**: new objectives, service builds, measurement designs

### 7. Learnings & Institutional Memory
- What worked (validated response curves, successful holdouts)
- What didn't (non-significant services, contaminated tests, failed assumptions)
- Updated priors for next quarter's allocation (marginal ROI per service)
- Client memory updates (preferences, guardrails, relationship dynamics)

### 8. Next-Quarter Priorities
- Proposed objectives with KPI/baseline/target
- Measurement reserve allocation
- Capacity investments needed (creative, data, measurement, field)
- Sub-agent roadmap: which capability, if any, is worth building next. Note that
  search and assortment were deliberately removed from the service vocabulary and the
  allocation priors, so they carry no weight to compare against a threshold — any case
  for building them has to be argued from unserved demand, not from a budget share that
  no longer exists.

### Output
Post the executive memo here. Offer to generate:
- **PPTX deck** (if pptx skill available)
- **XLSX appendix** (if xlsx skill available)
- **DOCX narrative** (if docx skill available)

**Output budget**: maximum 1,800 words and four compact tables. Prefer executive decisions and
variance explanations; do not reproduce source rows or tool payloads.

**Disclosure**: You are an automated system. State when using sample data.`;
}

export default defineSchedule({
  // Cron day-of-month/day-of-week combinations are not a portable AND. Run on
  // Mondays in quarter-opening months, then enforce first-Monday in code.
  cron: "0 7 * 1,4,7,10 1",
  async run({ to, waitUntil, appAuth }) {
    const now = new Date();
    if (!isFirstMondayOfQuarterMonth(now)) return;

    waitUntil(
      to(eveChannel, {}).send(
        buildQbrPrompt(now),
        { auth: appAuth }
      )
    );
  },
});
