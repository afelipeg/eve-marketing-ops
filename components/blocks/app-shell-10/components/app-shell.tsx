import { cn } from "cn"

import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"

export function AppShell() {
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider
        className={cn(
          "[--sidebar-width:260px]",
          "[--sidebar-border:transparent]",
          "[--sidebar:transparent]",
          "[&_[data-slot=sidebar-menu-button]]:border! [&_[data-slot=sidebar-menu-button]]:border-transparent!",
          "[&_[data-slot=sidebar-menu-button]:hover]:border-border/60! [&_[data-slot=sidebar-menu-button]:hover]:bg-background! [&_[data-slot=sidebar-menu-button]:hover]:text-foreground!",
          "[&_[data-slot=sidebar-menu-sub-button]]:border! [&_[data-slot=sidebar-menu-sub-button]]:border-transparent!",
          "[&_[data-slot=sidebar-menu-sub-button]:hover]:border-border/60! [&_[data-slot=sidebar-menu-sub-button]:hover]:bg-background! [&_[data-slot=sidebar-menu-sub-button]:hover]:text-foreground!",
          "[&_[data-slot=sidebar-menu-button][data-active=true]]:border-border/60! [&_[data-slot=sidebar-menu-button][data-active=true]]:border",
          "[&_[data-slot=sidebar-menu-button][data-active=true]]:bg-background! [&_[data-slot=sidebar-menu-button][data-active=true]]:hover:bg-background! **:data-[slot=sidebar-menu-button]:hover:bg-transparent!",
          "[&_[data-slot=sidebar-menu-button][data-active=true]]:text-foreground [&_[data-slot=sidebar-menu-button][data-active=true]>svg]:text-primary [&_[data-slot=sidebar-menu-button][data-active=true]>svg]:opacity-100",
          "**:data-[slot=sidebar-menu-button]:text-accent-foreground/80 **:data-[slot=sidebar-menu-button]:hover:text-foreground",
          "[&_[data-slot=sidebar-menu-button]:hover>svg]:opacity-100 [&_[data-slot=sidebar-menu-button]>svg]:opacity-60",
          "[&_[data-slot=sidebar-menu-sub-button][data-active=true]]:border-border/60! [&_[data-slot=sidebar-menu-sub-button][data-active=true]]:border",
          "[&_[data-slot=sidebar-menu-sub-button][data-active=true]]:bg-background! [&_[data-slot=sidebar-menu-sub-button][data-active=true]]:hover:bg-background! **:data-[slot=sidebar-menu-sub-button]:hover:bg-transparent!",
          "[&_[data-slot=sidebar-menu-sub-button][data-active=true]]:text-foreground [&_[data-slot=sidebar-menu-sub-button][data-active=true]>svg]:text-primary [&_[data-slot=sidebar-menu-sub-button][data-active=true]>svg]:opacity-100",
          "**:data-[slot=sidebar-menu-sub-button]:text-accent-foreground/80 **:data-[slot=sidebar-menu-sub-button]:hover:text-foreground",
          "[&_[data-slot=sidebar-menu-sub-button]:hover>svg]:opacity-100 [&_[data-slot=sidebar-menu-sub-button]>svg]:opacity-60",
          "h-screen"
          // Keep the ambient preview effect co-located with the main sidebar shell."[--glow-1:var(--color-sky-200)] [--glow-2:var(--color-fuchsia-200)] dark:[--glow-1:var(--color-sky-900)] dark:[--glow-2:var(--color-fuchsia-900)]","bg-[radial-gradient(circle_at_15%_100%,color-mix(in_oklab,var(--glow-1)_45%,transparent),transparent_55%),radial-gradient(circle_at_85%_90%,color-mix(in_oklab,var(--glow-2)_45%,transparent),transparent_55%)]"
        )}
      >
        {/* Sidebar */}
        <AppSidebar />
        <SidebarInset className="ml-0! overflow-hidden border shadow-[0_1px_3px_0_rgba(0,0,0,0.08)]! dark:shadow-[0_1px_3px_0_rgba(0,0,0,0.35)]!">
          <AppHeader />
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-muted/40 border-border/40 aspect-video rounded-lg border border-dashed" />
              <div className="bg-muted/40 border-border/40 aspect-video rounded-lg border border-dashed" />
              <div className="bg-muted/40 border-border/40 aspect-video rounded-lg border border-dashed" />
            </div>
            <div className="bg-muted/40 border-border/40 h-full rounded-lg border border-dashed" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}