import { AUTH5_TRUST_BRANDS } from "./data"

export function TrustStrip() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-muted-foreground/90 text-[11px] font-medium tracking-[0.22em] uppercase">
        Prototype integration stack
      </p>
      {/* Grid */}
      <ul
        className="grid w-full max-w-2xl grid-cols-2 items-center gap-x-2 gap-y-2.5 opacity-90 sm:grid-cols-3 sm:gap-x-2.5 sm:gap-y-3 lg:grid-cols-6 lg:gap-x-2 lg:gap-y-0"
        aria-label="Customer logos"
      >
        {AUTH5_TRUST_BRANDS.map((brand) => (
          <li
            key={brand.id}
            aria-label={brand.name}
            className="flex h-9 items-center justify-center"
          >
            {brand.logo}
          </li>
        ))}
      </ul>
    </div>
  )
}
