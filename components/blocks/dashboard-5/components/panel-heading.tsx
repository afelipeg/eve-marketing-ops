export function PanelCorners() {
  return (
    <>
      <span
        aria-hidden="true"
        className="border-foreground/65 absolute top-0 left-0 size-2 border-t border-l"
      />
      <span
        aria-hidden="true"
        className="border-foreground/65 absolute right-0 bottom-0 size-2 border-r border-b"
      />
    </>
  )
}

export function PanelHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="space-y-0.5">
      <h2 className="text-sm leading-4 font-semibold">{title}</h2>
      <p className="text-muted-foreground text-xs leading-4">{description}</p>
    </div>
  )
}