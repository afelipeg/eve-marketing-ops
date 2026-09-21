"use client"

import { cn } from "cn"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import { AppHeader } from "@/components/blocks/app-shell-10/components/app-header"
import { AppSidebar } from "@/components/blocks/app-shell-10/components/app-sidebar"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider
        className={cn(
          "[--sidebar-width:280px]",
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
        )}
      >
        <AppSidebar />
        <SidebarInset className="ml-0! overflow-hidden">
          <AppHeader />
          <main className="flex min-h-0 flex-1 flex-col overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
