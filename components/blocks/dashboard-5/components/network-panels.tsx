import { Badge } from "@/components/reui/badge"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import { networkFlow, networkFlowSummary, threatVectors } from "./data"
import { PanelCorners, PanelHeading } from "./panel-heading"

const threatChartConfig = {
  blocked: {
    label: "Blocked",
    color: "var(--color-blue-600)",
  },
  watched: {
    label: "Watched",
    color: "var(--color-sky-300)",
  },
} satisfies ChartConfig

const flowChartConfig = {
  api: {
    label: "API Calls",
    color: "var(--color-yellow-500)",
  },
  webhook: {
    label: "Webhooks",
    color: "var(--color-emerald-500)",
  },
} satisfies ChartConfig

const chartGridProps = {
  vertical: false,
  stroke: "var(--border)",
  strokeDasharray: "3 3",
  strokeOpacity: 0.75,
}

function getChartColor(config: ChartConfig, name: string | number) {
  return config[String(name)]?.color
}

function getChartLabel(config: ChartConfig, name: string | number) {
  return config[String(name)]?.label ?? String(name)
}

function formatTooltipItem(
  config: ChartConfig,
  value: unknown,
  name: string | number
) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: getChartColor(config, name) }}
          aria-hidden="true"
        />
        <span className="text-muted-foreground">
          {getChartLabel(config, name)}
        </span>
      </div>
      <span className="text-foreground font-semibold tabular-nums">
        {Number(value ?? 0).toLocaleString()}
      </span>
    </div>
  )
}

function CrosshatchPattern({
  config,
  idPrefix,
}: {
  config: ChartConfig
  idPrefix: string
}) {
  const entries = Object.entries(config).filter(([, value]) => value.color)

  return (
    <>
      {entries.map(([key, { color }]) => (
        <pattern
          key={key}
          id={`${idPrefix}-${key}`}
          x="0"
          y="0"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <path d="M0,8 L8,0" stroke={color} strokeWidth="0.8" opacity="0.4" />
          <path d="M0,0 L8,8" stroke={color} strokeWidth="0.8" opacity="0.2" />
        </pattern>
      ))}
    </>
  )
}

export function ThreatVectorsPanel() {
  return (
    <Card className="relative overflow-hidden p-0">
      <PanelCorners />
      <CardContent className="flex flex-col gap-5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PanelHeading title="Threat Vectors" description="Blocked Signals" />
          <div className="text-muted-foreground flex shrink-0 flex-wrap items-center gap-4 text-xs sm:justify-end">
            <span className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full bg-blue-600"
                aria-hidden="true"
              />
              Blocked
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full bg-sky-300"
                aria-hidden="true"
              />
              Watched
            </span>
          </div>
        </div>

        <ChartContainer
          config={threatChartConfig}
          className="h-56 w-full min-w-0"
        >
          <BarChart
            accessibilityLayer
            data={threatVectors}
            margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
            barGap={3}
            barCategoryGap={8}
          >
            <defs>
              <pattern
                id="dashboard5-threat-blocked"
                patternUnits="userSpaceOnUse"
                width="8"
                height="8"
              >
                <rect
                  width="8"
                  height="8"
                  fill="var(--color-blocked)"
                  opacity="0.1"
                />
                <path
                  d="M0,8 L8,0 M4,12 L12,4 M-4,4 L4,-4"
                  stroke="var(--color-blocked)"
                  strokeWidth="1.5"
                  opacity="0.55"
                />
                <path
                  d="M2,10 L10,2 M6,14 L14,6 M-2,6 L6,-2"
                  stroke="var(--color-blocked)"
                  strokeWidth="1"
                  opacity="0.25"
                />
              </pattern>
            </defs>
            <CartesianGrid {...chartGridProps} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tick={{ fontSize: 10 }}
            />
            <YAxis hide domain={[0, 78]} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  className="min-w-36 gap-2"
                  labelFormatter={(value) => (
                    <div className="border-border/50 mb-0.5 border-b pb-2">
                      <span className="text-xs font-medium">{value}</span>
                    </div>
                  )}
                  formatter={(value, name) =>
                    formatTooltipItem(threatChartConfig, value, name ?? "value")
                  }
                />
              }
            />
            <Bar
              dataKey="blocked"
              fill="url(#dashboard5-threat-blocked)"
              stroke="var(--color-blocked)"
              strokeWidth={1}
              radius={[5, 5, 5, 5]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="watched"
              fill="var(--color-watched)"
              fillOpacity={0.86}
              stroke="var(--color-watched)"
              strokeWidth={1}
              radius={[5, 5, 5, 5]}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function NetworkFlowPanel() {
  return (
    <Card className="relative overflow-hidden p-0">
      <PanelCorners />
      <CardContent className="flex flex-col gap-5 p-4">
        <div className="flex items-start justify-between gap-3">
          <PanelHeading title="Network Flow" description="API and webhooks" />
          <Badge variant="success-light" radius="full">
            {networkFlowSummary.change}
          </Badge>
        </div>

        <ChartContainer
          config={flowChartConfig}
          className="h-56 w-full min-w-0"
        >
          <AreaChart
            accessibilityLayer
            data={networkFlow}
            margin={{ top: 20, right: 0, bottom: 0, left: 0 }}
          >
            <CartesianGrid {...chartGridProps} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => String(value).slice(0, 3)}
            />
            <YAxis hide />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  className="min-w-40 gap-2.5"
                  labelFormatter={(value) => (
                    <div className="border-border/50 mb-0.5 border-b pb-2">
                      <span className="text-xs font-medium">
                        {value} {networkFlowSummary.year}
                      </span>
                    </div>
                  )}
                  formatter={(value, name) =>
                    formatTooltipItem(flowChartConfig, value, name ?? "value")
                  }
                />
              }
            />
            <defs>
              <CrosshatchPattern
                config={flowChartConfig}
                idPrefix="dashboard5-flow-crosshatch"
              />
            </defs>
            <Area
              dataKey="webhook"
              type="natural"
              fill="url(#dashboard5-flow-crosshatch-webhook)"
              fillOpacity={0.5}
              stroke="var(--color-webhook)"
              stackId="a"
              strokeWidth={1.25}
              isAnimationActive={false}
            />
            <Area
              dataKey="api"
              type="natural"
              fill="url(#dashboard5-flow-crosshatch-api)"
              fillOpacity={0.5}
              stroke="var(--color-api)"
              stackId="a"
              strokeWidth={1.25}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
