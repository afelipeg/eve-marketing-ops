import { Badge } from "@/components/reui/badge"
import { cn } from "cn"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent } from "@/components/ui/card"

import { ChartTooltip } from "./chart-tooltip"
import { activeThreats, clusterLoadSummary, loadDistribution } from "./data"
import { PanelCorners, PanelHeading } from "./panel-heading"
import { loadStateColor, toneStyles } from "./tone-styles"

const chartGridProps = {
  vertical: false,
  stroke: "var(--border)",
  strokeDasharray: "3 3",
  strokeOpacity: 0.75,
}

export function LoadPanel() {
  return (
    <Card className="relative h-full overflow-hidden p-0">
      <PanelCorners />
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm leading-4 font-semibold">Cluster Load</h2>
            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs leading-4">
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full bg-zinc-300"
                  aria-hidden="true"
                />
                Normal
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full bg-amber-500"
                  aria-hidden="true"
                />
                Warm
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full bg-red-500"
                  aria-hidden="true"
                />
                Critical
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {clusterLoadSummary.details.map((detail) => (
              <Badge
                key={detail.label}
                variant={detail.variant}
                radius="full"
                className="h-6 gap-1.5 px-2 text-xs"
              >
                <span className="font-semibold tabular-nums">
                  {detail.value}
                </span>
                <span>{detail.label}</span>
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-auto h-60 pt-5">
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 640, height: 240 }}
          >
            <BarChart
              accessibilityLayer
              data={loadDistribution}
              margin={{ top: 10, right: 0, bottom: 0, left: 0 }}
              barCategoryGap={2}
            >
              <CartesianGrid {...chartGridProps} />
              <XAxis
                dataKey="node"
                axisLine={false}
                interval={25}
                tickLine={false}
                tickMargin={10}
                tick={{ fontSize: 10 }}
              />
              <YAxis hide domain={[0, 100]} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                content={({ active, payload, label }) => (
                  <ChartTooltip
                    active={active}
                    payload={payload}
                    label={label}
                  />
                )}
              />
              <Bar
                dataKey="load"
                name="Load"
                radius={[5, 5, 5, 5]}
                isAnimationActive={false}
              >
                {loadDistribution.map((entry) => (
                  <Cell
                    key={entry.node}
                    fill={loadStateColor[entry.state]}
                    opacity={entry.state === "nominal" ? 0.62 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function ActiveThreatsPanel() {
  return (
    <Card className="relative overflow-hidden p-0">
      <PanelCorners />
      <CardContent className="space-y-5 p-4">
        <PanelHeading title="Active Lanes" description="Threat Queue" />

        <div className="space-y-4">
          {activeThreats.map((threat) => {
            const tone = toneStyles[threat.tone]

            return (
              <div key={threat.id} className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn("size-2 shrink-0 rounded-full", tone.dot)}
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm font-medium">
                        [{threat.id}] {threat.label}
                      </span>
                    </div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                      <span>{threat.source}</span>
                      <span
                        aria-hidden="true"
                        className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
                      />
                      <span>{threat.state}</span>
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold tabular-nums">
                    {threat.value.toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-muted h-1.5 min-w-0 flex-1 overflow-hidden rounded-full">
                    <div
                      className={cn("h-full rounded-full", tone.bar)}
                      style={{ width: `${threat.progress}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-8 text-right text-[10px] leading-none tabular-nums">
                    {threat.progress}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
