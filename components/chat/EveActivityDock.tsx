"use client"

import * as React from "react"
import type { EveDynamicToolPart, EveMessage, EveMessageInputRequest } from "eve/react"

import {
  AgentActivity,
  type AgentActivityItem,
} from "@/components/agents/agent-activity"
import { ToolResult, ToolResultOutput } from "@/components/agents/tool-result"
import { Badge } from "@/components/reui/badge"
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type PendingRequest = {
  part: EveDynamicToolPart
  request: EveMessageInputRequest
}

export function EveActivityDock({
  busy,
  interactionDisabled = false,
  messages,
  onRespond,
  onRevise,
  onStop,
  stopError,
  stopping = false,
}: {
  busy: boolean
  interactionDisabled?: boolean
  messages: readonly EveMessage[]
  onRespond: (response: { optionId?: string; requestId: string; text?: string }) => Promise<void>
  onRevise: (request: PendingRequest, note: string) => Promise<void>
  onStop: () => Promise<void>
  stopError?: string | null
  stopping?: boolean
}) {
  const currentTurn = currentTurnMessages(messages)
  const toolParts = currentTurn.flatMap((message) =>
    message.parts.filter((part) => part.type === "dynamic-tool"),
  )
  const items = toActivityItems(currentTurn)
  const pending = collectPendingRequests(currentTurn)
  const canStop = busy || pending.length > 0 || toolParts.some((part) => !isTerminal(part.state))

  if (!canStop && items.length === 0 && !stopError) return null

  return (
    <div className="w-full space-y-3">
      {canStop ? (
        <div className="flex items-center justify-between gap-3">
          <p aria-live="polite" className="text-xs text-muted-foreground" role="status">
            {stopping
              ? "Stopping the run and its background tasks…"
              : busy
                ? "Run in progress · background tasks included"
                : "Pending work remains · approvals and background tasks included"}
          </p>
          <Button
            disabled={interactionDisabled || stopping}
            onClick={() => void onStop()}
            size="sm"
            type="button"
            variant="destructive"
          >
            {stopping ? "Stopping…" : "Stop run"}
          </Button>
        </div>
      ) : null}

      {stopError ? (
        <p aria-live="assertive" className="text-xs text-destructive" role="alert">
          {stopError}
        </p>
      ) : null}

      {items.length > 0 ? (
        <AgentActivity
          activeLabel="EVE is working through the run…"
          defaultOpen
          items={items.slice(-12)}
          maxHeight={1200}
          status={busy ? "working" : "complete"}
          summary={`Completed ${items.length} activity ${items.length === 1 ? "step" : "steps"}`}
        />
      ) : null}

      {toolParts.slice(-3).map((part) => (
        <ToolResult
          collapseOnComplete
          defaultOpen={!isTerminal(part.state)}
          key={part.toolCallId}
          kind={part.toolMetadata?.eve?.kind === "subagent-call" ? "request" : "custom"}
          meta={part.toolMetadata?.eve?.kind}
          status={toolStatus(part.state)}
          title={part.toolName}
          tool={part.state}
        >
          <ToolResultOutput language="json">
            {formatToolPayload(part)}
          </ToolResultOutput>
        </ToolResult>
      ))}

      {pending.map((request) => (
        <ApprovalConsole
          disabled={interactionDisabled}
          key={`${request.part.toolCallId}:${request.request.requestId}`}
          onRespond={onRespond}
          onRevise={(note) => onRevise(request, note)}
          pending={request}
        />
      ))}
    </div>
  )
}

function currentTurnMessages(messages: readonly EveMessage[]) {
  const lastUserIndex = messages.findLastIndex((message) => message.role === "user")
  return lastUserIndex >= 0 ? messages.slice(lastUserIndex + 1) : messages
}

function ApprovalConsole({
  disabled,
  onRespond,
  onRevise,
  pending,
}: {
  disabled: boolean
  onRespond: (response: { optionId?: string; requestId: string; text?: string }) => Promise<void>
  onRevise: (note: string) => Promise<void>
  pending: PendingRequest
}) {
  const [revising, setRevising] = React.useState(false)
  const [note, setNote] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const { request } = pending
  const approve = findOption(request, /approve|allow|execute|continue/i)
  const deny = findOption(request, /deny|reject|cancel|stop/i)
  const isApproval = request.kind === "tool-approval"

  async function submit(action: () => Promise<void>) {
    setSubmitting(true)
    try {
      await action()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Frame dense spacing="sm" className="border-warning/50">
      <FrameHeader>
        <div className="flex items-center justify-between gap-2">
          <FrameTitle>{isApproval ? "Approval required" : "Operator response required"}</FrameTitle>
          <Badge size="sm" variant="warning-light">Paused</Badge>
        </div>
        <FrameDescription>{request.prompt}</FrameDescription>
      </FrameHeader>
      <FramePanel className="space-y-3">
        {isApproval && !revising ? (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={disabled || submitting || !approve}
              onClick={() => approve && void submit(() => onRespond({ optionId: approve.id, requestId: request.requestId }))}
              size="sm"
              type="button"
            >
              Approve
            </Button>
            <Button
              disabled={disabled || submitting || !deny}
              onClick={() => setRevising(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              Revise
            </Button>
            <Button
              className="text-destructive"
              disabled={disabled || submitting || !deny}
              onClick={() => deny && void submit(() => onRespond({ optionId: deny.id, requestId: request.requestId }))}
              size="sm"
              type="button"
              variant="ghost"
            >
              Deny
            </Button>
          </div>
        ) : null}

        {isApproval && revising ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const revision = note.trim()
              if (!revision) return
              void submit(() => onRevise(revision))
            }}
          >
            <Input
              aria-label="Revision requested"
              autoFocus
              disabled={disabled || submitting}
              onChange={(event) => setNote(event.currentTarget.value)}
              placeholder="What should change before it runs?"
              value={note}
            />
            <Button disabled={disabled || submitting || note.trim().length === 0} size="sm" type="submit">
              Send
            </Button>
            <Button onClick={() => setRevising(false)} size="sm" type="button" variant="ghost">
              Cancel
            </Button>
          </form>
        ) : null}

        {!isApproval ? (
          <div className="space-y-2">
            {request.options?.length ? (
              <div className="flex flex-wrap gap-2">
                {request.options.map((option) => (
                  <Button
                    disabled={disabled || submitting}
                    key={option.id}
                    onClick={() => void submit(() => onRespond({ optionId: option.id, requestId: request.requestId }))}
                    size="sm"
                    type="button"
                    variant={option.style === "danger" ? "destructive" : "outline"}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            ) : null}
            {request.allowFreeform || !request.options?.length ? (
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const answer = note.trim()
                  if (!answer) return
                  void submit(() => onRespond({ requestId: request.requestId, text: answer }))
                }}
              >
                <Input
                  aria-label="Operator response"
                  disabled={disabled || submitting}
                  onChange={(event) => setNote(event.currentTarget.value)}
                  value={note}
                />
                <Button disabled={disabled || submitting || note.trim().length === 0} size="sm" type="submit">
                  Respond
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </FramePanel>
    </Frame>
  )
}

function collectPendingRequests(messages: readonly EveMessage[]): PendingRequest[] {
  return messages.flatMap((message) =>
    message.parts.flatMap((part) => {
      if (part.type !== "dynamic-tool") return []
      const request = part.toolMetadata?.eve?.inputRequest
      const response = part.toolMetadata?.eve?.inputResponse
      return request && !response ? [{ part, request }] : []
    }),
  )
}

function toActivityItems(messages: readonly EveMessage[]): AgentActivityItem[] {
  return messages.flatMap((message) =>
    message.parts.flatMap<AgentActivityItem>((part, index) => {
      const id = `${message.id}:${part.type}:${index}`
      if (part.type === "reasoning") {
        return [{ content: part.text || "Reasoning through the next step", id, type: "text" }]
      }
      if (part.type === "step-start") {
        return [{ id, label: "Started a new agent step", status: "complete", type: "step" }]
      }
      if (part.type === "dynamic-tool") {
        return [{ action: toolAction(part), id, target: part.toolName, type: "tool" }]
      }
      if (part.type === "authorization") {
        return [{ detail: part.description, id, kind: "message", label: part.displayName, type: "trace" }]
      }
      return []
    }),
  )
}

function toolAction(part: EveDynamicToolPart) {
  const kind = part.toolMetadata?.eve?.kind
  if (kind === "load-skill") return "read"
  if (kind === "subagent-call") return "run"
  return "run"
}

function findOption(request: EveMessageInputRequest, pattern: RegExp) {
  return request.options?.find((option) => pattern.test(`${option.id} ${option.label}`))
}

function toolStatus(state: EveDynamicToolPart["state"]) {
  if (state === "output-error") return "error" as const
  if (state === "output-denied") return "cancelled" as const
  if (state === "output-available") return "success" as const
  return "running" as const
}

function isTerminal(state: EveDynamicToolPart["state"]) {
  return state === "output-available" || state === "output-error" || state === "output-denied"
}

function formatToolPayload(part: EveDynamicToolPart) {
  if (part.state === "output-error") {
    return nonEmptyText(part.errorText, "The tool failed without an error payload.")
  }
  if (part.state === "output-denied") {
    return nonEmptyText(part.approval?.reason, "Denied by operator")
  }
  if (part.state === "output-available") {
    return stringify(part.output, "The tool completed without an output payload.")
  }
  return stringify(part.input, "Waiting for tool input.")
}

function nonEmptyText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback
}

function stringify(value: unknown, fallback: string) {
  if (typeof value === "string") return value
  try {
    const serialized = JSON.stringify(value, null, 2)
    return typeof serialized === "string" ? serialized : fallback
  } catch {
    const coerced = String(value)
    return coerced === "undefined" ? fallback : coerced
  }
}
