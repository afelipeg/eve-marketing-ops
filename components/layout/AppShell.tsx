"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Brain,
  Shield,
  Target,
  Zap,
  Menu,
  X,
  Bot,
  GitBranch,
  AlertTriangle,
  Clock,
  PanelRight,
  Scale,
  FileText,
  Users,
  Cpu,
  Zap as ZapIcon,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { SidebarNav } from "./SidebarNav"
import { RightSidebar } from "./RightSidebar"
import { ChatPanel } from "@/components/chat/ChatPanel"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Orchestrator", href: "/dashboard/orchestrator", icon: Brain },
  { name: "Chat", href: "/chat", icon: MessageSquare },
  { name: "Measurement", href: "/dashboard/measurement", icon: BarChart3 },
  { name: "Guardrails", href: "/dashboard/guardrails", icon: Shield },
  { name: "MOAT", href: "/dashboard/moat", icon: Target },
  { name: "Directives", href: "/dashboard/directives", icon: CheckCircle2 },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function AppShell() {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="h-16 px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">Marketing Ops</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav navigation={navigation} />
        </SidebarContent>
        <SidebarFooter className="p-4">
          <SidebarTrigger className="w-full justify-center" />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
          <div className="flex h-full items-center gap-4 px-4">
            <SidebarTrigger className="-ml-2" />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">JEV Ready</span>
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <div className="flex h-[calc(100vh-4rem)]">
            <div className="flex-1 min-w-0 flex flex-col">
              <ChatPanel />
            </div>

            <RightSidebar />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}