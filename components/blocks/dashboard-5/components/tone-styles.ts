import { type LoadState, type MetricTone } from "./data"

export const toneStyles: Record<
  MetricTone,
  {
    dot: string
    stroke: string
    bar: string
  }
> = {
  danger: {
    dot: "bg-red-500",
    stroke: "var(--color-red-500)",
    bar: "bg-red-500",
  },
  success: {
    dot: "bg-emerald-500",
    stroke: "var(--color-emerald-500)",
    bar: "bg-emerald-500",
  },
  warning: {
    dot: "bg-amber-500",
    stroke: "var(--color-amber-500)",
    bar: "bg-amber-500",
  },
  info: {
    dot: "bg-blue-500",
    stroke: "var(--color-blue-500)",
    bar: "bg-blue-500",
  },
}

export const loadStateColor: Record<LoadState, string> = {
  nominal: "var(--color-zinc-300)",
  warm: "var(--color-amber-500)",
  critical: "var(--color-red-500)",
}