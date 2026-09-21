"use client"

import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"

import { Progress } from "@/components/ui/progress"
import { SidebarGroup } from "@/components/ui/sidebar"

const BUDGET_USAGE = {
  used: 425000,
  total: 660000,
  label: "Q3 Budget",
  resetLabel: "Consumption and balance reset at quarter end",
} as const

export function SpendingLimit() {
  const pct = Math.round((BUDGET_USAGE.used / BUDGET_USAGE.total) * 100)
  const freePct = 100 - pct

  return (
    <SidebarGroup className="overflow-hidden group-data-[collapsible=icon]:hidden">
      <div className="group/card mt-5 overflow-hidden">
        <Frame
          spacing="xs"
          dense
          className="border-border shrink-0 border md:w-[240px]"
        >
          <FrameHeader>
            <FrameTitle className="text-warning text-xs">
              {BUDGET_USAGE.label}
            </FrameTitle>
          </FrameHeader>
          <FramePanel className="space-y-2">
            <p className="text-muted-foreground text-xs leading-snug">
              {BUDGET_USAGE.resetLabel}
            </p>

            <div className="bg-muted/55 relative h-1.5 overflow-hidden rounded-sm">
              <div
                className="text-muted-foreground pointer-events-none absolute inset-0 opacity-20"
                aria-hidden="true"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(-45deg, currentColor 0, currentColor 1px, transparent 0, transparent 4px)",
                }}
              />
              <Progress
                value={pct}
                className="**:data-[slot=progress-indicator]:bg-primary absolute inset-0 gap-0 **:data-[slot=progress-indicator]:rounded-none **:data-[slot=progress-track]:h-full **:data-[slot=progress-track]:rounded-none **:data-[slot=progress-track]:bg-transparent"
              />
            </div>

            <div className="flex items-center justify-between text-xs leading-none">
              <div className="flex items-center gap-1">
                <span className="text-foreground font-semibold">{pct}%</span>
                <span className="text-muted-foreground">Used</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-foreground font-semibold">
                  {freePct}%
                </span>
                <span className="text-muted-foreground">Free</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs leading-none mt-2">
              <div className="flex items-center gap-1">
                <span className="text-foreground font-semibold">${(BUDGET_USAGE.used / 1000).toFixed(0)}k</span>
                <span className="text-muted-foreground">Used</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-foreground font-semibold">
                  ${(BUDGET_USAGE.total / 1000).toFixed(0)}k
                </span>
                <span className="text-muted-foreground">Total</span>
              </div>
            </div>
          </FramePanel>
        </Frame>
      </div>
    </SidebarGroup>
  )
}