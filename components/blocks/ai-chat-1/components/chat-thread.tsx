"use client"

import { memo, useEffect, useRef, useState, type ReactNode } from "react"
import { Badge } from "@/components/reui/badge"
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockHeader,
  CodeBlockTitle,
  type CodeBlockFoldRegion,
} from "@/components/reui/code-block/code-block"
import { highlightCode } from "@/components/reui/code-block/code-block-highlight"
import { cn } from "cn"
import { toast } from "sonner"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
} from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@/components/ui/marker"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ASSISTANT_NAME,
  STARTER_CATEGORIES,
  type ChatMessageRecord,
  type MessagePart,
  type ThreadRecord,
  type TranscriptRecord,
} from "./data"
import { SparklesIcon, SearchIcon, CodeIcon, BookOpenIcon, FileTextIcon, DownloadIcon, CopyIcon, ThumbsUpIcon, ThumbsDownIcon, Pin, MessageSquareIcon, CornerDownLeftIcon } from "lucide-react"

const STARTER_ICONS: Record<string, ReactNode> = {
  create: (
    <SparklesIcon aria-hidden="true" />
  ),
  explore: (
    <SearchIcon aria-hidden="true" />
  ),
  code: (
    <CodeIcon aria-hidden="true" />
  ),
  learn: (
    <BookOpenIcon aria-hidden="true" />
  ),
}

/** A region's end grows with the stream while its folded state is keyed on the
    start line, so a fold taken mid arrival would swallow every line after it. */
const NO_FOLD_REGIONS: CodeBlockFoldRegion[] = []

function CodeArtifact({
  part,
  streaming = false,
}: {
  part: Extract<MessagePart, { kind: "code" }>
  streaming?: boolean
}) {
  return (
    // w-full so the block fills the thread column instead of the w-fit bubble
    // sizing itself to the widest code line.
    <CodeBlock
      code={part.code}
      language={part.language}
      showLineNumbers
      foldable
      foldRegions={streaming ? NO_FOLD_REGIONS : undefined}
      streaming={streaming}
      className="w-full min-w-0"
    >
      {part.filename ? (
        <CodeBlockHeader>
          <CodeBlockTitle>{part.filename}</CodeBlockTitle>
          <div className="ms-auto flex items-center gap-1">
            {/* The tooltip rides a wrapper: rendered AS the button it
                overwrites the primitive own onClick and the control dies. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  {/* A titled snippet in a transcript IS a file, so disk is the
                    next step. Terminal falls back to the language stem. */}
                  <CodeBlockDownloadButton
                    label="Download file"
                    filename={
                      part.filename.includes(".") ? part.filename : undefined
                    }
                    onDownload={(name) => toast(`Downloading ${name}`)}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>Download file</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <CodeBlockCopyButton />
                </span>
              </TooltipTrigger>
              <TooltipContent>Copy code</TooltipContent>
            </Tooltip>
          </div>
        </CodeBlockHeader>
      ) : (
        // Headerless: the button pins over the surface, so it needs its own
        // backdrop, and a tooltip wrapper would take a line box here.
        <CodeBlockCopyButton
          variant="outline"
          size="icon-sm"
          className="bg-card hover:bg-muted"
        />
      )}
      <ScrollArea
        // Capped on the block's own line grid rather than a round number, so a
        // snippet that outgrows the box is cut between lines instead of through
        // one. Sixteen lines fits every snippet in the demo whole.
        // The block-scoped rule is inert in base; in the radix twin the
        // viewport wraps children in display:table, which breaks code width.
        className="rounded-(--code-block-radius) **:data-[slot=scroll-area-viewport]:max-h-[calc(16*var(--code-block-line-height)+var(--code-block-padding))] [&>[data-slot=scroll-area-viewport]>div]:block!"
      >
        <CodeBlockContent />
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </CodeBlock>
  )
}

/**
 * One reveal tick. Everything below is expressed in ticks, not milliseconds.
 * 50ms rather than a frame: every tick grows the transcript, and growth costs a
 * resize observation, an autoscroll to the new bottom and a relayout of the
 * column. Measured at 30ms that work took about 37 percent of the main thread
 * and the reveal ran at two thirds of its own clock. Half the updates carrying
 * twice the text keeps the same pace and leaves the frame budget alone.
 */
const TICK_MS = 50
/** A part with nothing to type still holds the stream for a beat. */
const SILENT_TICKS = 8
/** Pause between parts, so they land one at a time instead of running on. */
const GAP_TICKS = 3

/** Code lands faster than prose, the way a real model emits it, and it costs
    the reveal less since every line boundary re-tokenizes the snippet. */
const CODE_SPEEDUP = 2

/**
 * How many visible steps a snippet arrives in, whatever its length: a line at a
 * time until a snippet runs long, which is what reads best. Highlighted rows
 * are the one costly thing a reveal paints, and the cost tracks the total rows
 * rather than how they are grouped, so this is a taste knob, not a speed one.
 */
const CODE_PASSES = 24

/** Reveal units a part contributes; an attachment costs a beat instead. */
function partCost(part: MessagePart, rate: number) {
  if (part.kind === "text") return part.text.length
  if (part.kind === "code") return Math.ceil(part.code.length / CODE_SPEEDUP)
  return rate * SILENT_TICKS
}

/** Reading pace, and the floor and cap on how long a reply may take. */
const CHARS_PER_TICK = 27
const MIN_TICKS = 29
const MAX_TICKS = 108

/**
 * One character rate for the whole reply, so a long answer takes longer than a
 * short one without ever dragging: about 1.5s at the floor, 5.4s at the cap.
 */
function revealRate(parts: MessagePart[]) {
  const typed = parts.reduce(
    (total, part) =>
      total +
      (part.kind === "text"
        ? part.text.length
        : part.kind === "code"
          ? Math.ceil(part.code.length / CODE_SPEEDUP)
          : 0),
    0
  )
  const ticks = Math.min(
    MAX_TICKS,
    Math.max(MIN_TICKS, Math.round(typed / CHARS_PER_TICK))
  )
  return Math.max(2, Math.ceil(typed / ticks))
}

type RevealedPart = {
  part: MessagePart
  /** Trails the live text, so the reader can see where the reply is. */
  caret: boolean
  /** Hands a growing snippet to the code block's own streaming treatment. */
  streaming: boolean
}

/** Walks the reply and cuts it at the revealed character. */
function sliceReply(
  parts: MessagePart[],
  revealed: number,
  rate: number
): RevealedPart[] {
  const gap = rate * GAP_TICKS
  const shown: RevealedPart[] = []
  let start = 0

  for (const part of parts) {
    const local = revealed - start
    if (local <= 0) break

    const cost = partCost(part, rate)
    if (local >= cost) {
      shown.push({ part, caret: false, streaming: false })
      start += cost + gap
      continue
    }

    if (part.kind === "text") {
      shown.push({
        part: { ...part, text: part.text.slice(0, local) },
        caret: true,
        streaming: false,
      })
    } else if (part.kind === "code") {
      // Code lands a line at a time. There is no incremental tokenizer, so a
      // character level slice re-highlights the whole snippet 33 times a
      // second and the reveal falls behind its own clock; on a line boundary
      // the source is unchanged between ticks and the pass is skipped. The
      // first line still types, where the document is one line long.
      const chars = local * CODE_SPEEDUP
      const lines = part.code.split("\n")
      const step = Math.max(1, Math.ceil(lines.length / CODE_PASSES))
      const reached = Math.floor((chars / part.code.length) * lines.length)
      const settled = Math.floor(reached / step) * step
      shown.push({
        part: {
          ...part,
          // Before the first group lands the opening line types, so the block
          // never sits there as an empty box.
          code: settled
            ? lines.slice(0, settled).join("\n") + "\n"
            : part.code.slice(0, chars),
        },
        caret: false,
        streaming: true,
      })
    } else {
      shown.push({ part, caret: false, streaming: false })
    }
    return shown
  }

  // Between parts the caret rides the last text line so the reply still reads
  // as running; a caret left on a finished reply reads as a stream that hung.
  const last = shown[shown.length - 1]
  if (shown.length < parts.length && last?.part.kind === "text")
    last.caret = true
  return shown
}

/**
 * Streams a reply in: parts land in order, text types itself out, and a code
 * snippet grows line by line under the code block's own streaming treatment.
 * Instant under reduced motion. `frozen` keeps whatever a Stop already showed,
 * so pressing Stop does not hand back the rest of the answer.
 */
function useRevealedReply(
  parts: MessagePart[],
  {
    active,
    frozen,
    onDone,
  }: { active: boolean; frozen: boolean; onDone?: () => void }
) {
  const rate = revealRate(parts)
  const gap = rate * GAP_TICKS
  const total = parts.reduce(
    (sum, part, index) =>
      sum + partCost(part, rate) + (index < parts.length - 1 ? gap : 0),
    0
  )

  const [revealed, setRevealed] = useState(active ? rate : total)
  // The parent re-creates this on every render; an effect must not restart on it.
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (frozen) return
    if (!active) {
      setRevealed(total)
      return
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(total)
      return
    }
    // Starts on the first chunk rather than on nothing, so a reply never opens
    // with an empty bubble.
    setRevealed(rate)
    const timer = window.setInterval(() => {
      setRevealed((current) => Math.min(total, current + rate))
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [active, frozen, rate, total])

  // Reported rather than timed: only the reveal knows when the last chunk lands.
  useEffect(() => {
    if (!active || frozen || revealed < total) return
    doneRef.current?.()
  }, [active, frozen, revealed, total])

  return sliceReply(parts, revealed, rate)
}

/** True when a re-render would draw exactly what is already on screen. */
function samePart(a: MessagePart, b: MessagePart) {
  if (a.kind !== b.kind) return false
  if (a.kind === "text") return a.text === (b as typeof a).text
  if (a.kind === "code") return a.code === (b as typeof a).code
  if (a.kind === "image") return a.src === (b as typeof a).src
  return a.name === (b as typeof a).name
}

/**
 * Compared by content, not by identity, and that is the whole performance story
 * of this block. The reveal hands every part a fresh object on every tick, so a
 * referential memo never hits: each tick re-rendered the streaming code block,
 * and each of those renders walked the ancestor chain through getComputedStyle
 * to find its scroller. Profiled at a quarter of the main thread, with typing
 * in the composer landing 340ms after the key. Slicing to the same string now
 * costs nothing.
 */
const PartBody = memo(
  function PartBody({
    part,
    caret,
    streaming,
  }: {
    part: MessagePart
    caret?: boolean
    streaming?: boolean
  }) {
    if (part.kind === "code")
      return <CodeArtifact part={part} streaming={streaming} />

    if (part.kind === "image") {
      return (
        <Attachment orientation="vertical" className="w-full max-w-xs">
          <AttachmentMedia variant="image">
            <img src={part.src} alt={part.alt} />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{part.caption}</AttachmentTitle>
          </AttachmentContent>
        </Attachment>
      )
    }

    if (part.kind === "file") {
      return (
        <Attachment className="w-full max-w-xs">
          <AttachmentMedia>
            <FileTextIcon aria-hidden="true" />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{part.name}</AttachmentTitle>
            <AttachmentDescription>{part.meta}</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction
              type="button"
              size="icon-sm"
              variant="secondary"
              aria-label={`Download ${part.name}`}
              onClick={() => toast(`Downloading ${part.name}`)}
            >
              <DownloadIcon aria-hidden="true" />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      )
    }

    // Split on backticks rather than match a closed pair: mid type the closer
    // has not arrived yet, and a lone backtick must never render as text.
    const segments = part.text.split("`")

    return (
      <p className="whitespace-pre-wrap">
        {segments.map((segment, index) =>
          index % 2 === 1 ? (
            <code
              key={index}
              className="bg-muted rounded-sm px-1 py-0.5 font-mono text-[0.85em]"
            >
              {segment}
            </code>
          ) : (
            segment
          )
        )}
        {/* The caret rides inside the last paragraph so it trails the final word
          instead of blocking onto its own line. */}
        {caret ? (
          <span
            className="bg-foreground ms-0.5 inline-block h-[1em] w-0.5 translate-y-0.5"
            aria-hidden="true"
          />
        ) : null}
      </p>
    )
  },
  (previous, next) =>
    previous.caret === next.caret &&
    previous.streaming === next.streaming &&
    samePart(previous.part, next.part)
)

/** Static icon nodes: the shadcn CLI cannot resolve icon names from props. */
const ICON_COPY = (
  <CopyIcon aria-hidden="true" />
)

const ICON_LIKE = (
  <ThumbsUpIcon aria-hidden="true" />
)

const ICON_DISLIKE = (
  <ThumbsDownIcon aria-hidden="true" />
)

const ICON_PIN = (
  <Pin aria-hidden="true" />
)

const ICON_THREAD = (
  <MessageSquareIcon aria-hidden="true" />
)

/** Flattens a turn to the text a paste should carry: prose plus raw code. */
function turnText(messages: { parts: MessagePart[] }[]) {
  return messages
    .flatMap((message) =>
      message.parts.map((part) =>
        part.kind === "text"
          ? part.text
          : part.kind === "code"
            ? part.code
            : part.kind === "file"
              ? part.name
              : part.caption
      )
    )
    .join("\n\n")
}

function copyTurn(messages: { parts: MessagePart[] }[]) {
  navigator.clipboard
    .writeText(turnText(messages))
    .then(() => toast("Copied to clipboard"))
    .catch(() => toast.error("Copy failed"))
}

function TurnAction({
  label,
  icon,
  active = false,
  pressed = false,
  onClick,
}: {
  label: string
  icon: ReactNode
  active?: boolean
  /** Toggles carry aria-pressed; one-shot actions like Copy must not. */
  pressed?: boolean
  onClick?: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      aria-pressed={pressed ? active : undefined}
      onClick={onClick}
      className={active ? "text-primary" : undefined}
    >
      {icon}
    </Button>
  )
}

/** One reply. Owns its own reveal, so only the arriving bubble animates. */
function ReplyBubble({
  parts,
  streaming,
  frozen,
  onDone,
  children,
}: {
  parts: MessagePart[]
  streaming: boolean
  frozen: boolean
  onDone?: () => void
  children?: ReactNode
}) {
  const shown = useRevealedReply(parts, { active: streaming, frozen, onDone })

  return (
    <Bubble variant="ghost" className="w-full min-w-0">
      <BubbleContent className="min-w-0 space-y-3">
        {shown.map((item, index) => (
          <PartBody
            key={index}
            part={item.part}
            caret={item.caret}
            streaming={item.streaming}
          />
        ))}
      </BubbleContent>
      {children}
    </Bubble>
  )
}

function AssistantTurn({
  messages,
  streaming = false,
  stopped = false,
  onDone,
}: {
  messages: {
    id: string
    parts: MessagePart[]
    at: string
    reactions?: string[]
  }[]
  streaming?: boolean
  stopped?: boolean
  onDone?: () => void
}) {
  const [vote, setVote] = useState<"up" | "down" | null>(null)
  const last = messages[messages.length - 1]
  // A liked reply carries the reaction on the bubble, the way a teammate's
  // would, so the signal lives with the message and not just in the toolbar.
  const reactions = Array.from(
    new Set([
      ...(last.reactions ?? []),
      ...(vote === "up" ? ["\u{1F44D}"] : []),
    ])
  )

  return (
    <Message role="group" aria-label={ASSISTANT_NAME} className="group/turn">
      {/* The primitive bottom aligns the avatar, which reads wrong beside the
          long ghost turns this block is built on. */}
      <MessageAvatar className="translate-y-0! self-start">
        <Avatar>
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            <SparklesIcon className="size-3.5" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
      </MessageAvatar>

      {/* No top padding: both roles share one spine, so a reply and a send
          start on the same line as their avatar. */}
      <MessageContent className="min-w-0 gap-1">
        <BubbleGroup className="gap-5">
          {messages.map((message, index) => {
            const isLast = index === messages.length - 1
            return (
              <ReplyBubble
                key={message.id}
                parts={message.parts}
                streaming={streaming && isLast}
                frozen={stopped && isLast}
                onDone={isLast ? onDone : undefined}
              >
                {isLast && reactions.length ? (
                  <BubbleReactions
                    side="bottom"
                    align="start"
                    role="img"
                    aria-label={`Reactions: ${reactions.join(", ")}`}
                  >
                    {reactions.map((emoji, index) => (
                      <span key={index}>{emoji}</span>
                    ))}
                  </BubbleReactions>
                ) : null}
              </ReplyBubble>
            )
          })}
        </BubbleGroup>

        {streaming ? null : (
          <MessageFooter
            className={reactions.length ? "mt-4 gap-0.5" : "gap-0.5"}
          >
            {stopped ? (
              <span className="text-muted-foreground pe-1 text-xs">
                Stopped by you
              </span>
            ) : null}
            {/* Time and actions share one reveal, and the row keeps its space
                so nothing shifts when it fades in. */}
            <span className="pointer-events-none flex items-center gap-0.5 opacity-0 transition-opacity group-hover/turn:pointer-events-auto group-hover/turn:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 max-md:pointer-events-auto max-md:opacity-100">
              <span className="text-muted-foreground pe-1 text-xs tabular-nums">
                {last.at}
              </span>
              <TurnAction
                label="Copy reply"
                icon={ICON_COPY}
                onClick={() => copyTurn(messages)}
              />
              <TurnAction
                label={vote === "up" ? "Remove like" : "Like reply"}
                icon={ICON_LIKE}
                active={vote === "up"}
                pressed
                onClick={() => setVote(vote === "up" ? null : "up")}
              />
              <TurnAction
                label={vote === "down" ? "Remove dislike" : "Dislike reply"}
                icon={ICON_DISLIKE}
                active={vote === "down"}
                pressed
                onClick={() => setVote(vote === "down" ? null : "down")}
              />
            </span>
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  )
}

function UserTurn({ messages }: { messages: ChatMessageRecord[] }) {
  // User turns always carry their author; a null author is an assistant turn.
  const person = messages[0].author
  const last = messages[messages.length - 1]
  if (!person) return null

  return (
    <Message
      align="end"
      className="group/turn"
      role="group"
      aria-label={person.name}
    >
      <MessageAvatar>
        <Avatar>
          <AvatarImage src={person.avatar} alt="" />
          <AvatarFallback className="text-xs">{person.initials}</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent className="min-w-0 gap-1">
        {/* Consecutive sends stack under one avatar, the way a real thread
            reads, instead of repeating the identity on every line. */}
        <BubbleGroup className="w-full items-end gap-3">
          {messages.map((message) => (
            <Bubble key={message.id} variant="muted" align="end">
              <BubbleContent className="space-y-2">
                {message.parts.map((part, index) => (
                  <PartBody key={index} part={part} />
                ))}
              </BubbleContent>
            </Bubble>
          ))}
        </BubbleGroup>

        {/* Your own turns keep a quiet row: the actions only appear on hover or
            keyboard focus, so the transcript stays the content. */}
        <MessageFooter className="gap-0.5 pe-0">
          {/* pointer-events-none so the hidden row is not tappable, and always
              shown below md where there is no hover to reveal it. */}
          <span className="pointer-events-none flex items-center gap-0.5 opacity-0 transition-opacity group-hover/turn:pointer-events-auto group-hover/turn:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 max-md:pointer-events-auto max-md:opacity-100">
            <span className="text-muted-foreground pe-1 text-xs tabular-nums">
              {last.at}
            </span>
            <TurnAction
              label="Copy message"
              icon={ICON_COPY}
              onClick={() => copyTurn(messages)}
            />
          </span>
        </MessageFooter>
      </MessageContent>
    </Message>
  )
}

/** How many recent chats the starter offers. Kept short so the composer stays
    the focus; the header switcher owns the full history. */
const SHORTCUT_LIMIT = 4

function ThreadStart({
  threads,
  onStart,
  onSelectThread,
}: {
  /** Doubles as the nav for this block: it ships without a thread sidebar. */
  threads: ThreadRecord[]
  onStart: (text: string) => void
  onSelectThread: (id: string) => void
}) {
  const [categoryId, setCategoryId] = useState(STARTER_CATEGORIES[0].id)
  const category =
    STARTER_CATEGORIES.find((item) => item.id === categoryId) ??
    STARTER_CATEGORIES[0]
  const shortcuts = [
    ...threads.filter((thread) => thread.pinned),
    ...threads.filter((thread) => !thread.pinned),
  ].slice(0, SHORTCUT_LIMIT)

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">
          How can I help you?
        </h2>
        <p className="text-muted-foreground text-sm">
          Plan, validate, and monitor a marketing decision with EVE.
        </p>
      </div>

      {/* Category rail: picking one swaps the suggestions below it. */}
      <div className="mt-5 flex flex-wrap gap-2">
        {STARTER_CATEGORIES.map((item) => {
          const selected = item.id === categoryId
          return (
            <Button
              key={item.id}
              variant="outline"
              size="sm"
              aria-pressed={selected}
              onClick={() => setCategoryId(item.id)}
              className={cn(
                "rounded-full font-normal transition-colors [&_svg]:size-3.5",
                selected
                  ? "border-foreground/20 bg-foreground/8 text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              )}
            >
              {STARTER_ICONS[item.id]}
              {item.label}
            </Button>
          )
        })}
      </div>

      {/* Divided rows give the list structure at rest; -mx-3 puts the text on
          the heading's left spine while the hover fill bleeds past it. */}
      <div className="mt-5 flex flex-col">
        {category.prompts.map((prompt) => (
          <Button
            key={prompt}
            variant="ghost"
            onClick={() => onStart(prompt)}
            // Foreground at rest: the suggestions are the primary action here,
            // so they must not read lighter than the shortcuts below them.
            className="group/prompt border-border h-auto w-full justify-start gap-3 rounded-none border-x-0 border-t-0 border-b px-0 py-2.5 text-start font-normal whitespace-normal last:border-b-0 hover:bg-transparent"
          >
            <span className="min-w-0 flex-1">{prompt}</span>
            {/* The return glyph: these rows send the prompt. The old up-right
                arrow is the external link sign and read as "navigate away". */}
            <CornerDownLeftIcon className="size-4 shrink-0 opacity-40 transition-opacity group-hover/prompt:opacity-100" aria-hidden="true" />
          </Button>
        ))}
      </div>

      {/* Shortcuts back into the existing threads, pinned ones first. One
          column at every width, so the times read as a real column. */}
      {shortcuts.length > 0 ? (
        <div className="-mx-2 mt-6 flex flex-col gap-1.5">
          <h3 className="text-muted-foreground px-2 text-xs font-medium">
            Recent chats
          </h3>
          {/* Dense on purpose: rows touch on one tight rhythm, and only the
              meta recedes, so the titles stay at full reading contrast. */}
          <div className="flex flex-col">
            {shortcuts.map((thread) => (
              <Button
                key={thread.id}
                variant="ghost"
                onClick={() => onSelectThread(thread.id)}
                className="[&_svg]:text-muted-foreground h-8 w-full justify-start gap-2.5 px-2 font-normal [&_svg]:size-3.5"
              >
                {thread.pinned ? ICON_PIN : ICON_THREAD}
                <span className="min-w-0 flex-1 truncate text-start">
                  {thread.title}
                </span>
                {/* Same outline chip the header switcher gives an artifact, so
                    the two surfaces speak one language. */}
                {thread.artifact ? (
                  <Badge
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground max-w-32 min-w-0 font-mono font-normal"
                  >
                    <span className="min-w-0 truncate">{thread.artifact}</span>
                  </Badge>
                ) : null}
                <span className="text-muted-foreground w-14 shrink-0 text-end text-xs tabular-nums">
                  {thread.updatedLabel}
                </span>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Consecutive turns from the same speaker render under one avatar. */
function groupTurns(messages: ChatMessageRecord[]) {
  const groups: ChatMessageRecord[][] = []
  for (const message of messages) {
    const last = groups[groups.length - 1]
    if (
      last &&
      last[0].role === message.role &&
      last[0].author?.name === message.author?.name
    ) {
      last.push(message)
      continue
    }
    groups.push([message])
  }
  return groups
}

export function ChatThread({
  transcript,
  title,
  streaming,
  stopped,
  arrivingId,
  stoppedIds,
  threads,
  activity,
  activityLabel,
  onStart,
  onSelectThread,
  onArrived,
}: {
  transcript: TranscriptRecord
  title: string
  streaming: boolean
  stopped: boolean
  arrivingId: string | null
  /** Replies a Stop cut short, which must stay cut short from then on. */
  stoppedIds: string[]
  /** Offered as shortcuts on the starter view, newest and pinned first. */
  threads: ThreadRecord[]
  /** EVE reasoning, tools, results, and approvals rendered after the reply. */
  activity?: ReactNode
  /** Step shown while a live send waits, a real step from the storyline. */
  activityLabel: string
  onStart: (text: string) => void
  onSelectThread: (id: string) => void
  onArrived: () => void
}) {
  const { compacted, dateLabel, messages, pending } = transcript

  // Warms Shiki early, or the first streamed snippet renders plain the whole
  // way and only colours at the end.
  useEffect(() => {
    void highlightCode("const ready = true", { language: "typescript" })
  }, [])

  // A run that finished delivers its closing clause; a stopped one keeps only
  // the text it had already produced.
  const tail =
    pending && !streaming && !stopped && pending.rest
      ? pending.parts.map((part, index) =>
          index === pending.parts.length - 1 && part.kind === "text"
            ? { ...part, text: part.text + pending.rest }
            : part
        )
      : pending?.parts

  // The starter runs taller than the transcript column on a short viewport, so
  // it owns the scroll and centres only while it fits.
  if (messages.length === 0 && !pending) {
    return (
      <div className="scrollbar min-h-0 flex-1 overflow-y-auto">
        <ThreadStart
          threads={threads}
          onStart={onStart}
          onSelectThread={onSelectThread}
        />
      </div>
    )
  }

  return (
    // Bottom following, with no anchored item anywhere in the transcript: the
    // peek prop only reads on a scrollAnchor element, so it would be inert here.
    <MessageScrollerProvider autoScroll>
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport className="scrollbar">
          <MessageScrollerContent
            aria-busy={streaming}
            className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-6"
          >
            {/* The header has no room for this below md, so it leads the
                transcript instead and scrolls away with it. */}
            <MessageScrollerItem
              scrollAnchor={false}
              className="[content-visibility:visible]"
            >
              <div className="flex items-center gap-2 md:hidden">
                <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">
                  {title}
                </h1>
                {streaming ? (
                  <Badge variant="primary-light" size="sm">
                    Working
                  </Badge>
                ) : null}
              </div>
            </MessageScrollerItem>

            {dateLabel ? (
              <MessageScrollerItem
                scrollAnchor={false}
                className="[content-visibility:visible]"
              >
                <Marker variant="separator">
                  <MarkerContent>{dateLabel}</MarkerContent>
                </Marker>
              </MessageScrollerItem>
            ) : null}

            {compacted ? (
              <MessageScrollerItem
                scrollAnchor={false}
                className="[content-visibility:visible]"
              >
                <Marker variant="separator">
                  <MarkerContent>{compacted}</MarkerContent>
                </Marker>
              </MessageScrollerItem>
            ) : null}

            {/* Unanchored on purpose: top anchoring never opens the spacer
                under variable-height groups, typing replies below the fold. */}
            {groupTurns(messages).map((group) => {
              const arriving = group.some(
                (message) => message.id === arrivingId
              )
              return (
                <MessageScrollerItem
                  key={group[0].id}
                  messageId={group[group.length - 1].id}
                  // Opacity-only entrance: a transform here mismeasures the
                  // item's extent and breaks bottom-following.
                  className="animate-in fade-in-0 duration-300 ease-out [content-visibility:visible] motion-reduce:animate-none"
                >
                  {group[0].role === "user" ? (
                    <UserTurn messages={group} />
                  ) : (
                    <AssistantTurn
                      messages={group}
                      streaming={arriving}
                      stopped={stoppedIds.includes(group[group.length - 1].id)}
                      onDone={arriving ? onArrived : undefined}
                    />
                  )}
                </MessageScrollerItem>
              )
            })}

            {pending ? (
              <MessageScrollerItem
                scrollAnchor={false}
                className="[content-visibility:visible]"
              >
                <AssistantTurn
                  messages={[
                    { id: "pending", ...pending, parts: tail ?? pending.parts },
                  ]}
                  streaming={streaming}
                  stopped={stopped}
                  onDone={onArrived}
                />
              </MessageScrollerItem>
            ) : null}

            {/* Waiting beat only: a seeded pending is already live typing, so
                the marker must never share the screen with its bubble. */}
            {streaming && !arrivingId && !pending ? (
              <MessageScrollerItem
                scrollAnchor={false}
                className="[content-visibility:visible]"
              >
                <Marker className="ps-10">
                  <MarkerIcon>
                    <Spinner />
                  </MarkerIcon>
                  <MarkerContent className="shimmer">
                    {activityLabel}
                  </MarkerContent>
                </Marker>
              </MessageScrollerItem>
            ) : null}

            {activity ? (
              <MessageScrollerItem
                scrollAnchor={false}
                className="[content-visibility:visible]"
              >
                {activity}
              </MessageScrollerItem>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>

        {/* aria-busy silences the log, so the in-flight step is announced from
            outside it rather than not at all. */}
        <p role="status" aria-live="polite" className="sr-only">
          {streaming ? (pending?.activityLabel ?? activityLabel) : ""}
        </p>

        {/* Pill jump to latest, shown only while the reader is scrolled up. */}
        <MessageScrollerButton
          variant="outline"
          size="icon-sm"
          className="bottom-4 rounded-full shadow-sm"
        />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
