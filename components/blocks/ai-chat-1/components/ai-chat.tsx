"use client"

// AI copilot chat surface: a streaming transcript, a header thread switcher, a
// starter view with recent chat shortcuts, model switching, and a docked
// composer. Drop it into the content slot of your own app shell.
import { useEffect, useRef, useState } from "react"
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "@/components/reui/alert"
import { Badge } from "@/components/reui/badge"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ChatThread } from "./chat-thread"
import { Composer } from "./composer"
import {
  draftReply,
  JONAS,
  MODELS,
  NEW_THREAD_ID,
  THREAD_ACTIVITY,
  THREADS,
  TRANSCRIPTS,
  type ChatMessageRecord,
  type ThreadRecord,
  type TranscriptRecord,
} from "./data"
import { ChevronDownIcon, PlusIcon, BookmarkIcon, EllipsisVerticalIcon, LinkIcon, DownloadIcon, XIcon } from "lucide-react"

/** Beat before the seeded reply starts typing itself out. */
const REPLY_DELAY_MS = 700

/** Switcher tabs. `All` leads and stays the default, so the whole history is
    still one scan and the other three narrow it rather than hide it. */
const THREAD_TABS = [
  { id: "all", label: "All" },
  { id: "pinned", label: "Pinned" },
  { id: "today", label: "Today" },
  { id: "earlier", label: "Earlier" },
]

/** Groups the All tab heads with a label. Pinned lifts out of its recency
    there; a recency tab still shows it, since Today means everything today. */
const THREAD_GROUPS = [
  { label: "Pinned", threads: THREADS.filter((thread) => thread.pinned) },
  ...(
    [
      ["Today", "today"],
      ["Earlier", "earlier"],
    ] as const
  ).map(([label, recency]) => ({
    label,
    threads: THREADS.filter(
      (thread) => !thread.pinned && thread.recency === recency
    ),
  })),
].filter((group) => group.threads.length > 0)

function threadsForTab(tabId: string) {
  if (tabId === "pinned") return THREADS.filter((thread) => thread.pinned)
  return THREADS.filter((thread) => thread.recency === tabId)
}

function SwitcherRow({
  thread,
  isActive,
  live,
  activityLabel,
  onSelect,
}: {
  thread: ThreadRecord
  isActive: boolean
  /** True while this thread's reply is still being written. */
  live: boolean
  activityLabel: string
  onSelect: (id: string) => void
}) {
  return (
    // Height follows content: a row with no artifact stays a single tight line.
    <Button
      variant={isActive ? "secondary" : "ghost"}
      aria-current={isActive ? "true" : undefined}
      onClick={() => onSelect(thread.id)}
      className="h-auto w-full flex-col items-stretch justify-center gap-0.5 px-2 py-1.5 text-sm font-normal"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-start">
          {thread.title}
        </span>
        <span className="text-muted-foreground w-14 shrink-0 text-end text-[11px] tabular-nums">
          {thread.updatedLabel}
        </span>
      </span>
      {live ? (
        <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[11px]/4">
          <Spinner className="size-3 shrink-0" />
          <span className="shimmer min-w-0 truncate">{activityLabel}</span>
        </span>
      ) : thread.artifact ? (
        <span className="flex min-w-0">
          <Badge
            variant="outline"
            size="sm"
            className="text-muted-foreground min-w-0 font-mono font-normal"
          >
            <span className="min-w-0 truncate">{thread.artifact}</span>
          </Badge>
        </span>
      ) : null}
    </Button>
  )
}

/** Header leading control: names the open chat and switches between them. */
function ThreadSwitcher({
  title,
  activeThreadId,
  streaming,
  activityLabel,
  onSelectThread,
  onNewChat,
}: {
  title: string
  activeThreadId: string
  streaming: boolean
  /** The streaming thread's current step, shown inline on its row. */
  activityLabel: string
  onSelectThread: (id: string) => void
  onNewChat: () => void
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(THREAD_TABS[0].id)

  function renderRow(thread: ThreadRecord) {
    return (
      <SwitcherRow
        key={thread.id}
        thread={thread}
        isActive={thread.id === activeThreadId}
        live={streaming && thread.id === activeThreadId}
        activityLabel={activityLabel}
        onSelect={(id) => {
          setOpen(false)
          onSelectThread(id)
        }}
      />
    )
  }

  return (
    // A tablist is invalid inside role="menu", so the surface is a popover and
    // every row is a real button rather than a menu item.
    <Popover open={open} onOpenChange={setOpen}>
      {/* Button ships shrink-0, so the switcher re-enables shrink: the title
          truncates instead of shoving the trailing controls off. */}
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="-ms-1 min-w-0 shrink gap-1.5 px-2 font-medium"
        >
          <span className="min-w-0 truncate">{title}</span>
          <ChevronDownIcon className="opacity-60" data-icon="inline-end" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      {/* The popup unmounts on close, so the live row never animates unseen. */}
      <PopoverContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        align="start"
        className="flex max-h-96 w-84 max-w-(--radix-popover-content-available-width) flex-col p-0"
      >
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(String(value))}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          {/* The strip never scrolls: it is shrink-0 and the list below owns
              the whole scroll, so no row can pass under it. */}
          <div className="border-border flex h-11 shrink-0 items-center gap-1 border-b px-2">
            {/* Zero padding plus a full-height trigger seats the line underline
                on the strip's own border instead of floating above it. */}
            <TabsList className="h-full gap-0 border-0 bg-transparent p-0">
              {THREAD_TABS.map((item) => (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="h-full! flex-none px-2 after:-bottom-px!"
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="New chat"
                  onClick={() => {
                    setOpen(false)
                    onNewChat()
                  }}
                  className="ms-auto"
                >
                  <PlusIcon aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New chat</TooltipContent>
            </Tooltip>
          </div>

          {THREAD_TABS.map((item) => (
            <TabsContent
              key={item.id}
              value={item.id}
              className="scrollbar min-h-0 flex-1 overflow-y-auto p-2"
            >
              {item.id === "all" ? (
                <div className="flex flex-col">
                  {THREAD_GROUPS.map((group) => (
                    <div
                      key={group.label}
                      className="flex flex-col gap-1 pt-3 first:pt-0"
                    >
                      <span className="text-muted-foreground px-2 text-xs">
                        {group.label}
                      </span>
                      {group.threads.map(renderRow)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {threadsForTab(item.id).map(renderRow)}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

export function AiChat() {
  const [activeThreadId, setActiveThreadId] = useState(THREADS[0].id)
  const [modelId, setModelId] = useState(MODELS[0].id)
  const [streaming, setStreaming] = useState(true)
  /** Only a real Stop press earns the "Stopped by you" note. */
  const [stopped, setStopped] = useState(false)
  const [memoryOn, setMemoryOn] = useState(true)
  const [termsOpen, setTermsOpen] = useState(true)
  /** Turns the visitor adds, kept per thread so switching never loses them. */
  const [sent, setSent] = useState<Record<string, ChatMessageRecord[]>>({})
  /** Threads whose seeded reply has been settled into the message stream. */
  const [committed, setCommitted] = useState<Record<string, boolean>>({})
  /** The reply currently typing itself out, so the thread can animate it. */
  const [arrivingId, setArrivingId] = useState<string | null>(null)
  /** Replies a Stop cut short. They stay cut short, even after the next send. */
  const [stoppedIds, setStoppedIds] = useState<string[]>([])

  const activeThread = THREADS.find((thread) => thread.id === activeThreadId)
  const activeModel = MODELS.find((model) => model.id === modelId) ?? MODELS[0]

  const base = TRANSCRIPTS[activeThreadId] ?? TRANSCRIPTS[NEW_THREAD_ID]
  const added = sent[activeThreadId] ?? []
  const transcript: TranscriptRecord = {
    ...base,
    messages: [...base.messages, ...added],
    pending: committed[activeThreadId] ? undefined : base.pending,
  }
  const title = activeThread?.title ?? "New chat"
  /** Marker step for a live send in this thread, from the storyline map. */
  const stepLabel = THREAD_ACTIVITY[activeThreadId] ?? "Searching the workspace"
  /** The switcher's inline label: the seeded pending owns it while it types. */
  const liveLabel = transcript.pending?.activityLabel ?? stepLabel

  /** The working marker is a beat of feedback, not a permanent state. */
  const replyTimer = useRef<number | null>(null)
  /** Held between the send and its reveal, so a switch settles it instead of
      dropping it. */
  const queuedReply = useRef<{
    threadId: string
    message: ChatMessageRecord
  } | null>(null)

  useEffect(() => {
    return () => {
      if (replyTimer.current) window.clearTimeout(replyTimer.current)
    }
  }, [])

  /**
   * The reveal reports when its last chunk lands, so a long answer runs as long
   * as it needs to instead of being cut off by a timer that guessed.
   */
  function handleArrived() {
    setArrivingId(null)
    setStreaming(false)
  }

  /** Lands the queued reply in its thread: animated from the reply timer,
      instantly settled when a thread switch flushes it early. */
  function appendQueuedReply(animate: boolean) {
    const queued = queuedReply.current
    if (!queued) return
    queuedReply.current = null
    setSent((current) => ({
      ...current,
      [queued.threadId]: [...(current[queued.threadId] ?? []), queued.message],
    }))
    if (animate) setArrivingId(queued.message.id)
  }

  /** A short wait, then the reply types itself out before the beat settles.
      Ids are computed here, before any dispatch, never inside an updater. */
  function beginReply(
    threadId: string,
    prompt: string,
    sentSoFar: ChatMessageRecord[]
  ) {
    if (replyTimer.current) window.clearTimeout(replyTimer.current)
    setStopped(false)
    setStreaming(true)
    queuedReply.current = {
      threadId,
      message: {
        id: `${threadId}_reply_${sentSoFar.length + 1}`,
        role: "assistant",
        author: null,
        at: "Now",
        parts: draftReply(
          prompt,
          sentSoFar.filter((message) => message.role === "assistant").length
        ),
      },
    }
    replyTimer.current = window.setTimeout(() => {
      replyTimer.current = null
      appendQueuedReply(true)
    }, REPLY_DELAY_MS)
  }

  function handleSend(text: string) {
    const pending = committed[activeThreadId] ? undefined : base.pending
    // Sending mid reply settles the one in flight rather than blocking the
    // composer: it finishes in place and the new turn lands under it.
    if (arrivingId) setArrivingId(null)
    const next = [...(sent[activeThreadId] ?? [])]
    if (pending) {
      // Only a run a real Stop cut short stays cut; an interrupted one still
      // settles with its closing clause and finishes its sentence.
      const finished = !stopped && Boolean(pending.rest)
      const settledId = `${activeThreadId}_sent_${next.length + 1}`
      next.push({
        id: settledId,
        role: "assistant",
        author: null,
        at: pending.at,
        parts: finished
          ? pending.parts.map((part, index) =>
              index === pending.parts.length - 1 && part.kind === "text"
                ? { ...part, text: part.text + pending.rest }
                : part
            )
          : pending.parts,
      })
      setCommitted((current) => ({ ...current, [activeThreadId]: true }))
      // A reply you stopped keeps its note once it settles into the thread.
      if (stopped) setStoppedIds((current) => [...current, settledId])
    }
    next.push({
      id: `${activeThreadId}_sent_${next.length + 1}`,
      role: "user",
      author: JONAS,
      at: "Now",
      parts: [{ kind: "text", text }],
    })
    setSent((current) => ({ ...current, [activeThreadId]: next }))
    beginReply(activeThreadId, text, next)
  }

  function handleSelectThread(id: string) {
    setActiveThreadId(id)
    if (replyTimer.current) window.clearTimeout(replyTimer.current)
    replyTimer.current = null
    // A reply still queued for the previous thread settles there instantly
    // instead of being dropped by the switch.
    appendQueuedReply(false)
    setStopped(false)
    setArrivingId(null)
    setStreaming(Boolean(TRANSCRIPTS[id]?.pending) && !committed[id])
  }

  function handleNewChat() {
    setActiveThreadId(NEW_THREAD_ID)
    if (replyTimer.current) window.clearTimeout(replyTimer.current)
    replyTimer.current = null
    appendQueuedReply(false)
    setStopped(false)
    setArrivingId(null)
    setStreaming(false)
    // A new chat starts empty, or the starter never comes back and this block
    // loses the only nav it has once the draft thread holds a turn.
    setSent(({ [NEW_THREAD_ID]: _cleared, ...rest }) => rest)
  }

  function handleCopyLink() {
    navigator.clipboard
      .writeText(`https://chat.halcyon.dev/t/${activeThreadId}`)
      .then(() => toast("Link copied"))
      .catch(() => toast.error("Copy failed"))
  }

  return (
    // Every tooltip in the block needs this ancestor to open.
    <TooltipProvider>
      <div className="bg-background text-foreground flex h-svh min-h-0 w-full flex-col">
        {/* Header floats over the transcript, so it blurs what scrolls beneath. */}
        <header className="bg-background/70 supports-backdrop-filter:bg-background/60 after:from-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 px-3 backdrop-blur-md after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-gradient-to-b after:to-transparent sm:px-4">
          {/* The switcher leads: it names the open chat and is the only nav
              this block has. */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ThreadSwitcher
              title={title}
              activeThreadId={activeThreadId}
              streaming={streaming}
              activityLabel={liveLabel}
              onSelectThread={handleSelectThread}
              onNewChat={handleNewChat}
            />
            {/* Below md the transcript carries this state, where it has room. */}
            {streaming ? (
              <Badge
                variant="primary-light"
                size="sm"
                className="shrink-0 max-md:hidden"
              >
                Working
              </Badge>
            ) : null}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="New chat"
                onClick={handleNewChat}
              >
                <PlusIcon aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>

          {/* A filled variant, not a tint: the primary token reads as the
              foreground here, so colour alone would not show the state. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={memoryOn ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label="Chat memory"
                aria-pressed={memoryOn}
                onClick={() => setMemoryOn((current) => !current)}
                className="hidden sm:inline-flex"
              >
                <BookmarkIcon aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {memoryOn
                ? "Memory on for this chat"
                : "Memory off for this chat"}
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <span className="max-w-28 truncate sm:max-w-none">
                  {activeModel.name}
                </span>
                <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-0">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-muted-foreground px-2.5 pt-2.5 pb-1 text-xs font-normal">
                  Model
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuRadioGroup
                value={modelId}
                onValueChange={(value) => value && setModelId(value)}
                className="px-1.5 pb-1.5"
              >
                {MODELS.map((model) => (
                  <DropdownMenuRadioItem
                    key={model.id}
                    value={model.id}
                    className="items-start gap-2 py-1.5"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm/5 font-medium">
                          {model.name}
                        </span>
                        {model.recommended ? (
                          <Badge
                            variant="primary-light"
                            size="sm"
                            className="px-1.5 py-0 text-[10px]"
                          >
                            Default
                          </Badge>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground truncate text-[11px]/4">
                        {model.provider}
                        <span
                          aria-hidden="true"
                          className="bg-muted-foreground/40 mx-1.5 inline-block size-1 rounded-full align-middle"
                        />
                        <span className="tabular-nums">{model.context}</span>{" "}
                        context
                        <span
                          aria-hidden="true"
                          className="bg-muted-foreground/40 mx-1.5 inline-block size-1 rounded-full align-middle"
                        />
                        {model.capability}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator className="my-0" />

              <div className="text-muted-foreground flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px]">
                <span>Switching keeps this chat</span>
                <a href="#models" className="underline underline-offset-4">
                  Compare
                </a>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Chat options">
                <EllipsisVerticalIcon aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            {/* Only actions the demo really performs: no dead rows. */}
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>This chat</DropdownMenuLabel>
                <DropdownMenuItem onClick={handleCopyLink}>
                  <LinkIcon aria-hidden="true" />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => toast(`Exporting "${title}" as Markdown`)}
                >
                  <DownloadIcon aria-hidden="true" />
                  Export transcript
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <ChatThread
            transcript={transcript}
            title={title}
            streaming={streaming}
            stopped={stopped}
            arrivingId={arrivingId}
            stoppedIds={stoppedIds}
            threads={THREADS}
            activityLabel={stepLabel}
            onStart={handleSend}
            onSelectThread={handleSelectThread}
            onArrived={handleArrived}
          />

          {termsOpen ? (
            <div className="shrink-0 px-3 pb-2 sm:px-4">
              <Alert className="mx-auto w-fit max-w-3xl items-center gap-3 py-2 ps-3 pe-2 text-sm [&_[data-slot=alert-action]]:col-start-3 [&_[data-slot=alert-action]]:row-start-1 [&_[data-slot=alert-action]]:mt-0 [&_[data-slot=alert-action]]:self-center">
                <AlertDescription className="text-foreground block">
                  Make sure you agree to our{" "}
                  <a href="#terms" className="underline underline-offset-4">
                    Terms
                  </a>{" "}
                  and our{" "}
                  <a href="#privacy" className="underline underline-offset-4">
                    Privacy Policy
                  </a>
                </AlertDescription>
                <AlertAction>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Dismiss terms notice"
                    onClick={() => setTermsOpen(false)}
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                </AlertAction>
              </Alert>
            </div>
          ) : null}

          <div className="shrink-0 px-3 pb-4 sm:px-4">
            <Composer
              streaming={streaming}
              model={activeModel}
              onSend={handleSend}
              onStop={() => {
                if (replyTimer.current) {
                  window.clearTimeout(replyTimer.current)
                  replyTimer.current = null
                  // Stop during the wait beat still answers the turn: an
                  // empty stub the transcript marks "Stopped by you".
                  const queued = queuedReply.current
                  if (queued) {
                    queuedReply.current = null
                    const stub = { ...queued.message, parts: [] }
                    setSent((current) => ({
                      ...current,
                      [queued.threadId]: [
                        ...(current[queued.threadId] ?? []),
                        stub,
                      ],
                    }))
                    setStoppedIds((current) => [...current, stub.id])
                  }
                }
                setStopped(true)
                // Frozen where it got to, so Stop keeps the half written answer
                // instead of handing back the rest of it.
                if (arrivingId)
                  setStoppedIds((current) => [...current, arrivingId])
                setArrivingId(null)
                setStreaming(false)
              }}
            />
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
