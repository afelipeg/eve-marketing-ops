import { AuthLogo } from "./auth-logo"
import { GradientWave } from "./gradient-wave"
import { MarketingHero } from "./marketing-hero"
import { SignupForm } from "./signup-form"
import { TrustStrip } from "./trust-strip"

export function Auth() {
  return (
    <div className="bg-background relative isolate min-h-svh w-full overflow-hidden">
      <GradientWave />

      <div className="relative flex min-h-svh flex-col px-6 py-7 sm:px-12 sm:py-10 lg:px-14 lg:py-12">
        <header className="flex items-center justify-between">
          <AuthLogo />
          <p className="text-foreground/75 text-sm font-medium">Private owner workspace</p>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 items-center py-16 sm:py-20 lg:py-24">
          <div className="grid w-full grid-cols-1 items-center gap-14 sm:gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-24">
            <MarketingHero />
            <SignupForm />
          </div>
        </main>

        <footer className="mx-auto w-full max-w-6xl pt-10 pb-6 sm:pt-14">
          <TrustStrip />
        </footer>
      </div>
    </div>
  )
}
