"use client"

import * as React from "react"
import { useId } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame"
import { DataGrid } from "@/components/reui/data-grid/data-grid"
import { Timeline, TimelineItem } from "@/components/reui/timeline"
import { Tree } from "@/components/reui/tree"
import {
  Activity,
  Cpu,
  GitBranch,
  Plug,
  ServerCog,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Brain,
  Scale,
  FileText,
  Users,
  Eye,
  ChevronDown,
  Brain as BrainIcon,
  Scale as ScaleIcon,
  CheckCircle2 as CheckCircleIcon,
  AlertCircle,
} from "lucide-react"
import type { ValidationOutput } from "@/subagents/validation/schemas/output"

interface AgentNode {
  id: string
  name: string
  type: "orchestrator" | "service" | "validation" | "measurement"
  status: "idle" | "running" | "completed" | "failed" | "pending"
  delegate?: string
  children?: AgentNode[]
}

interface RightSidebarProps {
  className?: string
  isOpen?: boolean
  onClose?: () => void
  activeTab?: "activity" | "jev" | "moat" | "directives"
  onTabChange?: (tab: string) => void
}

export function RightSidebar({
  className,
  isOpen = true,
  onClose,
  activeTab = "activity",
  onTabChange,
}: RightSidebarProps) {
  const panelId = useId()

  // Mock data for agent flow
  const agentFlow: AgentNode[] = [
    {
      id: "orchestrator",
      name: "Orchestrator",
      type: "orchestrator",
      status: "completed",
      children: [
        {
          id: "promotions",
          name: "Promotions",
          type: "service",
          status: "completed",
          delegate: "promotions",
        },
        {
          id: "advertisements",
          name: "Advertisements",
          type: "service",
          status: "completed",
          delegate: "advertisements",
        },
        {
          id: "recommendations",
          name: "Recommendations",
          type: "service",
          status: "running",
          delegate: "recommendations",
        },
        {
          id: "pricing",
          name: "Pricing",
          type: "service",
          status: "pending",
          delegate: "pricing",
        },
        {
          id: "validation",
          name: "JEV Validation",
          type: "validation",
          status: "pending",
        },
        {
          id: "measurement",
          name: "Measurement",
          type: "measurement",
          status: "pending",
        },
      ],
    },
  ]

  // Mock JEV validations
  const jevValidations: ValidationOutput[] = [
    {
      directive: "EXECUTE",
      confidence: 0.92,
      checks: {
        significance: { pass: true, reasoning: "CI excludes 0", evidence: "uplift 8.7% > MDE 5.2%" },
        guardrails: { pass: true, reasoning: "All guardrails met", evidence: "discount 15% < 20% max" },
        economics: { pass: true, reasoning: "ROI 2.3x", evidence: "margin $187k > cost $145k" },
        measurement: { pass: true, reasoning: "Clean holdout", evidence: "randomized, n=41.5k" },
      },
      directives: [
        { team: "growth", task: "Launch promotion variant", deadline: "2026-09-22", evidence: "validation passed", owner: "Promotions Lead", priority: "P1-this-week" },
      ],
      kpisToWatch: [{ kpi: "uplift_pct", currentValue: 8.7, threshold: 5.2, direction: "above" }],
      blockers: [],
      validatedAt: "2026-09-19T14:32:11Z",
      validatedBy: "jev",
      schemaVersion: "1.0",
    },
    {
      directive: "REBRIEF",
      confidence: 0.87,
      checks: {
        significance: { pass: false, reasoning: "CI includes 0", evidence: "uplift 1.2% < MDE 3.5%" },
        guardrails: { pass: true, reasoning: "Guardrails met", evidence: "" },
        economics: { pass: false, reasoning: "ROI negative", evidence: "cost $88k > margin $42k" },
        measurement: { pass: true, reasoning: "Valid design", evidence: "geo-holdout" },
      },
      directives: [
        { team: "creative", task: "Redesign creative", deadline: "2026-09-25", evidence: "low uplift", owner: "Creative Director", priority: "P0-blocker" },
      ],
      kpisToWatch: [],
      blockers: [{ blocker: "Creative fatigue detected", impact: "Low engagement", resolutionOwner: "Creative Director", resolutionDeadline: "2026-09-23" }],
      validatedAt: "2026-09-19T10:15:00Z",
      validatedBy: "jev",
      schemaVersion: "1.0",
    },
  ]

  // Mock MOAT learnings
  const moatLearnings = [
    { pattern: "promotions: discount>20% on Andina beverages → sleeping dogs >10%", delegate: "promotions", confidence: 0.85, timesObserved: 3 },
    { pattern: "advertisements: viewability<50% → measurement invalid", delegate: "advertisements", confidence: 0.92, timesObserved: 5 },
    { pattern: "pricing: psychological threshold breach → automatic ESCALATE", delegate: "pricing", confidence: 0.98, timesObserved: 2 },
  ]

  // Mock directives
  const teamDirectives = [
    { team: "growth", task: "Launch promotion variant", deadline: "2026-09-22", evidence: "validation passed", owner: "Promotions Lead", priority: "P1-this-week" as const },
    { team: "creative", task: "Redesign creative for promotions", deadline: "2026-09-25", evidence: "low uplift", owner: "Creative Director", priority: "P0-blocker" as const },
    { team: "data", task: "Refresh propensity model", deadline: "2026-09-24", evidence: "model stale", owner: "ML Engineer", priority: "P1-this-week" as const },
    { team: "media", task: "Increase viewability targeting", deadline: "2026-09-26", evidence: "viewability 42%", owner: "Media Buyer", priority: "P2-this-sprint" as const },
  ]

  const tabs = [
    { id: "activity", label: "Activity", icon: Activity },
    { id: "jev", label: "JEV Validations", icon: Brain },
    { id: "moat", label: "MOAT Learning", icon: Scale },
    { id: "directives", label: "Directives", icon: CheckCircle2 },
  ] as const

  if (!isOpen) return null

  return (
    <aside
      className={cn(
        "desktop-context border-l border-border bg-card",
        className
      )}
      aria-label="Agent flow & validation context"
    >
      <div className="context-inner flex flex-col h-full">
        {/* Header */}
        <div className="context-heading flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Agent Flow & Validation</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">LIVE</span>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="context-tabs border-b border-border px-4" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${panelId}-panel-${tab.id}`}
              id={`${panelId}-tab-${tab.id}`}
              onClick={() => onTabChange?.(tab.id)}
              className={cn(
                "flex items-center gap-2 px-2 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="context-content flex-1 overflow-auto p-4" role="tabpanel">
          {activeTab === "activity" && <ActivityTab agentFlow={agentFlow} />}
          {activeTab === "jev" && <JEVTab validations={jevValidations} />}
          {activeTab === "moat" && <MOATTab learnings={moatLearnings} />}
          {activeTab === "directives" && <DirectivesTab directives={teamDirectives} />}
        </div>
      </div>
    </aside>
  )
}

// --- Activity Tab ---
function ActivityTab({ agentFlow }: { agentFlow: AgentNode[] }) {
  return (
    <div className="space-y-4">
      {/* Agent Flow Tree using Cascader */}
      <Frame className="runtime-card">
        <FrameHeader>
          <FrameTitle>
            <GitBranch className="h-4 w-4" />
            Agent Delegation Flow
          </FrameTitle>
          <Badge variant="secondary">3/6 active</Badge>
        </FrameHeader>
        <FramePanel className="p-2">
          <Tree
            items={agentFlow.map(toTreeItem)}
            onSelectionChange={(selection) => console.log(selection)}
            renderItem={(item, { isSelected, isExpanded, depth }) => (
              <div
                className={cn(
                  "flex items-center gap-2 py-1.5 px-2 rounded",
                  isSelected && "bg-primary/10",
                  depth > 0 && "pl-4"
                )}
              >
                {item.children && (
                  <ChevronDown
                    className={cn("h-3 w-3 text-muted-foreground transition-transform", isExpanded && "rotate-180")}
                  />
                )}
                <StatusDot status={item.status} />
                <span className="text-sm font-medium">{item.name}</span>
                {item.delegate && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    {item.delegate}
                  </Badge>
                )}
              </div>
            )}
          />
        </FramePanel>
      </Frame>

      {/* Runtime Status */}
      <Frame className="runtime-card">
        <FrameHeader>
          <FrameTitle>
            <Cpu className="h-4 w-4" />
            Runtime EVE
          </FrameTitle>
          <Badge variant="success">Healthy</Badge>
        </FrameHeader>
        <FramePanel>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Turns</span>
              <div className="font-semibold">3</div>
            </div>
            <div>
              <span className="text-muted-foreground">Tools</span>
              <div className="font-semibold">12</div>
            </div>
            <div>
              <span className="text-muted-foreground">Subagents</span>
              <div className="font-semibold">4</div>
            </div>
            <div>
              <span className="text-muted-foreground">Duration</span>
              <div className="font-semibold">2.3s</div>
            </div>
          </div>
        </FramePanel>
      </Frame>
    </div>
  )
}

// --- JEV Tab ---
function JEVTab({ validations }: { validations: ValidationOutput[] }) {
  return (
    <div className="space-y-4">
      {validations.map((v, i) => (
        <Frame key={i} className="runtime-card">
          <FrameHeader>
            <FrameTitle>
              <Brain className="h-4 w-4" />
              JEV Validation #{i + 1}
            </FrameTitle>
            <Badge variant={directiveVariant(v.directive)}>
              {v.directive}
            </Badge>
          </FrameHeader>
          <FramePanel className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-semibold">{Math.round(v.confidence * 100)}%</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(v.checks).map(([key, check]) => (
                <div
                  key={key}
                  className={cn(
                    "p-2 rounded text-sm",
                    check.pass ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{key}</span>
                    <Badge variant={check.pass ? "success" : "destructive"}>
                      {check.pass ? "PASS" : "FAIL"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{check.reasoning}</p>
                </div>
              ))}
            </div>
            {v.directives.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Directives</h4>
                {v.directives.map((d, j) => (
                  <div key={j} className="p-2 bg-muted/50 rounded text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{d.team}</span>
                      <Badge variant={priorityVariant(d.priority)}>{d.priority}</Badge>
                    </div>
                    <p className="text-muted-foreground">{d.task}</p>
                  </div>
                ))}
              </div>
            )}
            {v.blockers.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <h4 className="text-sm font-semibold text-destructive">Blockers</h4>
                {v.blockers.map((b, j) => (
                  <div key={j} className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                    <p className="font-medium">{b.blocker}</p>
                    <p className="text-muted-foreground">{b.impact}</p>
                  </div>
                ))}
              </div>
            )}
          </FramePanel>
        </Frame>
      ))}
    </div>
  )
}

// --- MOAT Tab ---
function MOATTab({ learnings }: { learnings: Array<{ pattern: string; delegate: string; confidence: number; timesObserved: number }> }) {
  return (
    <div className="space-y-4">
      <Frame className="runtime-card">
        <FrameHeader>
          <FrameTitle>
            <Scale className="h-4 w-4" />
            Learned Patterns
          </FrameTitle>
          <Badge variant="secondary">{learnings.length} patterns</Badge>
        </FrameHeader>
        <FramePanel>
          <ul className="space-y-3">
            {learnings.map((l, i) => (
              <li key={i} className="p-3 bg-muted/50 rounded border border-border">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-foreground">{l.pattern}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs">{l.delegate}</Badge>
                    <Badge variant="secondary" className="text-xs">{Math.round(l.confidence * 100)}%</Badge>
                    <span className="text-xs text-muted-foreground">×{l.timesObserved}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </FramePanel>
      </Frame>
    </div>
  )
}

// --- Directives Tab ---
function DirectivesTab({ directives }: { directives: Array<{ team: string; task: string; deadline: string; evidence: string; owner: string; priority: "P0-blocker" | "P1-this-week" | "P2-this-sprint" | "P3-backlog" }> }) {
  return (
    <div className="space-y-4">
      <Frame className="runtime-card">
        <FrameHeader>
          <FrameTitle>
            <CheckCircle2 className="h-4 w-4" />
            Team Directives
          </FrameTitle>
          <Badge variant="secondary">{directives.length} active</Badge>
        </FrameHeader>
        <FramePanel>
          <DataGrid
            columns={[
              { id: "team", header: "Team", accessorKey: "team", cell: ({ getValue }) => <Badge variant="outline">{String(getValue())}</Badge> },
              { id: "task", header: "Task", accessorKey: "task" },
              { id: "owner", header: "Owner", accessorKey: "owner" },
              { id: "deadline", header: "Deadline", accessorKey: "deadline" },
              { id: "priority", header: "Priority", accessorKey: "priority", cell: ({ getValue }) => <Badge variant={priorityVariant(String(getValue()))}>{String(getValue())}</Badge> },
            ]}
            data={directives}
          />
        </FramePanel>
      </Frame>
    </div>
  )
}

// --- Helpers ---
function toTreeItem(node: AgentNode) {
  return {
    id: node.id,
    label: node.name,
    value: node.id,
    children: node.children?.map(toTreeItem),
    disabled: node.status === "failed",
  }
}

function getStatusIcon(status: AgentNode["status"]) {
  switch (status) {
    case "completed": return <CheckCircle2 className="h-3 w-3 text-green-500" />
    case "running": return <Zap className="h-3 w-3 text-yellow-500 animate-pulse" />
    case "failed": return <AlertTriangle className="h-3 w-3 text-red-500" />
    case "pending": return <Clock className="h-3 w-3 text-muted-foreground" />
    default: return <Clock className="h-3 w-3 text-muted-foreground" />
  }
}

function StatusDot({ status }: { status: AgentNode["status"] }) {
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full",
        status === "completed" && "bg-green-500",
        status === "running" && "bg-yellow-500 animate-pulse",
        status === "failed" && "bg-red-500",
        status === "pending" && "bg-gray-400",
        status === "idle" && "bg-gray-300",
      )}
    />
  )
}

function directiveVariant(directive: ValidationOutput["directive"]) {
  switch (directive) {
    case "EXECUTE": return "success"
    case "REBRIEF": return "warning"
    case "ESCALATE": return "destructive"
    case "HOLD": return "outline"
    default: return "secondary"
  }
}

function priorityVariant(priority: string) {
  switch (priority) {
    case "P0-blocker": return "destructive"
    case "P1-this-week": return "warning"
    case "P2-this-sprint": return "info"
    case "P3-backlog": return "secondary"
    default: return "secondary"
  }
}

const NOTIFICATION_ICONS: Record<string, ReactNode> = {
  validation: (
    <Scale className="h-4 w-4" aria-hidden="true" />
  ),
  jev: (
    <Brain className="h-4 w-4" aria-hidden="true" />
  ),
  moat: (
    <Target className="h-4 w-4" aria-hidden="true" />
  ),
  directive: (
    <Zap className="h-4 w-4" aria-hidden="true" />
  ),
  measurement: (
    <BarChart3 className="h-4 w-4" aria-hidden="true" />
  ),
  guardrail: (
    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
  ),
}

const VARIANT_COLORS: Record<string, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
}