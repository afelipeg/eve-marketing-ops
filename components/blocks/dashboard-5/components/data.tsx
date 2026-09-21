import { type ComponentProps } from "react"
import { Badge } from "@/components/reui/badge"

export type MetricTone = "danger" | "success" | "warning" | "info"

export type MetricCard = {
  id: string
  title: string
  label: string
  value: string
  delta: string
  deltaVariant: ComponentProps<typeof Badge>["variant"]
  detail: string
  tone: MetricTone
  sparkline: number[]
}

export const metricCards: MetricCard[] = [
  {
    id: "signal-risk",
    title: "Signal Risk",
    label: "Threat Index",
    value: "Elevated",
    delta: "+12.5%",
    deltaVariant: "destructive-light",
    detail: "5 cases",
    tone: "danger",
    sparkline: [18, 21, 15, 33, 29, 35, 28, 31, 19],
  },
  {
    id: "mesh-uptime",
    title: "Mesh Uptime",
    label: "Service Health",
    value: "99.98%",
    delta: "+0.2%",
    deltaVariant: "success-light",
    detail: "58 zones",
    tone: "success",
    sparkline: [42, 40, 42, 38, 39, 41, 40, 43, 46],
  },
  {
    id: "edge-traffic",
    title: "Edge Traffic",
    label: "Scrubbed Load",
    value: "4.8 GB/s",
    delta: "-3.1%",
    deltaVariant: "warning-light",
    detail: "clean flow",
    tone: "warning",
    sparkline: [21, 27, 28, 34, 32, 35, 33, 31, 34],
  },
  {
    id: "sensor-reach",
    title: "Sensor Reach",
    label: "Global Nodes",
    value: "18,420",
    delta: "+6.8%",
    deltaVariant: "success-light",
    detail: "93 regions",
    tone: "success",
    sparkline: [25, 23, 29, 28, 26, 31, 27, 30, 29],
  },
]

export const threatVectors = [
  { name: "Bot", blocked: 34, watched: 62 },
  { name: "Phish", blocked: 30, watched: 74 },
  { name: "DDoS", blocked: 52, watched: 33 },
  { name: "Inject", blocked: 22, watched: 48 },
  { name: "Auth", blocked: 43, watched: 68 },
  { name: "Probe", blocked: 18, watched: 58 },
  { name: "Exfil", blocked: 56, watched: 35 },
  { name: "Beacon", blocked: 38, watched: 64 },
  { name: "Day0", blocked: 14, watched: 28 },
]

export const networkFlow = [
  { month: "January", api: 1820, webhook: 1640 },
  { month: "February", api: 2340, webhook: 2160 },
  { month: "March", api: 1960, webhook: 1880 },
  { month: "April", api: 2780, webhook: 2540 },
  { month: "May", api: 2100, webhook: 1920 },
  { month: "June", api: 3120, webhook: 2880 },
  { month: "July", api: 2540, webhook: 2320 },
  { month: "August", api: 3480, webhook: 3160 },
  { month: "September", api: 2860, webhook: 2580 },
  { month: "October", api: 2420, webhook: 2140 },
  { month: "November", api: 3240, webhook: 2960 },
  { month: "December", api: 2680, webhook: 2440 },
]

export const networkFlowSummary = {
  change: "+12.8%",
  year: "2026",
}

const loadSamples = [
  72, 68, 22, 18, 61, 71, 20, 26, 31, 70, 46, 88, 39, 25, 12, 33, 18, 28, 42,
  36, 61, 68, 74, 70, 91, 32, 82, 66, 52, 76, 48, 35, 70, 62, 57, 49, 37, 58,
  71, 7, 11, 69, 34, 28, 40, 61, 17, 55, 64, 19, 63, 67,
] as const

export type LoadState = "nominal" | "warm" | "critical"

export type LoadPoint = {
  node: string
  load: number
  state: LoadState
}

export const loadDistribution: LoadPoint[] = loadSamples.map((load, index) => ({
  node: `N${String(index).padStart(2, "0")}`,
  load,
  state: load >= 86 ? "critical" : load >= 76 ? "warm" : "nominal",
}))

const loadStateTotals = loadDistribution.reduce<Record<LoadState, number>>(
  (totals, point) => ({
    ...totals,
    [point.state]: totals[point.state] + 1,
  }),
  {
    nominal: 0,
    warm: 0,
    critical: 0,
  }
)

export const clusterLoadSummary = {
  details: [
    {
      label: "Nodes",
      value: String(loadDistribution.length),
      variant: "secondary",
    },
    {
      label: "Warm",
      value: String(loadStateTotals.warm),
      variant: "warning-light",
    },
    {
      label: "Critical",
      value: String(loadStateTotals.critical),
      variant: "destructive-light",
    },
  ],
} satisfies {
  details: Array<{
    label: string
    value: string
    variant: ComponentProps<typeof Badge>["variant"]
  }>
}

export const activeThreats = [
  {
    id: "00",
    label: "API Flood",
    source: "Edge WAF",
    state: "Mitigating",
    value: 4521,
    progress: 92,
    tone: "danger",
  },
  {
    id: "01",
    label: "Mail Spoof",
    source: "Mail Relay",
    state: "Reviewing",
    value: 3102,
    progress: 64,
    tone: "warning",
  },
  {
    id: "02",
    label: "Cloud Probe",
    source: "Cloud API",
    state: "Queued",
    value: 1250,
    progress: 26,
    tone: "info",
  },
  {
    id: "03",
    label: "Mesh Beacon",
    source: "Int Node",
    state: "Watching",
    value: 420,
    progress: 9,
    tone: "success",
  },
] satisfies Array<{
  id: string
  label: string
  source: string
  state: string
  value: number
  progress: number
  tone: MetricTone
}>