"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PanelRightOpenIcon } from "lucide-react"
import {
  useEveAgent,
  type EveMessage,
  type EveMessageInputRequest,
} from "eve/react"
import {
  Client,
  type SessionSnapshot,
} from "eve/client"

import { EveActivityDock } from "@/components/chat/EveActivityDock"
import { AppHeader } from "@/components/blocks/app-shell-10/components/app-header"
import { AppSidebar } from "@/components/blocks/app-shell-10/components/app-sidebar"
import type { ChatHistoryItem, WorkspaceView } from "@/components/blocks/app-shell-10/components/nav-main"
import { ChatThread } from "@/components/blocks/ai-chat-1/components/chat-thread"
import { Composer } from "@/components/blocks/ai-chat-1/components/composer"
import type {
  ChatMessageRecord,
  ModelRecord,
  TranscriptRecord,
} from "@/components/blocks/ai-chat-1/components/data"
import { SecurityDashboard } from "@/components/blocks/dashboard-5/components/security-dashboard"
import { WorkflowBuilder } from "@/components/blocks/flow-1/components/workflow-builder"
import { OperationsPanel } from "@/components/operations/OperationsPanel"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const HISTORY_KEY = "marketing-ops:eve-chat-history:v1"
const OPERATOR = { avatar: "", initials: "OP", name: "Operator" }
const ROOT_MODEL: ModelRecord = {
  capability: "Orchestration",
  context: "400K",
  contextTokens: 400_000,
  id: "anthropic/claude-sonnet-5",
  name: "Claude Sonnet 5",
  provider: "Vercel AI Gateway",
  recommended: true,
}

type EveChatPanelProps = {
  initialView?: WorkspaceView
  sessionId?: string
}

export function EveChatPanel(props: EveChatPanelProps) {
  if (!props.sessionId) return <EveChatWorkspace {...props} />
  return <HydratedEveChatWorkspace {...props} sessionId={props.sessionId} />
}

function HydratedEveChatWorkspace({
  initialView = "chat",
  sessionId,
}: EveChatPanelProps & { sessionId: string }) {
  const [snapshot, setSnapshot] = React.useState<SessionSnapshot | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let current = true
    const client = new Client({ host: "" })

    client.sessions
      .attach(sessionId)
      .snapshot()
      .then((next) => {
        if (current) setSnapshot(next)
      })
      .catch((error: unknown) => {
        if (!current) return
        setLoadError(error instanceof Error ? error.message : "Unable to restore this EVE session.")
      })

    return () => {
      current = false
    }
  }, [sessionId])

  if (loadError) {
    return (
      <main className="grid min-h-svh place-items-center bg-background p-6">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-lg font-semibold">Unable to restore this session</h1>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button onClick={() => window.location.reload()} type="button" variant="outline">
            Reload
          </Button>
        </div>
      </main>
    )
  }

  if (!snapshot) {
    return (
      <main className="grid min-h-svh place-items-center bg-background p-6">
        <p className="text-sm text-muted-foreground">Restoring EVE session…</p>
      </main>
    )
  }

  return (
    <EveChatWorkspace
      initialView={initialView}
      sessionId={sessionId}
      snapshot={snapshot}
    />
  )
}

function EveChatWorkspace({
  initialView = "chat",
  sessionId,
  snapshot,
}: EveChatPanelProps & { snapshot?: SessionSnapshot }) {
  const router = useRouter()
  const routedSessionId = React.useRef(sessionId)
  const timestamps = React.useRef(new Map<string, string>())
  const [currentSessionId, setCurrentSessionId] = React.useState(sessionId)
  const [history, setHistory] = React.useState<ChatHistoryItem[]>(() =>
    sessionId ? [{ id: sessionId, title: "Current session", updatedLabel: "now" }] : [],
  )
  const [rightOpen, setRightOpen] = React.useState(true)
  const [stopped, setStopped] = React.useState(false)

  const agent = useEveAgent({
    initialEvents: snapshot?.events,
    initialSession: snapshot?.session ?? (sessionId ? { sessionId, streamIndex: 0 } : undefined),
    onError(error) {
      console.error("EVE session error", error.stack ?? error.message)
    },
    onSessionChange(session) {
      const nextSessionId = session?.sessionId
      if (nextSessionId === routedSessionId.current) return

      routedSessionId.current = nextSessionId
      setCurrentSessionId(nextSessionId)
      router.replace(nextSessionId ? `/chat/${encodeURIComponent(nextSessionId)}` : "/chat")
    },
    resume: sessionId !== undefined,
  })
  const isBusy = agent.status === "submitted" || agent.status === "streaming"
  const isResuming = agent.status === "resuming"
  const eventTypes = agent.events.map((event) => event.type)

  React.useEffect(() => {
    setRightOpen(true)
  }, [initialView])

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HISTORY_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as ChatHistoryItem[]
      if (Array.isArray(parsed)) setHistory(parsed.slice(0, 20))
    } catch {
      // A malformed prototype cache must never stop the durable EVE session.
    }
  }, [])

  React.useEffect(() => {
    if (!currentSessionId) return
    const firstUserText = agent.data.messages
      .find((message) => message.role === "user")
      ?.parts.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ")
      .trim()
    const title = firstUserText || "Current session"

    setHistory((current) => {
      const next = [
        { id: currentSessionId, title: title.slice(0, 56), updatedLabel: "now" },
        ...current.filter((item) => item.id !== currentSessionId),
      ].slice(0, 20)
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [agent.data.messages, currentSessionId])

  const messages = React.useMemo(() => {
    const projected = agent.data.messages.map((message) => {
      let timestamp = timestamps.current.get(message.id)
      if (!timestamp) {
        timestamp = new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date())
        timestamps.current.set(message.id, timestamp)
      }
      return toChatMessage(message, timestamp)
    })

    if (!agent.error) return projected
    return [
      ...projected,
      {
        at: new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date()),
        author: null,
        id: "eve-client-error",
        parts: [{ kind: "text" as const, text: `EVE connection error: ${agent.error.message}` }],
        role: "assistant" as const,
      },
    ]
  }, [agent.data.messages, agent.error])

  const transcript: TranscriptRecord = { messages }
  const arrivingId = isBusy
    ? [...messages].reverse().find((message) => message.role === "assistant")?.id ?? null
    : null
  const currentPage = initialView === "workflow"
    ? "Workflow"
    : initialView === "telemetry"
      ? "Telemetry"
      : "Chat"

  async function revise(
    request: { request: EveMessageInputRequest },
    note: string,
  ) {
    const deny = request.request.options?.find((option) =>
      /deny|reject|cancel|stop/i.test(`${option.id} ${option.label}`),
    )
    if (!deny) throw new Error("This approval request does not expose a cancel option.")

    await agent.respond([{ optionId: deny.id, requestId: request.request.requestId }])
    await agent.send(`Revise the denied action before trying again: ${note}`)
  }

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider
        defaultOpen
        className={cn(
          "h-svh overflow-hidden [--sidebar-width:260px]",
          "[--sidebar-border:transparent] [--sidebar:transparent]",
        )}
      >
        <AppSidebar
          chatHistory={history}
          currentSessionId={currentSessionId}
          currentView={initialView}
        />
        <SidebarInset className="ml-0! min-w-0 overflow-hidden">
          <AppHeader
            currentPage={currentPage}
            actions={
              !rightOpen ? (
                <Button
                  aria-label="Open EVE control plane"
                  onClick={() => setRightOpen(true)}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <PanelRightOpenIcon aria-hidden="true" />
                </Button>
              ) : null
            }
          />

          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            {initialView === "chat" ? (
              <section aria-label="EVE agent chat" className="flex min-w-0 flex-1 flex-col">
                <ChatThread
                  activityLabel="Coordinating the marketing workflow"
                  arrivingId={arrivingId}
                  onArrived={() => undefined}
                  onSelectThread={(id) => router.push(`/chat/${encodeURIComponent(id)}`)}
                  onStart={(text) => {
                    setStopped(false)
                    void agent.send(text)
                  }}
                  stopped={stopped}
                  stoppedIds={[]}
                  streaming={isBusy}
                  threads={[]}
                  title="Marketing Ops Orchestrator"
                  transcript={transcript}
                />

                <div className="max-h-[42vh] shrink-0 overflow-y-auto border-t bg-background/95">
                  <EveActivityDock
                    busy={isBusy}
                    interactionDisabled={isResuming}
                    messages={agent.data.messages}
                    onRespond={(response) => agent.respond([response])}
                    onRevise={revise}
                  />
                </div>

                <div className="shrink-0 border-t bg-background px-4 py-3 sm:px-6">
                  <Composer
                    disabled={isResuming}
                    model={ROOT_MODEL}
                    onSend={(text) => {
                      setStopped(false)
                      agent.send(text, isBusy ? { turnPolicy: "steer" } : undefined)
                    }}
                    onStop={() => {
                      setStopped(true)
                      agent.cancel()
                    }}
                    streaming={isBusy}
                  />
                </div>
              </section>
            ) : initialView === "workflow" ? (
              <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
                <WorkflowBuilder
                  eventTypes={eventTypes}
                  fitKey={rightOpen}
                  messages={agent.data.messages}
                />
              </main>
            ) : (
              <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-muted/20 p-3 sm:p-4 lg:p-6">
                <SecurityDashboard />
              </main>
            )}

            {rightOpen ? (
              <OperationsPanel
                eventTypes={eventTypes}
                messages={agent.data.messages}
                onClose={() => setRightOpen(false)}
                status={agent.status}
              />
            ) : null}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function toChatMessage(message: EveMessage, at: string): ChatMessageRecord {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n")

  return {
    at,
    author: message.role === "user" ? OPERATOR : null,
    id: message.id,
    parts: text ? [{ kind: "text", text }] : [],
    role: message.role,
  }
}
