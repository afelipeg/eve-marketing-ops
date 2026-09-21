import { useState } from "react"
import { format } from "date-fns"
import { type DateRange } from "react-day-picker"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon, ShieldCheckIcon, DownloadIcon } from "lucide-react"

type PeriodKey = "last30" | "prev30"

type ReportDateRange = {
  from: Date
  to: Date
}

type DateRangePreset = {
  id: string
  label: string
  period: PeriodKey
  range: ReportDateRange
}

const reportRange = (
  fromMonth: number,
  fromDay: number,
  toMonth: number,
  toDay: number,
  year = 2026
): ReportDateRange => ({
  from: new Date(year, fromMonth, fromDay),
  to: new Date(year, toMonth, toDay),
})

const preset = (
  id: string,
  label: string,
  period: PeriodKey,
  range: ReportDateRange
): DateRangePreset => ({ id, label, period, range })

const LAST_30_RANGE = reportRange(4, 12, 5, 10)
const PREVIOUS_30_RANGE = reportRange(3, 12, 4, 11)

const REPORT_RANGE_PRESETS: DateRangePreset[] = [
  preset("today", "Today", "last30", reportRange(5, 10, 5, 10)),
  preset("yesterday", "Yesterday", "last30", reportRange(5, 9, 5, 9)),
  preset("last7", "Last 7 days", "last30", reportRange(5, 4, 5, 10)),
  preset("last30", "Last 30 days", "last30", LAST_30_RANGE),
  preset("monthToDate", "Month to date", "last30", reportRange(5, 1, 5, 10)),
  preset("lastMonth", "Last month", "last30", reportRange(4, 1, 4, 31)),
  preset("yearToDate", "Year to date", "last30", reportRange(0, 1, 5, 10)),
  preset("lastYear", "Last year", "prev30", reportRange(0, 1, 11, 31, 2025)),
]

const MAX_REPORT_DATE = LAST_30_RANGE.to

function isSameRange(first: ReportDateRange, second: DateRange) {
  const secondFrom = second.from
  const secondTo = second.to ?? second.from

  return (
    Boolean(secondFrom && secondTo) &&
    first.from.getTime() === secondFrom?.getTime() &&
    first.to.getTime() === secondTo?.getTime()
  )
}

function normalizeRange(
  range: DateRange | undefined,
  fallback: ReportDateRange
): ReportDateRange {
  if (!range?.from) return fallback

  const from = range.from
  const to = range.to ?? range.from

  return from.getTime() <= to.getTime() ? { from, to } : { from: to, to: from }
}

function formatReportRange(range: ReportDateRange) {
  return `${format(range.from, "MMM d, yyyy")} - ${format(range.to, "MMM d, yyyy")}`
}

function getPeriodForRange(range: ReportDateRange) {
  const matchingPreset = getMatchingPreset(range)

  if (matchingPreset) return matchingPreset.period
  return range.to.getTime() <= PREVIOUS_30_RANGE.to.getTime()
    ? "prev30"
    : "last30"
}

function getMatchingPreset(range: DateRange | undefined) {
  if (!range?.from || !range.to) return undefined
  const normalizedRange = normalizeRange(range, LAST_30_RANGE)

  return REPORT_RANGE_PRESETS.find((preset) =>
    isSameRange(preset.range, normalizedRange)
  )
}

function ReportDateRangePicker({
  period,
  onPeriodChange,
}: {
  period: PeriodKey
  onPeriodChange: (value: PeriodKey) => void
}) {
  const initialRange = period === "prev30" ? PREVIOUS_30_RANGE : LAST_30_RANGE
  const [open, setOpen] = useState(false)
  const [committedRange, setCommittedRange] =
    useState<ReportDateRange>(initialRange)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(
    initialRange
  )

  const selectedPresetId = getMatchingPreset(draftRange ?? committedRange)?.id

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraftRange(committedRange)
    }

    setOpen(nextOpen)
  }

  function handleApply() {
    const nextRange = normalizeRange(draftRange, committedRange)

    setCommittedRange(nextRange)
    onPeriodChange(getPeriodForRange(nextRange))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="group/pick-date w-[250px] max-w-full justify-between leading-none font-normal tabular-nums"
        >
          <span className="truncate">{formatReportRange(committedRange)}</span>
          <CalendarIcon className="text-muted-foreground/80 group-hover/pick-date:text-foreground shrink-0 transition-colors" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex flex-col">
          <div className="flex flex-col sm:grid sm:grid-cols-[10rem_1fr]">
            <div className="border-border flex flex-wrap gap-1 border-b p-2 sm:flex-col sm:border-r sm:border-b-0">
              {REPORT_RANGE_PRESETS.map((preset) => {
                const selected = selectedPresetId === preset.id

                return (
                  <Button
                    key={preset.id}
                    type="button"
                    size="sm"
                    variant={selected ? "secondary" : "ghost"}
                    className={
                      selected
                        ? "justify-start"
                        : "text-muted-foreground justify-start"
                    }
                    onClick={() => setDraftRange(preset.range)}
                  >
                    {preset.label}
                  </Button>
                )
              })}
            </div>
            <Calendar
              mode="range"
              selected={draftRange}
              onSelect={setDraftRange}
              numberOfMonths={2}
              defaultMonth={draftRange?.from ?? committedRange.from}
              disabled={{
                after: MAX_REPORT_DATE,
              }}
            />
          </div>
          <div className="border-border flex items-center justify-between gap-2 border-t px-3 py-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDraftRange(LAST_30_RANGE)}
            >
              Reset
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraftRange(committedRange)
                  setOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function NavbarActions() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>("last30")

  function handleExport() {
    toast.success("Export queued", {
      description: "Security telemetry report is being prepared.",
      icon: (
        <ShieldCheckIcon className="size-4" aria-hidden="true" />
      ),
    })
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <ReportDateRangePicker period={periodKey} onPeriodChange={setPeriodKey} />

      <Button size="sm" type="button" onClick={handleExport}>
        <DownloadIcon aria-hidden="true" />
        <span className="hidden sm:block">Export</span>
      </Button>
    </div>
  )
}