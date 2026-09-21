/**
 * Workflow-safe JSON Schema for the hidden validation subagent.
 *
 * Keep this literal aligned with validationDecisionSchema in output.ts. A literal is intentional here:
 * workflow core bundles cannot depend on a module-scope z.toJSONSchema call.
 * The outer validate_result tool adds its audit envelope and validates the
 * complete returned value with Zod.
 */
export const validationOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    directive: { enum: ["EXECUTE", "REBRIEF", "ESCALATE", "HOLD"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    checks: {
      type: "object",
      additionalProperties: false,
      properties: {
        significance: {
          type: "object",
          additionalProperties: false,
          properties: {
            pass: { type: "boolean" },
            reasoning: { type: "string", minLength: 1, maxLength: 800 },
            evidence: { type: "string", minLength: 1, maxLength: 800 },
          },
          required: ["pass", "reasoning", "evidence"],
        },
        guardrails: {
          type: "object",
          additionalProperties: false,
          properties: {
            pass: { type: "boolean" },
            reasoning: { type: "string", minLength: 1, maxLength: 800 },
            violations: {
              type: "array",
              maxItems: 8,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  guardrail: { type: "string", minLength: 1, maxLength: 120 },
                  limit: { type: "number" },
                  actual: { type: "number" },
                  severity: { enum: ["warning", "breach"] },
                },
                required: ["guardrail", "limit", "actual", "severity"],
              },
            },
          },
          required: ["pass", "reasoning"],
        },
        economics: {
          type: "object",
          additionalProperties: false,
          properties: {
            pass: { type: "boolean" },
            reasoning: { type: "string", minLength: 1, maxLength: 800 },
            incrementalMargin: { type: "number" },
            cost: { type: "number", minimum: 0 },
            roi: { type: "number" },
            buffer: { type: "number", minimum: 0 },
          },
          required: ["pass", "reasoning", "incrementalMargin", "cost", "roi", "buffer"],
        },
        measurement: {
          type: "object",
          additionalProperties: false,
          properties: {
            pass: { type: "boolean" },
            reasoning: { type: "string", minLength: 1, maxLength: 800 },
            designQuality: { enum: ["clean", "acceptable", "contaminated", "unreadable"] },
            mdeVsObserved: { type: "number" },
          },
          required: ["pass", "reasoning", "designQuality"],
        },
      },
      required: ["significance", "guardrails", "economics", "measurement"],
    },
    directives: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          team: { enum: ["growth", "creative", "data", "media", "pricing", "crm", "field", "finance", "legal", "brand"] },
          task: { type: "string", minLength: 1, maxLength: 800 },
          deadline: { type: "string", minLength: 1 },
          evidence: { type: "string", minLength: 1, maxLength: 800 },
          owner: { type: "string", minLength: 1, maxLength: 120 },
          priority: { enum: ["P0-blocker", "P1-this-week", "P2-this-sprint", "P3-backlog"] },
          dependencies: {
            type: "array",
            maxItems: 8,
            items: { type: "string", minLength: 1, maxLength: 120 },
          },
        },
        required: ["team", "task", "deadline", "evidence", "owner", "priority"],
      },
    },
    kpisToWatch: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kpi: { type: "string", minLength: 1, maxLength: 120 },
          currentValue: { type: "number" },
          threshold: { type: "number" },
          direction: { enum: ["above", "below"] },
          alertChannel: { type: "string", minLength: 1, maxLength: 120 },
        },
        required: ["kpi", "currentValue", "threshold", "direction"],
      },
    },
    blockers: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          blocker: { type: "string", minLength: 1, maxLength: 800 },
          impact: { type: "string", minLength: 1, maxLength: 800 },
          resolutionOwner: { type: "string", minLength: 1, maxLength: 120 },
          resolutionDeadline: { type: "string" },
        },
        required: ["blocker", "impact", "resolutionOwner"],
      },
    },
  },
  required: [
    "directive",
    "confidence",
    "checks",
    "directives",
    "kpisToWatch",
    "blockers",
  ],
} as const;

export async function getValidationOutputJsonSchema() {
  "use step";
  return validationOutputJsonSchema;
}
