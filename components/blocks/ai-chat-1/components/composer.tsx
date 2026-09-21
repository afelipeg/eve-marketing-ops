"use client"

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react"
import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame"

import { GithubDark } from "@/components/ui/svgs/githubDark"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { TOKEN_USAGE, type ModelRecord } from "./data"
import { PaperclipIcon, ImageIcon, DatabaseIcon, ActivityIcon, ChevronDownIcon, XIcon, TriangleAlertIcon, PlusIcon, BrainIcon, GlobeIcon, MicIcon, ArrowUpIcon } from "lucide-react"

/** Each attach action drops a named context chip into the composer. */
const ATTACH_ACTIONS = [
  {
    id: "upload",
    label: "Upload files",
    hint: "PDF, CSV, images",
    chip: "churn-q3.csv",
    icon: (
      <PaperclipIcon aria-hidden="true" />
    ),
  },
  {
    id: "screenshot",
    label: "Add screenshot",
    hint: "From clipboard",
    chip: "screenshot-0912.png",
    icon: (
      <ImageIcon aria-hidden="true" />
    ),
  },
  {
    id: "repo",
    label: "Connect repo",
    hint: "GitHub, GitLab",
    chip: "halcyon/platform",
    // The real brand mark, swapped per theme like every other logo in the corpus.
    icon: (
      <>
        <span aria-hidden="true" className="dark:hidden">
          <GithubLight className="size-4" />
        </span>
        <span aria-hidden="true" className="hidden dark:block">
          <GithubDark className="size-4" />
        </span>
      </>
    ),
  },
  {
    id: "database",
    label: "Query database",
    hint: "Read only",
    chip: "analytics, read only",
    icon: (
      <DatabaseIcon aria-hidden="true" />
    ),
  },
]

/** Percentage of the window used before the composer starts warning. */
const WARN_AT = 60

/** The dictation demo listens for a beat, then stops itself. */
const DICTATE_MS = 5000

// Two ambient rings ripple off the mic while it listens: transform and opacity
// only, and both rest invisible at 0% so a paused loop shows nothing.
const DICTATE_MOTION = `
  .ai-chat1-dictate-ring {
    animation: ai-chat1-dictate-ring 1.8s ease-out infinite;
    animation-delay: var(--dictate-delay, 0s);
  }
  @keyframes ai-chat1-dictate-ring {
    0%, 100% { transform: scale(1); opacity: 0; }
    15% { opacity: 0.55; }
    85% { transform: scale(1.55); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ai-chat1-dictate-ring { animation: none; }
  }
`

export function Composer({
  disabled = false,
  streaming,
  model,
  onSend,
  onStop,
}: {
  disabled?: boolean
  streaming: boolean
  /** The picked model: the context meter scales to its window. */
  model: ModelRecord
  onSend: (text: string) => void
  onStop: () => void
}) {
  const [value, setValue] = useState("")
  const [webSearch, setWebSearch] = useState(false)
  const [extendedThinking, setExtendedThinking] = useState(true)
  const [noticeOpen, setNoticeOpen] = useState(true)
  const [listening, setListening] = useState(false)
  /** Context chips the attach menu added, removable one by one. */
  const [chips, setChips] = useState<{ id: string; label: string }[]>([])
  const field = useRef<HTMLTextAreaElement>(null)
  const dictateTimer = useRef<number | null>(null)

  const canSend = !disabled && value.trim().length > 0
  const usedPercent = Math.round((TOKEN_USAGE.used / model.contextTokens) * 100)
  const nearLimit = usedPercent >= WARN_AT

  useEffect(() => {
    return () => {
      if (dictateTimer.current) window.clearTimeout(dictateTimer.current)
    }
  }, [])

  function toggleDictate() {
    if (dictateTimer.current) window.clearTimeout(dictateTimer.current)
    dictateTimer.current = null
    setListening((current) => {
      const next = !current
      if (next) {
        dictateTimer.current = window.setTimeout(() => {
          dictateTimer.current = null
          setListening(false)
        }, DICTATE_MS)
      }
      return next
    })
  }

  function addChip(id: string, label: string) {
    setChips((current) =>
      current.some((chip) => chip.id === id)
        ? current
        : [...current, { id, label }]
    )
  }

  function send() {
    if (!canSend) return
    const text = value.trim()
    setValue("")
    setChips([])
    onSend(text)
    // Clicking the button takes focus off the field. The composer never locks
    // during a reply, so the caret belongs straight back in it.
    field.current?.focus()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    send()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter breaks the line. An IME candidate window also
    // fires Enter, and committing a word there must not post the message.
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    )
      return
    event.preventDefault()
    send()
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
      {/* Frame dense pulls the panel flush to the edge, so the usage header and
          the input read as one control rather than two stacked boxes. */}
      <Frame dense spacing="sm" className="w-full">
        {noticeOpen ? (
          <FrameHeader className="bg-muted/40 rounded-t-[calc(var(--frame-radius)-1px)]">
            <Collapsible>
              <div className="flex items-center gap-2">
                {/* The open marker sits on the trigger, which is the element
                    that carries it in both bases. */}
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="group/notice text-muted-foreground hover:text-foreground flex min-w-0 flex-1 items-center gap-1.5 text-start text-xs"
                  >
                    <ActivityIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      Context {usedPercent} percent full
                      <span
                        aria-hidden="true"
                        className="bg-muted-foreground/40 mx-1.5 inline-block size-1 rounded-full align-middle"
                      />
                      Plan limit resets Friday 12:00 PM
                    </span>
                    <ChevronDownIcon className="size-3.5 shrink-0 transition-transform group-data-[state=open]/notice:rotate-180" aria-hidden="true" />
                  </button>
                </CollapsibleTrigger>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Dismiss usage notice"
                  onClick={() => setNoticeOpen(false)}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </div>

              <CollapsibleContent>
                <div className="flex flex-col gap-2 pt-2.5">
                  {/* A 1px muted track vanishes here, so the unused budget is
                      hatched with a gradient that reads the border token. */}
                  <Progress
                    value={usedPercent}
                    aria-label="Context window used"
                    className="[&_[data-slot=progress-track]]:ring-border/60 h-1.5 [&_[data-slot=progress-indicator]]:rounded-full [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-[repeating-linear-gradient(-45deg,var(--color-border)_0_1.5px,transparent_1.5px_5px)] [&_[data-slot=progress-track]]:ring-1 [&_[data-slot=progress-track]]:ring-inset"
                  />
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="tabular-nums">
                      {(TOKEN_USAGE.used / 1000).toFixed(1)}K of {model.context}{" "}
                      tokens
                    </span>
                    <span className="tabular-nums">
                      {TOKEN_USAGE.costLabel} this chat
                    </span>
                    {nearLimit ? (
                      <span className="flex items-center gap-1">
                        <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
                        Older turns compact on the next reply
                      </span>
                    ) : null}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </FrameHeader>
        ) : null}

        <FramePanel className="p-0">
          <form onSubmit={submit} className="relative">
            <FieldLabel className="sr-only" htmlFor="ai-chat-1-composer">
              Message EVE
            </FieldLabel>

            <InputGroup className="border-0 bg-transparent shadow-none">
              {chips.length > 0 ? (
                <InputGroupAddon
                  align="block-start"
                  className="flex-wrap gap-1"
                >
                  {/* Outline, not filled: an attached file is context, not a
                      status, and a tint here competes with the send button. */}
                  {chips.map((chip) => (
                    <Badge
                      key={chip.id}
                      variant="outline"
                      className="min-w-0 gap-1 pe-0.5"
                    >
                      <span className="max-w-40 min-w-0 truncate">
                        {chip.label}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${chip.label}`}
                        onClick={() =>
                          setChips((current) =>
                            current.filter((item) => item.id !== chip.id)
                          )
                        }
                        className="size-4 rounded-full [&_svg]:size-3"
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    </Badge>
                  ))}
                </InputGroupAddon>
              ) : null}
              <InputGroupTextarea
                disabled={disabled}
                id="ai-chat-1-composer"
                ref={field}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything, or describe what you want changed..."
                // Starts one line and grows with the text, capped so the
                // transcript never loses the screen.
                className="field-sizing-content max-h-48 min-h-16"
              />

              <InputGroupAddon align="block-end" className="gap-1">
                {/* Attach menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <InputGroupButton size="icon-sm" aria-label="Add context">
                      <PlusIcon aria-hidden="true" />
                    </InputGroupButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-64 [&_[data-slot=dropdown-menu-item]]:gap-3 [&_[data-slot=dropdown-menu-item]]:py-2"
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Add context</DropdownMenuLabel>
                      {ATTACH_ACTIONS.map((action) => (
                        <DropdownMenuItem
                          key={action.id}
                          onClick={() => addChip(action.id, action.chip)}
                        >
                          {action.icon}
                          <span className="flex flex-1 flex-col">
                            <span>{action.label}</span>
                            <span className="text-muted-foreground text-xs">
                              {action.hint}
                            </span>
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <InputGroupButton
                  size="sm"
                  variant={extendedThinking ? "secondary" : "ghost"}
                  aria-pressed={extendedThinking}
                  onClick={() => setExtendedThinking((current) => !current)}
                >
                  <BrainIcon data-icon="inline-start" aria-hidden="true" />
                  Think
                </InputGroupButton>

                <InputGroupButton
                  size="sm"
                  variant={webSearch ? "secondary" : "ghost"}
                  aria-pressed={webSearch}
                  onClick={() => setWebSearch((current) => !current)}
                >
                  <GlobeIcon data-icon="inline-start" aria-hidden="true" />
                  Search
                </InputGroupButton>

                {extendedThinking || webSearch ? (
                  <Badge
                    variant="outline"
                    size="sm"
                    radius="full"
                    className="hidden sm:inline-flex"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-primary size-1.5 rounded-full"
                    />
                    {extendedThinking && webSearch ? "2 tools" : "1 tool"}
                  </Badge>
                ) : null}

                <div className="ms-auto flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InputGroupButton
                        size="icon-sm"
                        variant={listening ? "secondary" : "ghost"}
                        aria-label="Dictate message"
                        aria-pressed={listening}
                        onClick={toggleDictate}
                        className={
                          listening
                            ? "ring-primary/50 relative ring-1"
                            : undefined
                        }
                      >
                        {listening ? (
                          <>
                            <style>{DICTATE_MOTION}</style>
                            <span
                              aria-hidden="true"
                              className="ai-chat1-dictate-ring ring-primary/60 pointer-events-none absolute inset-0 rounded-full ring-1 motion-reduce:animate-none"
                            />
                            <span
                              aria-hidden="true"
                              style={
                                { "--dictate-delay": "0.9s" } as CSSProperties
                              }
                              className="ai-chat1-dictate-ring ring-primary/60 pointer-events-none absolute inset-0 rounded-full ring-1 motion-reduce:animate-none"
                            />
                          </>
                        ) : null}
                        <MicIcon aria-hidden="true" />
                      </InputGroupButton>
                    </TooltipTrigger>
                    <TooltipContent>
                      {listening ? "Stop dictating" : "Dictate"}
                    </TooltipContent>
                  </Tooltip>

                  {/* One primary slot: Stop replaces Send while the reply
                      streams, and sending again settles the one in flight. */}
                  {streaming ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InputGroupButton
                          disabled={disabled}
                          size="icon-sm"
                          variant="outline"
                          onClick={onStop}
                          aria-label="Stop generating"
                        >
                          {/* A filled square is the stop glyph everywhere, and
                            it costs no icon mapping to draw. */}
                          <span
                            aria-hidden="true"
                            className="bg-foreground size-2.5 rounded-xs"
                          />
                        </InputGroupButton>
                      </TooltipTrigger>
                      <TooltipContent>Stop generating</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InputGroupButton
                          disabled={!canSend}
                          type="submit"
                          size="icon-sm"
                          variant="default"
                          aria-label="Send message"
                        >
                          <ArrowUpIcon aria-hidden="true" />
                        </InputGroupButton>
                      </TooltipTrigger>
                      <TooltipContent className="flex items-center gap-1.5">
                        Send
                        <Kbd>Enter</Kbd>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </FramePanel>
      </Frame>

      <p className="text-muted-foreground text-center text-xs">
        EVE can make mistakes. Review approvals and important outputs.
      </p>
    </div>
  )
}
