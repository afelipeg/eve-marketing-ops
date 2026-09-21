"use client"

import type { Spec } from "@json-render/core"
import { JSONUIProvider, Renderer } from "@json-render/react"
import { PanelRightClose } from "lucide-react"
import type { EveDynamicToolPart, EveMessage, UseEveAgentStatus } from "eve/react"

import { operationsRegistry } from "@/components/operations/operations-registry"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

export function OperationsPanel({
  eventTypes,
  messages,
  onClose,
  status,
}: {
  eventTypes: readonly string[]
  messages: readonly EveMessage[]
  onClose: () => void
  status: UseEveAgentStatus
}) {
  const toolParts = messages.flatMap((message) =>
    message.parts.filter((part) => part.type === "dynamic-tool"),
  )
  const reasoningCount = messages.reduce(
    (count, message) =>
      count + message.parts.filter((part) => part.type === "reasoning").length,
    0,
  )
  const validationParts = toolParts.filter((part) =>
    /valid|jev|measure/i.test(part.toolName),
  )
  const runtimeStatus = toRuntimeStatus(status)
  const budgetChart = budgetAllocationChart(toolParts)
  const jevChart = jevDecisionChart(toolParts)
  const decisionChartIds = [
    ...(budgetChart ? ["budget-allocation-chart"] : []),
    ...(jevChart ? ["jev-decision-chart"] : []),
    "activity-chart",
  ]

  const validationChildren = validationParts.length
    ? validationParts.slice(-4).map((part, index) => {
        const id = `validation-${index}`
        return [
          id,
          {
            type: "ValidationRow",
            props: {
              detail: validationDetail(part.state),
              name: part.toolName,
              verdict: validationVerdict(part.state),
            },
            children: [],
          },
        ] as const
      })
    : [
        [
          "validation-contracts",
          {
            type: "ValidationRow",
            props: {
              detail: "Zod and JSON Schema boundaries loaded",
              name: "Typed contracts",
              verdict: "ready",
            },
            children: [],
          },
        ],
        [
          "validation-jev",
          {
            type: "ValidationRow",
            props: {
              detail: "Evidence gate waits for a validation workflow",
              name: "JEV review",
              verdict: "ready",
            },
            children: [],
          },
        ],
      ] as const

  const validationIds = validationChildren.map(([id]) => id)
  const toolChildren = toolParts.slice(-4).map((part, index) => {
    const id = `tool-contract-${index}`
    return [
      id,
      {
        type: "ToolContractRow",
        props: {
          contract: strictOutputContract(part.toolName) ? "strict" : "object",
          detail: toolOutputDetail(part),
          name: part.toolName,
          state: toolRenderState(part.state),
        },
        children: [],
      },
    ] as const
  })
  const toolIds = toolChildren.map(([id]) => id)
  const spec: Spec = {
    root: "operations-root",
    elements: {
      "operations-root": {
        type: "Stack",
        props: { gap: "md" },
        children: ["decision-section", "runtime-section", "validation-section", "tool-section"],
      },
      "decision-section": {
        type: "Section",
        props: {
          description: "Verified EVE outputs rendered through the JSON Render catalog",
          title: "Decision visuals · JSON Render",
        },
        children: decisionChartIds,
      },
      ...(budgetChart
        ? {
            "budget-allocation-chart": {
              type: "BarChart",
              props: budgetChart,
              children: [],
            },
          }
        : {}),
      ...(jevChart
        ? {
            "jev-decision-chart": {
              type: "BarChart",
              props: jevChart,
              children: [],
            },
          }
        : {}),
      "activity-chart": {
        type: "BarChart",
        props: {
          format: "number",
          title: "Live event mix",
          series: [
            { label: "Events", value: eventTypes.length },
            { label: "Messages", value: messages.length },
            { label: "Tools", value: toolParts.length },
            { label: "Reasoning", value: reasoningCount },
          ],
        },
        children: [],
      },
      "runtime-section": {
        type: "Section",
        props: {
          description: "Configured models and execution surfaces",
          title: "Runtimes",
        },
        children: [
          "runtime-root",
          "runtime-promotions",
          "runtime-advertisements",
          "runtime-recommendations",
          "runtime-pricing",
          "runtime-measurement",
          "runtime-validation",
        ],
      },
      "runtime-root": {
        type: "RuntimeRow",
        props: {
          detail: `${messages.length} projected messages in the durable session`,
          model: "anthropic/claude-sonnet-5 · medium",
          name: "Orchestrator",
          status: runtimeStatus,
        },
        children: [],
      },
      "runtime-promotions": {
        type: "RuntimeRow",
        props: {
          detail: "Uplift targeting, holdouts and promotion ROI",
          model: "deepseek/deepseek-v4-pro-0813 · medium",
          name: "Promotions",
          status: agentRuntimeStatus(toolParts, "promotions"),
        },
        children: [],
      },
      "runtime-advertisements": {
        type: "RuntimeRow",
        props: {
          detail: "RTB, pacing, fraud controls and causal attribution",
          model: "deepseek/deepseek-v4-pro-0813 · medium",
          name: "Advertisements",
          status: agentRuntimeStatus(toolParts, "advertisements"),
        },
        children: [],
      },
      "runtime-recommendations": {
        type: "RuntimeRow",
        props: {
          detail: "Hybrid ranking, latent factors and diversity",
          model: "deepseek/deepseek-v4-pro-0813 · medium",
          name: "Recommendations",
          status: agentRuntimeStatus(toolParts, "recommendations"),
        },
        children: [],
      },
      "runtime-pricing": {
        type: "RuntimeRow",
        props: {
          detail: "Elasticity, bundles, markdowns and capacity pricing",
          model: "deepseek/deepseek-v4-pro-0813 · medium",
          name: "Pricing",
          status: agentRuntimeStatus(toolParts, "pricing"),
        },
        children: [],
      },
      "runtime-measurement": {
        type: "RuntimeRow",
        props: {
          detail: "Causal uplift, power, significance and attribution",
          model: "anthropic/claude-sonnet-5 · medium",
          name: "Measurement",
          status: agentRuntimeStatus(toolParts, "measurement"),
        },
        children: [],
      },
      "runtime-validation": {
        type: "RuntimeRow",
        props: {
          detail: "Draft validation plus evidence-scoring gate",
          model: "openai/gpt-5.6-luna + typesafe-ai/jev",
          name: "Validation/JEV",
          status: agentRuntimeStatus(toolParts, "validation"),
        },
        children: [],
      },
      "validation-section": {
        type: "Section",
        props: {
          description: "Latest typed workflow gates",
          title: "Workflow validations",
        },
        children: validationIds,
      },
      ...Object.fromEntries(validationChildren),
      "tool-section": {
        type: "Section",
        props: {
          description: toolIds.length
            ? "Latest schema-validated EVE tool results"
            : "Tool results appear after the first agent run",
          title: "Tool contracts",
        },
        children: toolIds,
      },
      ...Object.fromEntries(toolChildren),
    },
  }

  return (
    <aside className="flex min-h-0 w-[23rem] shrink-0 flex-col border-l bg-background max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-30 max-xl:shadow-xl">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <div>
          <p className="text-sm font-semibold">EVE control plane</p>
          <p className="text-xs text-muted-foreground">JSON-rendered live telemetry</p>
        </div>
        <Button aria-label="Close operations panel" onClick={onClose} size="icon-sm" type="button" variant="ghost">
          <PanelRightClose aria-hidden="true" />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          <JSONUIProvider registry={operationsRegistry}>
            <Renderer registry={operationsRegistry} spec={spec} />
          </JSONUIProvider>
        </div>
      </ScrollArea>
    </aside>
  )
}

function budgetAllocationChart(parts: EveDynamicToolPart[]) {
  const output = latestToolOutput(parts, /^allocate_budget$/)
  if (!isRecord(output) || !isRecord(output.plan)) return null

  const currency = typeof output.plan.currency === "string"
    ? output.plan.currency.toUpperCase()
    : "USD"
  const lines = Array.isArray(output.plan.lines) ? output.plan.lines : []
  const series = lines.flatMap((line) => {
    if (!isRecord(line) || typeof line.service !== "string" || typeof line.amount !== "number") {
      return []
    }
    return [{ label: titleCase(line.service), value: Math.max(0, line.amount) }]
  })
  if (typeof output.plan.measurementReserve === "number") {
    series.push({ label: "Measurement", value: Math.max(0, output.plan.measurementReserve) })
  }
  if (series.length === 0) return null

  return {
    currency,
    format: "currency" as const,
    series: series.slice(0, 8),
    title: `Budget allocation · ${currency}`,
  }
}

function jevDecisionChart(parts: EveDynamicToolPart[]) {
  const output = latestToolOutput(parts, /^validate_result$/)
  if (!isRecord(output)) return null

  const series: Array<{ label: string; value: number }> = []
  if (typeof output.confidence === "number") {
    series.push({ label: "Confidence", value: clamp01(output.confidence) })
  }
  if (isRecord(output.jevReview) && typeof output.jevReview.supportProbability === "number") {
    series.push({ label: "JEV support", value: clamp01(output.jevReview.supportProbability) })
  }
  if (series.length === 0) return null

  const directive = typeof output.directive === "string" ? ` · ${output.directive}` : ""
  return {
    format: "percent" as const,
    series,
    title: `Validation confidence${directive}`,
  }
}

function latestToolOutput(parts: EveDynamicToolPart[], name: RegExp) {
  const latest = parts
    .filter((part) => name.test(part.toolName) && part.state === "output-available")
    .at(-1)
  return latest?.state === "output-available" ? latest.output : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function titleCase(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function strictOutputContract(toolName: string) {
  return /^(allocate_budget|get_budget|get_kpi_history|get_plan_state|record_delegation|reallocate_budget|run_prototype_script|validate_result)$/.test(
    toolName,
  )
}

function toolRenderState(state: string) {
  if (state === "output-available") return "complete" as const
  if (state === "output-error") return "error" as const
  if (state === "output-denied") return "denied" as const
  if (state === "approval-requested") return "waiting" as const
  return "running" as const
}

function toolOutputDetail(part: EveDynamicToolPart) {
  if (part.state === "output-error") return "Execution failed; no result crossed the contract boundary."
  if (part.state === "output-denied") return "The operator denied this guarded action."
  if (part.state === "approval-requested") return "Waiting for the owner approval gate."
  if (part.state !== "output-available") return "Executing with a validated input contract."

  const output = part.output
  if (output && typeof output === "object" && !Array.isArray(output)) {
    const keys = Object.keys(output).slice(0, 5)
    return keys.length ? `Validated fields: ${keys.join(", ")}` : "Validated structured result."
  }
  return "Validated result received."
}

function toRuntimeStatus(status: UseEveAgentStatus) {
  if (status === "error") return "error" as const
  if (status === "resuming") return "waiting" as const
  if (status === "streaming" || status === "submitted") return "running" as const
  return "ready" as const
}

function isTerminal(state: string) {
  return state === "output-available" || state === "output-error" || state === "output-denied"
}

function validationVerdict(state: string) {
  if (state === "output-error") return "failed" as const
  if (state === "output-denied") return "blocked" as const
  if (state === "output-available") return "passed" as const
  return "running" as const
}

function validationDetail(state: string) {
  if (state === "output-error") return "The workflow returned an error"
  if (state === "output-denied") return "The operator denied the guarded action"
  if (state === "output-available") return "The workflow produced a typed result"
  return "The workflow is still evaluating evidence"
}

function agentRuntimeStatus(parts: EveDynamicToolPart[], agentId: string) {
  const latest = parts.filter((part) => toolMatchesAgent(part, agentId)).at(-1)
  if (!latest) return "ready" as const
  if (latest.state === "output-error") return "error" as const
  if (latest.state === "approval-requested") return "waiting" as const
  if (isTerminal(latest.state)) return "ready" as const
  return "running" as const
}

function toolMatchesAgent(part: EveDynamicToolPart, agentId: string) {
  const aliases: Record<string, RegExp> = {
    advertisements: /advertis|\bads?\b|rtb|bid/i,
    measurement: /measure|uplift|experiment|attribution|significance/i,
    pricing: /pric|elastic|markdown|bundle/i,
    promotions: /promot|coupon|bogo|offer/i,
    recommendations: /recommend|ranking|svd|collaborative/i,
    validation: /valid|jev|verdict|evidence/i,
  }
  let input = ""
  try {
    input = JSON.stringify(part.input)
  } catch {
    input = String(part.input)
  }
  return (aliases[agentId] ?? new RegExp(agentId, "i")).test(
    `${part.toolName} ${input}`,
  )
}
