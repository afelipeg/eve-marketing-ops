"use client"

import { metricCards } from "./data"
import { ActiveThreatsPanel, LoadPanel } from "./load-panels"
import { MetricTile } from "./metric-tile"
import { Navbar } from "./navbar"
import { NetworkFlowPanel, ThreatVectorsPanel } from "./network-panels"

/**
 * Dense edge security dashboard inspired by a telemetry wall.
 * The main entry only owns section order; records and panel details stay
 * in focused local files so the block remains easy to adapt.
 */
export function SecurityDashboard() {
  return (
    <div className="text-foreground @container mx-auto flex w-full max-w-7xl flex-col gap-4">
      <h1 id="page-heading" className="sr-only">
        Edge Security Telemetry
      </h1>

      <Navbar />

      <section
        aria-label="Security Summary"
        className="grid grid-cols-1 gap-4 @3xl:grid-cols-2 @6xl:grid-cols-4"
      >
        {metricCards.map((metric) => (
          <MetricTile key={metric.id} metric={metric} />
        ))}
      </section>

      <section
        aria-label="Security Flow"
        className="grid grid-cols-1 gap-4 @5xl:grid-cols-2"
      >
        <ThreatVectorsPanel />
        <NetworkFlowPanel />
      </section>

      <section
        aria-label="Security Load"
        className="grid grid-cols-1 gap-4 @5xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]"
      >
        <LoadPanel />
        <ActiveThreatsPanel />
      </section>
    </div>
  )
}