"use client"

import * as React from "react"
import { ActivityIcon, ChevronRightIcon, GitBranchIcon, MessageSquareIcon, PlusIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export type WorkspaceView = "chat" | "workflow" | "telemetry"

export type ChatHistoryItem = {
  id: string
  title: string
  updatedLabel: string
}

export function NavMain({
  chatHistory,
  currentSessionId,
  currentView,
}: {
  chatHistory: readonly ChatHistoryItem[]
  currentSessionId?: string
  currentView: WorkspaceView
}) {
  const [historyOpen, setHistoryOpen] = React.useState(true)

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Workspace</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              aria-controls="chat-history-tree"
              aria-expanded={historyOpen}
              isActive={currentView === "chat"}
              onClick={() => setHistoryOpen((open) => !open)}
              tooltip="Chat"
            >
              <MessageSquareIcon aria-hidden="true" />
              <span>Chat</span>
              <ChevronRightIcon
                aria-hidden="true"
                className={cn(
                  "ml-auto size-4 transition-transform motion-reduce:transition-none",
                  historyOpen && "rotate-90",
                )}
              />
            </SidebarMenuButton>

            {historyOpen ? (
              <SidebarMenuSub id="chat-history-tree" className="mr-0 pr-0">
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild>
                    <a href="/chat">
                      <PlusIcon aria-hidden="true" />
                      <span>New chat</span>
                    </a>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                {chatHistory.length ? (
                  chatHistory.map((chat) => (
                    <SidebarMenuSubItem key={chat.id}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={currentView === "chat" && chat.id === currentSessionId}
                      >
                        <a href={`/chat/${encodeURIComponent(chat.id)}`} title={chat.title}>
                          <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                          <span className="text-muted-foreground ml-auto text-[10px] tabular-nums">
                            {chat.updatedLabel}
                          </span>
                        </a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))
                ) : (
                  <SidebarMenuSubItem>
                    <span className="text-muted-foreground block px-2 py-1.5 text-xs">
                      Sessions appear after the first message.
                    </span>
                  </SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            ) : null}
          </SidebarMenuItem>

          <WorkspaceLink
            href={withSession("/chat/workflow", currentSessionId)}
            icon={<GitBranchIcon aria-hidden="true" />}
            label="Workflow"
            selected={currentView === "workflow"}
          />
          <WorkspaceLink
            href={withSession("/chat/telemetry", currentSessionId)}
            icon={<ActivityIcon aria-hidden="true" />}
            label="Telemetry"
            selected={currentView === "telemetry"}
          />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function withSession(path: string, sessionId?: string) {
  return sessionId ? `${path}?session=${encodeURIComponent(sessionId)}` : path
}

function WorkspaceLink({
  href,
  icon,
  label,
  selected,
}: {
  href: string
  icon: React.ReactNode
  label: string
  selected: boolean
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={selected} tooltip={label}>
        <a href={href}>
          {icon}
          <span>{label}</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
