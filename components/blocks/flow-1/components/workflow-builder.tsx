"use client"

/**
 * Lead Routing: a React Flow canvas whose steps carry their last run.
 * Swap INITIAL_NODES and INITIAL_EDGES in data.tsx for your own workflow.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import type { EveDynamicToolPart, EveMessage } from "eve/react"
import {
  addEdge,
  Panel,
  ReactFlowProvider,
  reconnectEdge,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type IsValidConnection,
  type NodeTypes,
  type OnBeforeDelete,
  type OnDelete,
  type OnMoveEnd,
} from "@xyflow/react"
import { toast } from "sonner"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CanvasToolbar, type CanvasTool } from "./canvas-toolbar"
import {
  INITIAL_EDGES,
  INITIAL_NODES,
  TOAST_ERROR_ICON,
  TOAST_SUCCESS_ICON,
  WORKFLOW,
  type StepNodeType,
} from "./data"
import { useDeleteConfirmation } from "./delete-confirmation"
import { FIT_VIEW_OPTIONS, FlowCanvas } from "./flow-canvas"
import { LabeledEdge } from "./flow-edge"
import { useFlowHistory } from "./flow-history"
import { FlowKeys } from "./flow-keys"
import {
  AddStepButton,
  StepActionsProvider,
  StepInspectorPanel,
} from "./step-actions"
import { StepNode } from "./step-node"
import { WorkflowMenu } from "./workflow-menu"
import { CheckIcon } from "lucide-react"

// Module scope: a new nodeTypes or edgeTypes object per render remounts
// every node and edge on the canvas.
const nodeTypes = { step: StepNode } satisfies NodeTypes
const edgeTypes = { labeled: LabeledEdge } satisfies EdgeTypes

// A step feeding itself is the one wiring the runtime can never satisfy.
const isValidConnection: IsValidConnection<Edge> = (connection) =>
  connection.source !== connection.target

// Matches the canvas dot spacing, so a snapped node lands on a visible dot.
const SNAP_GRID: [number, number] = [20, 20]

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`

// The kit's edge stroke is translucent, so a shared trunk darkened where two
// connections overlap; the same grey mixed into the page stays one solid color.
const EDGE_STROKE =
  "[--xy-edge-stroke:color-mix(in_oklab,var(--muted-foreground)_45%,var(--background))]"

// A drag updates node objects in place, so the canvas gets its own copies and
// these positions stay the pristine target Reset layout restores.
const HOME_POSITIONS = new Map(
  INITIAL_NODES.map((node) => [node.id, node.position])
)
// group/node lets the node paint a focus ring: the engine puts focus on its own
// wrapper and strips the outline, so the card below has to answer for it.
const INITIAL_LAYOUT: StepNodeType[] = INITIAL_NODES.map((node) => ({
  ...node,
  className: "group/node",
  position: { ...node.position },
}))

export function WorkflowBuilder({
  eventTypes = [],
  fitKey,
  messages = [],
}: {
  eventTypes?: readonly string[]
  fitKey?: unknown
  messages?: readonly EveMessage[]
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <ReactFlowProvider>
        <WorkflowEditor eventTypes={eventTypes} fitKey={fitKey} messages={messages} />
      </ReactFlowProvider>
    </TooltipProvider>
  )
}

function WorkflowEditor({
  eventTypes,
  fitKey,
  messages,
}: {
  eventTypes: readonly string[]
  fitKey?: unknown
  messages: readonly EveMessage[]
}) {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<StepNodeType>(INITIAL_LAYOUT)
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [locked, setLocked] = useState(false)
  // Opens in Pan, so a first drag explores the graph and never nudges a step.
  const [tool, setTool] = useState<CanvasTool>("hand")
  const [resetCount, setResetCount] = useState(0)
  const { fitView, setViewport } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const { onBeforeDelete, dialog } = useDeleteConfirmation()
  const {
    takeSnapshot,
    stageDrag,
    commitDrag,
    undo,
    redo,
    canUndo,
    canRedo,
    version,
  } = useFlowHistory({
    setNodes,
    setEdges,
  })
  // Update keeps the graph on screen as the saved version; editing back to it
  // through undo reads clean again, since dirty compares versions.
  const [savedVersion, setSavedVersion] = useState(0)
  const dirty = version !== savedVersion
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const counts = `${plural(nodes.length, "step")}, ${plural(edges.length, "connection")}`
  // Pan holds every step still, so a drag anywhere moves the view, never the graph.
  const editable = !locked && tool === "select"

  useEffect(() => {
    if (!nodesInitialized) return

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        void fitView(FIT_VIEW_OPTIONS)
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [fitKey, fitView, nodesInitialized])

  useEffect(() => {
    const tools = messages.flatMap((message) =>
      message.parts.filter((part) => part.type === "dynamic-tool"),
    )
    const hasRun = messages.length > 0 || eventTypes.length > 0
    const specialistIds = [
      "promotions",
      "advertisements",
      "recommendations",
      "pricing",
    ] as const

    setNodes((current) => current.map((node) => {
      if (node.id === "trigger") {
        return {
          ...node,
          data: {
            ...node.data,
            duration: `${eventTypes.length} Vercel events`,
            status: hasRun ? "succeeded" : "idle",
          },
        }
      }
      if (node.id === "filter") {
        return {
          ...node,
          data: {
            ...node.data,
            duration: `${messages.length} typed messages`,
            status: hasRun ? "succeeded" : "idle",
          },
        }
      }
      if (specialistIds.some((id) => id === node.id)) {
        const calls = tools.filter((part) => toolMatchesAgent(part, node.id))
        const latest = calls.at(-1)
        return {
          ...node,
          data: {
            ...node.data,
            duration: latest ? `${calls.length} call${calls.length === 1 ? "" : "s"} · ${latest.state}` : "awaiting delegation",
            status: latest ? toolPartStatus(latest) : "idle",
          },
        }
      }
      if (node.id === "measurement") {
        const calls = tools.filter((part) => toolMatchesAgent(part, "measurement"))
        const latest = calls.at(-1)
        return {
          ...node,
          data: {
            ...node.data,
            duration: latest ? `${calls.length} call${calls.length === 1 ? "" : "s"} · ${latest.state}` : "awaiting evidence",
            status: latest ? toolPartStatus(latest) : "idle",
          },
        }
      }
      if (node.id === "validation") {
        const calls = tools.filter((part) => toolMatchesAgent(part, "validation"))
        const latest = calls.at(-1)
        return {
          ...node,
          data: {
            ...node.data,
            duration: latest ? `${calls.length} call${calls.length === 1 ? "" : "s"} · ${latest.state}` : "awaiting validation",
            status: latest ? toolPartStatus(latest) : "idle",
          },
        }
      }
      return node
    }))
  }, [eventTypes, messages, setNodes])

  // Locking drops the selection, so no node toolbar or Backspace edits the graph.
  const changeLocked = useCallback(
    (next: boolean) => {
      if (next) {
        setNodes((current) =>
          current.map((node) => ({ ...node, selected: false }))
        )
        setEdges((current) =>
          current.map((edge) => ({ ...edge, selected: false }))
        )
      }

      setLocked(next)
    },
    [setEdges, setNodes]
  )

  // Fit centres the graph on half pixels, which smears every 1px horizontal
  // rule; each move lands on whole pixels so hairlines stay as crisp as borders.
  const snapViewport = useCallback<OnMoveEnd>(
    (_, viewport) => {
      const x = Math.round(viewport.x)
      const y = Math.round(viewport.y)

      if (x !== viewport.x || y !== viewport.y) {
        void setViewport({ x, y, zoom: viewport.zoom })
      }
    },
    [setViewport]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      takeSnapshot()
      setEdges((current) =>
        addEdge({ ...connection, type: "labeled" }, current)
      )
    },
    [setEdges, takeSnapshot]
  )

  const selectAllSteps = useCallback(() => {
    setNodes((current) => current.map((node) => ({ ...node, selected: true })))
  }, [setNodes])

  const copyAsJson = useCallback(() => {
    const graph = JSON.stringify({ nodes, edges }, null, 2)
    const summary = `${plural(nodes.length, "step")} and ${plural(edges.length, "connection")}.`

    // A denied clipboard permission is the common case, so the toast waits
    // for the write rather than claiming a copy that never happened.
    void navigator.clipboard
      .writeText(graph)
      .then(() =>
        toast.success("Workflow copied as JSON", {
          description: summary,
          icon: TOAST_SUCCESS_ICON,
        })
      )
      .catch(() =>
        toast.error("Clipboard blocked", {
          description: "Allow clipboard access, then copy again.",
          icon: TOAST_ERROR_ICON,
        })
      )
  }, [edges, nodes])

  // An edge end can be dragged onto another step, so wiring stays editable.
  const onReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      takeSnapshot()
      setEdges((current) => reconnectEdge(oldEdge, connection, current))
    },
    [setEdges, takeSnapshot]
  )

  // The prompt settles before the engine removes anything, so a confirmed
  // delete is recorded while the graph still holds what it removes.
  const confirmDelete = useCallback<OnBeforeDelete<StepNodeType, Edge>>(
    async (elements) => {
      // Backspace on an empty selection still asks; it must not cost the redo stack.
      if (elements.nodes.length === 0 && elements.edges.length === 0) {
        return false
      }

      const allowed = await onBeforeDelete(elements)

      if (allowed) {
        takeSnapshot()
      }

      return allowed
    },
    [onBeforeDelete, takeSnapshot]
  )

  // A toast keeps the handler it was built with, and undo is a new function on
  // every snapshot, so a captured one would rewind past the edit it belongs to.
  const undoRef = useRef(undo)

  useEffect(() => {
    undoRef.current = undo
  }, [undo])

  const undoLatest = useCallback(() => undoRef.current(), [])

  // Runs after the engine removed the elements, so the count it reports is what
  // actually left. Undo replays the snapshot confirmDelete just recorded.
  const announceDelete = useCallback<OnDelete<StepNodeType, Edge>>(
    ({ nodes: removed, edges: cut }) => {
      if (removed.length === 0) {
        return
      }

      toast.success(removed.length > 1 ? "Steps deleted" : "Step deleted", {
        description:
          removed.length > 1
            ? `${plural(removed.length, "step")} and ${plural(cut.length, "connection")}.`
            : removed[0].data.title,
        icon: TOAST_SUCCESS_ICON,
        action: { label: "Undo", onClick: undoLatest },
        duration: 8000,
      })
    },
    [undoLatest]
  )

  const resetLayout = useCallback(() => {
    // Every step already home means nothing to restore, so no edit is recorded.
    const moved = nodes.some((node) => {
      const home = HOME_POSITIONS.get(node.id)

      return (
        home !== undefined &&
        (home.x !== node.position.x || home.y !== node.position.y)
      )
    })

    if (moved) {
      takeSnapshot()
    }

    setNodes((current) =>
      current.map((node) => ({
        ...node,
        position: { ...(HOME_POSITIONS.get(node.id) ?? node.position) },
      }))
    )
    setResetCount((count) => count + 1)
  }, [nodes, setNodes, takeSnapshot])

  // Arrow keys move a selected step without a drag, so the move records here;
  // a held key repeats and counts once.
  const recordKeyMove = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        editable &&
        !event.repeat &&
        event.key.startsWith("Arrow") &&
        event.target instanceof Element &&
        event.target.closest(
          ".react-flow__node.selected, .react-flow__nodesselection-rect"
        )
      ) {
        takeSnapshot()
      }
    },
    [editable, takeSnapshot]
  )

  // Focus moves before the button disables itself, so it never drops to the page.
  const updateWorkflow = () => {
    menuTriggerRef.current?.focus()
    setSavedVersion(version)
    toast.success("Workflow updated", {
      description: `${plural(nodes.length, "step")} and ${plural(edges.length, "connection")}.`,
      icon: TOAST_SUCCESS_ICON,
    })
  }

  // fitView reads the store, so it has to run after the restored positions
  // commit rather than in the same handler that sets them.
  useEffect(() => {
    if (resetCount === 0) {
      return
    }

    fitView(FIT_VIEW_OPTIONS)
  }, [resetCount, fitView])

  return (
    <StepActionsProvider
      locked={locked}
      onBeforeEdit={takeSnapshot}
      onUndo={undoLatest}
      nodes={nodes}
      edges={edges}
      setNodes={setNodes}
      setEdges={setEdges}
    >
      <div className="bg-background flex h-full min-h-0 w-full flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          {/* The trail stops at the parent; the title is its own heading, so it keeps
              text-sm in every style, where some styles shrink the crumb list. */}
          <Breadcrumb className="max-sm:hidden">
            <BreadcrumbList className="flex-nowrap">
              <BreadcrumbItem>
                {/* customize: point at your workflow list route. */}
                <BreadcrumbLink href="/chat/workflow">{WORKFLOW.section}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="min-w-0 truncate text-sm font-semibold">
            {WORKFLOW.name}
          </h1>
          <Separator
            orientation="vertical"
            className="h-4 data-vertical:self-center max-md:hidden"
          />
          {/* Collapses with sr-only, so a phone still hears the counts and state. */}
          <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs max-md:sr-only">
            <span className="shrink-0 tabular-nums">{counts}</span>
            <span
              aria-hidden="true"
              className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
            />
            <span className="flex shrink-0 items-center gap-1.5">
              {dirty ? (
                <span>Unsaved</span>
              ) : (
                <>
                  {/* The avatar and time say who and when; the sentence is read aloud. */}
                  <span className="sr-only">
                    {savedVersion === 0
                      ? `Edited ${WORKFLOW.edited} by ${WORKFLOW.editor.name}`
                      : `Updated just now by ${WORKFLOW.editor.name}`}
                  </span>
                  <Avatar aria-hidden="true" className="size-4">
                    <AvatarImage src={WORKFLOW.editor.avatar} alt="" />
                    <AvatarFallback className="text-[8px]">
                      {WORKFLOW.editor.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span aria-hidden="true">
                    {savedVersion === 0 ? WORKFLOW.edited : "Just now"}
                  </span>
                </>
              )}
            </span>
          </p>
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <FlowKeys />
            <AddStepButton />
            <Button
              variant="outline"
              disabled={!dirty}
              onClick={updateWorkflow}
            >
              <CheckIcon aria-hidden="true" />
              Update
            </Button>
            <WorkflowMenu
              snapToGrid={snapToGrid}
              onSnapToGridChange={setSnapToGrid}
              onResetLayout={resetLayout}
              onSelectAll={selectAllSteps}
              onCopyJson={copyAsJson}
              locked={locked}
              triggerRef={menuTriggerRef}
            />
          </div>
        </header>
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <FlowCanvas
            className={EDGE_STROKE}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onBeforeDelete={confirmDelete}
            onDelete={announceDelete}
            onReconnect={onReconnect}
            onNodeDragStart={stageDrag}
            onNodeDragStop={commitDrag}
            onSelectionDragStop={commitDrag}
            onKeyDownCapture={recordKeyMove}
            onMoveEnd={snapViewport}
            deleteKeyCode={locked ? null : "Backspace"}
            reconnectRadius={16}
            snapToGrid={snapToGrid}
            snapGrid={SNAP_GRID}
            isValidConnection={isValidConnection}
            nodesDraggable={editable}
            nodesConnectable={editable}
            elementsSelectable={!locked}
            edgesReconnectable={editable}
            edgesFocusable={!locked}
          >
            {/* The engine ships its own panel margin unlayered, so this has to win. */}
            <Panel position="bottom-left" className="m-6!">
              <CanvasToolbar
                tool={tool}
                onToolChange={setTool}
                locked={locked}
                onLockedChange={changeLocked}
                canUndo={!locked && canUndo}
                canRedo={!locked && canRedo}
                onUndo={undo}
                onRedo={redo}
              />
            </Panel>
          </FlowCanvas>
          <StepInspectorPanel />
          {dialog}
        </div>
      </div>
    </StepActionsProvider>
  )
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
  const input = safeStringify(part.input)
  return (aliases[agentId] ?? new RegExp(agentId, "i")).test(
    `${part.toolName} ${input}`,
  )
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function toolPartStatus(part: EveDynamicToolPart) {
  if (part.state === "output-error" || part.state === "output-denied") return "failed" as const
  if (part.state === "output-available") return "succeeded" as const
  return "running" as const
}
