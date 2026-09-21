"use client"

import { LogOutIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Logo } from "./logo"
import {
  NavMain,
  type ChatHistoryItem,
  type WorkspaceView,
} from "./nav-main"

export function AppSidebar({
  chatHistory = [],
  currentSessionId,
  currentView = "chat",
}: {
  chatHistory?: readonly ChatHistoryItem[]
  currentSessionId?: string
  currentView?: WorkspaceView
}) {
  const { state, toggleSidebar } = useSidebar()
  const expanded = state === "expanded"

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="border-sidebar-border/70 border-b">
        <div className="flex min-h-10 items-center gap-2 px-0.5">
          {expanded ? (
            <>
              <Logo />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Marketing Ops</p>
                <p className="text-muted-foreground truncate text-[11px]">EVE workspace</p>
              </div>
            </>
          ) : null}
          <Button
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            className={expanded ? "ml-auto" : "mx-auto"}
            onClick={toggleSidebar}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            {expanded ? <PanelLeftCloseIcon aria-hidden="true" /> : <PanelLeftOpenIcon aria-hidden="true" />}
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          chatHistory={chatHistory}
          currentSessionId={currentSessionId}
          currentView={currentView}
        />
      </SidebarContent>
      <SidebarFooter className="border-sidebar-border/70 border-t">
        <Button
          aria-label="Sign out"
          className={expanded ? "justify-start" : "mx-auto"}
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" })
            window.location.assign("/")
          }}
          size={expanded ? "sm" : "icon-sm"}
          type="button"
          variant="ghost"
        >
          <LogOutIcon aria-hidden="true" />
          {expanded ? <span>Sign out</span> : null}
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
