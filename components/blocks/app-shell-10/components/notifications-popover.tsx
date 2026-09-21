"use client"

import { cn } from "cn"
import { Badge } from "@/components/reui/badge"
import { Rating } from "@/components/reui/rating"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MessageSquareIcon, PaperclipIcon, UserPlusIcon, CreditCardIcon, ShieldAlertIcon, SparklesIcon, RocketIcon, ActivityIcon, AlertCircleIcon, CircleCheckIcon, LinkIcon, StarIcon, ThumbsUpIcon, UsersIcon, SmileIcon, CalendarIcon, DownloadIcon, CheckCheckIcon, BellIcon, ScaleIcon, BrainIcon, ZapIcon, Target, Zap, BarChart3 } from "lucide-react"

// ── Marketing Ops Validation Notifications ──
type ValidationNotification = {
  id: string
  type: "validation" | "jev" | "moat" | "directive" | "measurement" | "guardrail"
  variant: "info" | "success" | "warning" | "destructive"
  title: string
  body?: string
  time: string
  unread: boolean
  delegate?: string
  directive?: "EXECUTE" | "REBRIEF" | "ESCALATE" | "HOLD"
  confidence?: number
  checks?: {
    significance: { pass: boolean }
    guardrails: { pass: boolean }
    economics: { pass: boolean }
    measurement: { pass: boolean }
  }
}

const VALIDATION_NOTIFICATIONS: ValidationNotification[] = [
  {
    id: "val-1",
    type: "jev",
    variant: "success",
    title: "JEV Validation: Promotions Campaign",
    body: "All checks passed. Uplift 8.7% > MDE 5.2%. Economics: ROI 2.3x",
    time: "2m ago",
    unread: true,
    delegate: "promotions",
    directive: "EXECUTE",
    confidence: 0.92,
    checks: {
      significance: { pass: true },
      guardrails: { pass: true },
      economics: { pass: true },
      measurement: { pass: true },
    },
  },
  {
    id: "val-2",
    type: "jev",
    variant: "warning",
    title: "JEV Validation: Advertisements Campaign",
    body: "Guardrail breach: viewability 42% < 50% threshold. Requires creative refresh.",
    time: "15m ago",
    unread: true,
    delegate: "advertisements",
    directive: "REBRIEF",
    confidence: 0.87,
    checks: {
      significance: { pass: true },
      guardrails: { pass: false },
      economics: { pass: true },
      measurement: { pass: false },
    },
  },
  {
    id: "val-3",
    type: "moat",
    variant: "info",
    title: "MOAT Learning: Discount>20% pattern",
    body: "Pattern detected: promotions with discount>20% on Andina beverages correlate with sleeping dog destruction >10%",
    time: "1h ago",
    unread: false,
    delegate: "promotions",
    confidence: 0.85,
  },
  {
    id: "val-4",
    type: "directive",
    variant: "destructive",
    title: "Directive Blocked: Brand Equity Breach",
    body: "Creative team directive blocked: discount depth 25% exceeds brandEquityMaxDiscount 20%. Legal sign-off required.",
    time: "3h ago",
    unread: true,
    delegate: "creative",
    directive: "ESCALATE",
  },
  {
    id: "val-5",
    type: "measurement",
    variant: "success",
    title: "Measurement Readout: Pricing Test",
    body: "Beta-binomial readout complete. Elasticity CI excludes 0. Power achieved 0.85.",
    time: "5h ago",
    unread: false,
    delegate: "pricing",
    directive: "EXECUTE",
  },
  {
    id: "val-6",
    type: "guardrail",
    variant: "destructive",
    title: "Guardrail Breach: Stock Cover",
    body: "Andina 1.5L stock cover 3.2 weeks < campaign window 4 weeks. Reallocation paused.",
    time: "30m ago",
    unread: true,
    delegate: "pricing",
    directive: "HOLD",
  },
]

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  validation: <ScaleIcon aria-hidden="true" />,
  jev: <BrainIcon aria-hidden="true" />,
  moat: <Target aria-hidden="true" />,
  directive: <Zap aria-hidden="true" />,
  measurement: <BarChart3 aria-hidden="true" />,
  guardrail: <ShieldAlertIcon aria-hidden="true" />,
}

const VARIANT_COLORS: Record<string, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
}

function NotificationItem({ notification }: { notification: ValidationNotification }) {
  const {
    type,
    variant = "info",
    title,
    body,
    time,
    unread,
    delegate,
    directive,
    confidence,
    checks,
  } = notification

  const iconColor = VARIANT_COLORS[variant]
  const directiveColors: Record<string, string> = {
    EXECUTE: "text-success",
    REBRIEF: "text-warning",
    ESCALATE: "text-destructive",
    HOLD: "text-muted-foreground",
  }

  return (
    <div className="relative">
      {unread && (
        <span
          className="bg-primary ring-background pointer-events-none absolute top-3 right-3 z-10 size-1.5 rounded-full ring-1"
          aria-hidden="true"
        />
      )}
      <Button
        variant="ghost"
        className="h-auto w-full items-start justify-start rounded-none p-2 text-left whitespace-normal"
      >
        <div className="flex w-full items-start gap-2 p-2 text-left">
          <div
            className={cn(
              "flex size-6 items-center justify-center [&_svg]:size-4",
              iconColor
            )}
          >
            {NOTIFICATION_ICONS[type] ?? NOTIFICATION_ICONS.validation}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-foreground text-xs leading-snug">
                {title}
              </p>
              {delegate && (
                <Badge variant="outline" size="xs" className="text-[10px]">
                  {delegate}
                </Badge>
              )}
            </div>

            {body && (
              <p className="text-muted-foreground line-clamp-2 text-xs">{body}</p>
            )}

            {directive && (
              <div className="flex items-center gap-1">
                <Badge
                  variant="outline"
                  size="xs"
                  className={cn(
                    directiveColors[directive] || "text-muted-foreground"
                  )}
                >
                  {directive}
                </Badge>
                {confidence !== undefined && (
                  <Badge variant="secondary" size="xs" className="text-[10px]">
                    {Math.round(confidence * 100)}%
                  </Badge>
                )}
              </div>
            )}

            {checks && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className={checks.significance.pass ? "text-success" : "text-destructive"}>
                  ● Significance
                </span>
                <span className={checks.guardrails.pass ? "text-success" : "text-destructive"}>
                  ● Guardrails
                </span>
                <span className={checks.economics.pass ? "text-success" : "text-destructive"}>
                  ● Economics
                </span>
                <span className={checks.measurement.pass ? "text-success" : "text-destructive"}>
                  ● Measurement
                </span>
              </div>
            )}

            <p className="text-muted-foreground text-[11px]">{time}</p>
          </div>
        </div>
      </Button>
    </div>
  )
}

function NotificationsPanel() {
  const unreadCount = VALIDATION_NOTIFICATIONS.filter((n) => n.unread).length

  return (
    <>
      {/* Header */}
      <div className="border-border/40 flex items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">JEV Validations</span>
          {VALIDATION_NOTIFICATIONS.filter((n) => n.unread).length > 0 && (
            <Badge size="xs" className="rounded-full!">
              {VALIDATION_NOTIFICATIONS.filter((n) => n.unread).length}
            </Badge>
          )}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-60 hover:opacity-100"
                aria-label="Mark all as read"
              >
                <CheckCheckIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark all as read</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Content */}
      <div className="relative flex max-h-full">
        <ScrollArea className="max-h-[360px] grow">
          {VALIDATION_NOTIFICATIONS.map((notification, index) => (
            <div key={notification.id}>
              <NotificationItem notification={notification} />
              {index < VALIDATION_NOTIFICATIONS.length - 1 && (
                <Separator className="opacity-60" />
              )}
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="border-border/60 border-t px-2 py-1">
        <Button variant="ghost" size="sm" className="w-full text-xs">
          View all validations
        </Button>
      </div>
    </>
  )
}

export function NotificationsPopover() {
  const hasUnread = VALIDATION_NOTIFICATIONS.some((n) => n.unread)

  return (
    <Popover>
      <PopoverTrigger aria-label="Open validations" asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Validations"
          className="relative [&_svg]:opacity-60 [&_svg]:hover:opacity-100"
        >
          <ScaleIcon aria-hidden="true" />
          {VALIDATION_NOTIFICATIONS.filter((n) => n.unread).length > 0 && (
            <span
              className="bg-primary absolute top-0.5 right-1 size-1.5 rounded-full"
              aria-hidden="true"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        side="bottom"
        align="start"
        sideOffset={8}
        className="w-96 gap-0 p-0"
      >
        <NotificationsPanel />
      </PopoverContent>
    </Popover>
  )
}