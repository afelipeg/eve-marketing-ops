export function MarketingHero() {
  return (
    <div className="flex max-w-xl flex-col gap-7 sm:gap-8">
      <div className="border-border/60 bg-background/80 text-foreground/70 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium tracking-tight backdrop-blur-sm">
        <span className="bg-primary size-1.5 rounded-full" aria-hidden="true" />
        <span>EVE-powered marketing operations</span>
      </div>
      <h1 className="text-foreground text-4xl leading-[1.02] font-semibold tracking-[-0.02em] text-balance sm:text-5xl lg:text-[56px]">
        Turn marketing decisions into{" "}
        <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">
          measured growth
        </span>
        .
      </h1>
      <p className="text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
        Coordinate specialist agents, validate evidence, and keep every guarded
        action visible before execution.
      </p>
    </div>
  )
}
