"use client"

import { defineRegistry } from "@json-render/react"

import { operationsCatalog } from "@/lib/json-render/operations-catalog"
import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { cn } from "@/lib/utils"

const runtimeBadge = {
  error: "destructive-light",
  ready: "success-light",
  running: "info-light",
  waiting: "warning-light",
} as const

const validationBadge = {
  blocked: "warning-light",
  failed: "destructive-light",
  passed: "success-light",
  ready: "secondary",
  running: "info-light",
} as const

const toolStateBadge = {
  complete: "success-light",
  denied: "warning-light",
  error: "destructive-light",
  running: "info-light",
  waiting: "warning-light",
} as const

export const { registry: operationsRegistry } = defineRegistry(operationsCatalog, {
  components: {
    Stack: ({ props, children }) => (
      <div className={cn("flex flex-col", props.gap === "sm" ? "gap-2" : "gap-3")}>
        {children}
      </div>
    ),
    Section: ({ props, children }) => (
      <Frame dense spacing="sm">
        <FrameHeader>
          <FrameTitle>{props.title}</FrameTitle>
          {props.description ? (
            <FrameDescription>{props.description}</FrameDescription>
          ) : null}
        </FrameHeader>
        <FramePanel className="space-y-2">{children}</FramePanel>
      </Frame>
    ),
    RuntimeRow: ({ props }) => (
      <div className="flex items-start gap-2 rounded-lg border border-border/60 p-2.5">
        <span
          aria-hidden="true"
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            props.status === "error"
              ? "bg-destructive"
              : props.status === "waiting"
                ? "bg-warning"
                : props.status === "running"
                  ? "bg-primary animate-pulse motion-reduce:animate-none"
                  : "bg-success",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{props.name}</span>
            <Badge size="sm" variant={runtimeBadge[props.status]}>
              {props.status}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">{props.model}</p>
          <p className="mt-1 text-xs text-muted-foreground/80">{props.detail}</p>
        </div>
      </div>
    ),
    ValidationRow: ({ props }) => (
      <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
        <div className="min-w-0">
          <p className="text-sm font-medium">{props.name}</p>
          <p className="text-xs text-muted-foreground">{props.detail}</p>
        </div>
        <Badge className="shrink-0" size="sm" variant={validationBadge[props.verdict]}>
          {props.verdict}
        </Badge>
      </div>
    ),
    ToolContractRow: ({ props }) => (
      <div className="rounded-lg border border-border/60 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{props.name}</span>
          <Badge size="sm" variant={toolStateBadge[props.state]}>
            {props.state}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{props.detail}</p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          {props.contract === "strict" ? "Strict output contract" : "Structured object boundary"}
        </p>
      </div>
    ),
    BarChart: ({ props }) => {
      const max = Math.max(1, ...props.series.map((item) => item.value))

      return (
        <figure aria-label={props.title} className="space-y-2">
          <figcaption className="text-xs font-medium text-muted-foreground">
            {props.title}
          </figcaption>
          {props.series.map((item) => (
            <div className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2" key={item.label}>
              <span className="truncate text-xs text-muted-foreground">{item.label}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
                <div
                  className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
                  style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
                />
              </div>
              <span className="text-right text-xs tabular-nums">
                {formatChartValue(item.value, props.format, props.currency)}
              </span>
            </div>
          ))}
        </figure>
      )
    },
  },
})

function formatChartValue(
  value: number,
  format: "number" | "currency" | "percent",
  currency?: string,
) {
  if (format === "percent") {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
      style: "percent",
    }).format(value)
  }
  if (format === "currency" && currency) {
    return new Intl.NumberFormat(undefined, {
      compactDisplay: "short",
      currency,
      maximumFractionDigits: 1,
      notation: "compact",
      style: "currency",
    }).format(value)
  }
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    notation: value >= 1_000 ? "compact" : "standard",
  }).format(value)
}
