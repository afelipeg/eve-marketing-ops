"use client"

import * as React from "react"
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame"
import { CodeBlock } from "@/components/reui/code-block"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Send, Mic, Paperclip, Sparkles, Bot, User, Copy, Check, RotateCcw, ChevronDown, Brain, Scale, Zap, Shield, Target } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  blocks?: Array<{ type: "code" | "brief" | "validation" | "directive"; data: any }>
  streaming?: boolean
}

interface ChatPanelProps {
  messages?: ChatMessage[]
  onSend?: (text: string) => void | Promise<void>
  onStop?: () => void
  onReset?: () => void
  streaming?: boolean
  resuming?: boolean
  draft?: string
  onDraftChange?: (text: string) => void
}

export function ChatPanel({
  messages = [],
  onSend,
  onStop,
  onReset,
  streaming = false,
  resuming = false,
  draft = "",
  onDraftChange,
}: ChatPanelProps) {
  const [input, setInput] = React.useState(draft)
  const [showBriefs, setShowBriefs] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const scrollAreaRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  React.useEffect(() => {
    setInput(draft)
  }, [draft])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && onSend) {
      void onSend(input.trim())
      setInput("")
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat Header */}
      <Frame className="border-b border-border/50">
        <FrameHeader className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Chief of Talent</h3>
                <p className="text-xs text-muted-foreground">
                  Orchestrator • {messages.length} messages
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                aria-label="Start a new conversation"
                className="h-8 w-8"
                disabled={!onReset}
                onClick={onReset}
                size="icon"
                type="button"
                variant="ghost"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </FrameHeader>
      </Frame>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-4 space-y-6" ref={messagesEndRef}>
          {messages.length === 0 ? (
            <EmptyState onSelect={onSend} />
          ) : (
            messages.map((msg, i) => (
              <MessageBubble key={msg.id} message={msg} index={i} />
            ))
          )}
          {streaming && <StreamingIndicator />}
        </div>
      </ScrollArea>

      {/* Composer */}
      <Frame className="border-t border-border/50 p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-start gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Brief the orchestrator... (e.g., 'We need a Q3 acquisition plan for Andina beverages in CO-Bogota. Budget $500k.')"
              className="flex-1 min-h-[80px] max-h-[200px] resize-none"
              disabled={resuming}
              rows={3}
            />
            <div className="flex flex-col gap-2 self-end pt-1">
              <Button
                type="submit"
                size="lg"
                disabled={!input.trim() || resuming}
                className="w-[100px]"
              >
                {resuming ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Resuming...
                  </>
                ) : streaming ? (
                  <>Steer<Send className="ml-2 h-4 w-4" /></>
                ) : (
                  <>
                    Send
                    <Send className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              {streaming && onStop && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={onStop}
                  className="w-[100px]"
                >
                  Stop
                </Button>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <QuickAction label="New Acquisition Plan" onSelect={onSend} prompt="We need a Q3 acquisition plan for Andina beverages in CO-Bogota. Budget $500k." />
            <QuickAction label="Reallocation Check" onSelect={onSend} prompt="Run daily budget reallocation check for all active delegations." />
            <QuickAction label="Weekly Control Tower" onSelect={onSend} prompt="Run weekly control tower review for current period." />
            <QuickAction label="QBR Generation" onSelect={onSend} prompt="Generate QBR for completed quarter." />
          </div>
        </form>
      </Frame>
    </div>
  )
}

function EmptyState({ onSelect }: { onSelect?: (text: string) => void | Promise<void> }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
      <p className="text-muted-foreground max-w-xs mb-6">
        Brief the orchestrator with a business objective. It will allocate budget,
        delegate to services, validate with JEV, and reallocate on evidence.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        <QuickAction label="Acquisition Plan" onSelect={onSelect} prompt="We need a Q3 acquisition plan for Andina beverages in CO-Bogota. Budget $500k." />
        <QuickAction label="Maximization Plan" onSelect={onSelect} prompt="Create a maximization plan for Sierra snacks in CO-Medellin. Budget $300k." />
      </div>
    </div>
  )
}

function QuickAction({
  label,
  onSelect,
  prompt,
}: {
  label: string
  onSelect?: (text: string) => void | Promise<void>
  prompt: string
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!onSelect}
      onClick={() => void onSelect?.(prompt)}
      type="button"
      className="gap-1"
    >
      <Sparkles className="h-3 w-3" />
      {label}
    </Button>
  )
}

function MessageBubble({ message, index }: { message: ChatMessage; index: number }) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
          isUser
            ? "bg-muted text-muted-foreground border border-border"
            : "bg-primary/10 text-primary border border-primary/20"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      <div className={cn("flex-1 min-w-0", isUser && "text-right")}>
        <div className={cn("flex items-center gap-2 mb-1", isUser && "justify-end")}>
          <span className="text-xs font-medium">
            {isUser ? "You" : "Orchestrator"}
          </span>
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>

        <div
          className={cn(
            "prose prose-sm max-w-none",
            isUser ? "bg-muted border border-border" : "bg-card border border-border",
            "rounded-xl p-3"
          )}
        >
          {message.content}
        </div>

        {/* Structured blocks */}
        {message.blocks && message.blocks.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.blocks.map((block, i) => (
              <div key={i} className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5 flex items-center gap-2 border-b border-border">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {block.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {JSON.stringify(block.data).slice(0, 100)}...
                  </span>
                </div>
                {block.type === "code" && (
                  <CodeBlock
                    code={typeof block.data === "string" ? block.data : JSON.stringify(block.data, null, 2)}
                    language="json"
                    showLineNumbers
                  />
                )}
                {block.type !== "code" && (
                  <div className="p-3 font-mono text-xs bg-muted/30">
                    {JSON.stringify(block.data, null, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className={cn("flex items-center gap-2 mt-2", isUser && "justify-end")}>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground animate-pulse">
      <Bot className="h-4 w-4 text-primary" />
      <span>Orchestrator is thinking...</span>
      <span className="flex gap-1">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </div>
  )
}
