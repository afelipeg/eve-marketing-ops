import { NavbarActions } from "./navbar-actions"
import { NavbarBreadcrumb } from "./navbar-breadcrumb"

export function Navbar() {
  return (
    <header
      className="flex min-h-9 w-full shrink-0 items-center justify-between gap-2 pb-1"
      aria-label="Security telemetry header"
    >
      <NavbarBreadcrumb />

      <NavbarActions />
    </header>
  )
}