import { Card, CardContent } from "@/components/ui/card"

type TooltipItem = {
  value?: unknown
  name?: unknown
  color?: string
}

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: readonly TooltipItem[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null

  return (
    <Card className="bg-popover text-popover-foreground pointer-events-none p-0 shadow-md">
      <CardContent className="min-w-28 space-y-1.5 px-2 py-1.5">
        <div className="text-muted-foreground text-[10px] leading-none">
          {label}
        </div>
        <div className="space-y-1">
          {payload.map((item, index) => (
            <div
              key={`${String(item.name)}-${index}`}
              className="flex items-center justify-between gap-3 text-xs leading-none"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">
                  {String(item.name)}
                </span>
              </span>
              <span className="font-semibold tabular-nums">
                {Number(item.value ?? 0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}