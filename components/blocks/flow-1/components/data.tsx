import type { BadgeProps } from "@/components/reui/badge"
import type { Edge, Node } from "@xyflow/react"
import { CheckIcon, TriangleAlertIcon, WebhookIcon, GitBranchIcon, DatabaseIcon, MailIcon, ClockIcon, ZapIcon, CircleCheckIcon, CircleXIcon, LoaderCircleIcon, MinusIcon, CircleDotIcon } from "lucide-react"

/** Typed toast icons, so feedback carries semantic colour and not only text. */
export const TOAST_SUCCESS_ICON = (
  <CheckIcon className="text-success size-4" aria-hidden="true" />
)

export const TOAST_ERROR_ICON = (
  <TriangleAlertIcon className="text-destructive size-4" aria-hidden="true" />
)

export type StepKind = "trigger" | "condition" | "action"

export type StepCategory =
  "webhook" | "condition" | "data" | "email" | "delay" | "action"

export const CATEGORY_LABEL: Record<StepCategory, string> = {
  webhook: "Webhook",
  condition: "Condition",
  data: "Data",
  email: "Email",
  delay: "Delay",
  action: "Action",
}

/** One glyph per category, so picking a category is what sets the tile. */
export const CATEGORY_ICON: Record<StepCategory, React.ReactNode> = {
  webhook: (
    <WebhookIcon aria-hidden="true" />
  ),
  condition: (
    <GitBranchIcon aria-hidden="true" />
  ),
  data: (
    <DatabaseIcon aria-hidden="true" />
  ),
  email: (
    <MailIcon aria-hidden="true" />
  ),
  delay: (
    <ClockIcon aria-hidden="true" />
  ),
  action: (
    <ZapIcon aria-hidden="true" />
  ),
}

export const STEP_CATEGORIES = Object.keys(CATEGORY_LABEL) as StepCategory[]

export type StepStatus = "succeeded" | "failed" | "running" | "skipped" | "idle"

export type StepOwner = {
  id: string
  name: string
  initials: string
  avatar: string
}

export type StepNodeData = {
  kind: StepKind
  category: StepCategory
  title: string
  detail: string
  /** How this step ended on the last run. */
  status: StepStatus
  duration: string
  owner: StepOwner
}

export const KIND_LABEL: Record<StepKind, string> = {
  trigger: "Trigger",
  condition: "Condition",
  action: "Action",
}

export const STATUS_LABEL: Record<StepStatus, string> = {
  succeeded: "Success",
  failed: "Failed",
  running: "Running",
  skipped: "Skipped",
  idle: "Idle",
}

/** Semantic badge per status; the panel and the node read the same fact. */
export const STATUS_BADGE: Record<StepStatus, BadgeProps["variant"]> = {
  succeeded: "success-light",
  failed: "destructive-light",
  running: "info-light",
  skipped: "outline",
  idle: "outline",
}

/** Shape carries the status too, so it never rests on colour alone. */
export const STATUS_ICON: Record<StepStatus, React.ReactNode> = {
  succeeded: (
    <CircleCheckIcon aria-hidden="true" />
  ),
  failed: (
    <CircleXIcon aria-hidden="true" />
  ),
  running: (
    <LoaderCircleIcon aria-hidden="true" />
  ),
  skipped: (
    <MinusIcon aria-hidden="true" />
  ),
  idle: (
    <CircleDotIcon aria-hidden="true" />
  ),
}

const EVE: StepOwner = {
  id: "eve",
  name: "EVE Orchestrator",
  initials: "EV",
  avatar: "",
}

const PROMOTIONS: StepOwner = {
  id: "promotions",
  name: "Promotions Agent",
  initials: "PR",
  avatar: "",
}

const ADVERTISEMENTS: StepOwner = {
  id: "advertisements",
  name: "Advertisements Agent",
  initials: "AD",
  avatar: "",
}

const RECOMMENDATIONS: StepOwner = {
  id: "recommendations",
  name: "Recommendations Agent",
  initials: "RC",
  avatar: "",
}

const PRICING: StepOwner = {
  id: "pricing",
  name: "Pricing Agent",
  initials: "PX",
  avatar: "",
}

const MEASUREMENT: StepOwner = {
  id: "measurement",
  name: "Measurement Agent",
  initials: "MS",
  avatar: "",
}

const VALIDATION: StepOwner = {
  id: "validation",
  name: "Validation + JEV",
  initials: "JV",
  avatar: "",
}

/** The people a step can be handed to; the edit form picks from these. */
export const STEP_OWNERS: StepOwner[] = [
  EVE,
  PROMOTIONS,
  ADVERTISEMENTS,
  RECOMMENDATIONS,
  PRICING,
  MEASUREMENT,
  VALIDATION,
]

export type StepNodeType = Node<StepNodeData, "step">

export const WORKFLOW = {
  id: "wf_8k2m4p",
  name: "Marketing Decision Run",
  lastRun: "vercel prototype runtime",
  section: "EVE Workflows",
  edited: "live",
  editor: EVE,
}

// Mirrors the CanvasToolbar keydown handler and the canvas deleteKeyCode;
// "mod" and "shift" print the platform's own glyph.
export const SHORTCUTS: { label: string; keys: string[] }[] = [
  { label: "Select", keys: ["V"] },
  { label: "Pan", keys: ["H"] },
  { label: "Zoom in", keys: ["+"] },
  { label: "Zoom out", keys: ["-"] },
  { label: "Zoom to fit", keys: ["shift", "1"] },
  { label: "Actual size", keys: ["shift", "0"] },
  { label: "Undo", keys: ["mod", "Z"] },
  { label: "Redo", keys: ["mod", "shift", "Z"] },
  { label: "Delete step", keys: ["Backspace"] },
]

// customize: replace with your own automation steps.
export const INITIAL_NODES: StepNodeType[] = [
  {
    id: "trigger",
    type: "step",
    // The engine checks this before anything else, so no path drops the entry
    // point: not the toolbar, not Backspace, not Select all steps.
    deletable: false,
    position: { x: 0, y: 160 },
    data: {
      kind: "trigger",
      title: "EVE Orchestrator",
      detail: "Claude Sonnet 5 · Vercel AI Gateway",
      category: "webhook",
      status: "succeeded",
      duration: "awaiting run",
      owner: EVE,
    },
  },
  {
    id: "filter",
    type: "step",
    position: { x: 300, y: 160 },
    data: {
      kind: "condition",
      title: "Contract Router",
      detail: "Zod guards · approval boundaries",
      category: "condition",
      status: "succeeded",
      duration: "awaiting run",
      owner: EVE,
    },
  },
  {
    id: "promotions",
    type: "step",
    position: { x: 600, y: 0 },
    data: {
      kind: "action",
      title: "Promotions",
      detail: "Uplift targeting · holdouts · ROI",
      category: "email",
      status: "idle",
      duration: "awaiting delegation",
      owner: PROMOTIONS,
    },
  },
  {
    id: "advertisements",
    type: "step",
    position: { x: 600, y: 150 },
    data: {
      kind: "action",
      title: "Advertisements",
      detail: "RTB · pacing · fraud · attribution",
      category: "action",
      status: "idle",
      duration: "awaiting delegation",
      owner: ADVERTISEMENTS,
    },
  },
  {
    id: "recommendations",
    type: "step",
    position: { x: 600, y: 300 },
    data: {
      kind: "action",
      title: "Recommendations",
      detail: "SVD++ · hybrid ranking · diversity",
      category: "data",
      status: "idle",
      duration: "awaiting delegation",
      owner: RECOMMENDATIONS,
    },
  },
  {
    id: "pricing",
    type: "step",
    position: { x: 600, y: 450 },
    data: {
      kind: "action",
      title: "Pricing",
      detail: "Elasticity · bundles · markdowns",
      category: "action",
      status: "idle",
      duration: "awaiting delegation",
      owner: PRICING,
    },
  },
  {
    id: "measurement",
    type: "step",
    position: { x: 900, y: 225 },
    data: {
      kind: "action",
      title: "Measurement",
      detail: "Uplift · evidence · significance",
      category: "data",
      status: "idle",
      duration: "awaiting evidence",
      owner: MEASUREMENT,
    },
  },
  {
    id: "validation",
    type: "step",
    position: { x: 1200, y: 225 },
    data: {
      kind: "action",
      title: "Validation + JEV",
      detail: "Typed verdict · operator approval",
      category: "condition",
      status: "idle",
      duration: "awaiting validation",
      owner: VALIDATION,
    },
  },
]

// New steps land as a plain action; the buyer swaps the kind and icon here.
export function createStep(
  id: string,
  position: { x: number; y: number }
): StepNodeType {
  return {
    id,
    type: "step",
    position,
    className: "group/node",
    data: {
      kind: "action",
      title: "New step",
      detail: "Not configured yet",
      category: "action",
      status: "idle",
      duration: "Not run",
      owner: EVE,
    },
  }
}

// Every edge takes the "labeled" type so one path style covers the graph. The
// animated ones trace the enterprise route, the branch nobody has to inspect.
export const INITIAL_EDGES: Edge[] = [
  {
    id: "trigger-filter",
    source: "trigger",
    target: "filter",
    type: "labeled",
    animated: true,
  },
  {
    id: "filter-promotions",
    source: "filter",
    target: "promotions",
    type: "labeled",
    animated: true,
    label: "promote",
  },
  {
    id: "filter-advertisements",
    source: "filter",
    target: "advertisements",
    type: "labeled",
    animated: true,
    label: "advertise",
  },
  {
    id: "filter-recommendations",
    source: "filter",
    target: "recommendations",
    type: "labeled",
    animated: true,
    label: "recommend",
  },
  {
    id: "filter-pricing",
    source: "filter",
    target: "pricing",
    type: "labeled",
    animated: true,
    label: "price",
  },
  ...["promotions", "advertisements", "recommendations", "pricing"].map(
    (source) => ({
      id: `${source}-measurement`,
      source,
      target: "measurement",
      type: "labeled",
      animated: true,
    }),
  ),
  {
    id: "measurement-validation",
    source: "measurement",
    target: "validation",
    type: "labeled",
    animated: true,
    label: "evidence",
  },
]
