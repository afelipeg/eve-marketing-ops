"use client"

import { useState, type ReactNode } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { MoreHorizontalIcon, RefreshCwIcon, DownloadIcon, SettingsIcon, PlusIcon } from "lucide-react"

const WORKSPACE_NAME = "Marketing Ops"

export function AppHeader({
  actions,
  currentPage = "Chat",
}: {
  actions?: ReactNode
  currentPage?: string
}) {
  const [autoRefresh, setAutoRefresh] = useState(true)

  return (
    <header className="border-border/60 bg-background/95 sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4 backdrop-blur-sm">
      {/* Left - mobile trigger + breadcrumb */}
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {/* Workspace */}
            <BreadcrumbItem className="flex min-w-0">
              <BreadcrumbLink
                href="/chat"
                className="flex min-w-0 items-center gap-1.5"
                aria-label={WORKSPACE_NAME}
              >
                <span className="hidden truncate lg:inline">
                  {WORKSPACE_NAME}
                </span>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="shrink-0" />

            {/* User */}
            <BreadcrumbItem className="flex min-w-0">
              <BreadcrumbLink
                href="/chat"
                className="flex min-w-0 items-center gap-1.5"
                aria-label="Marketing Ops"
              >
                <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-semibold">
                  MO
                </div>
                <span className="hidden truncate md:inline">Marketing Ops</span>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="shrink-0" />

            {/* Current page */}
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate">{currentPage}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right - actions */}
      <div className="flex shrink-0 items-center gap-3">
        {actions}
        <div className="flex items-center gap-1">
          <Label className="hidden sm:flex">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              size="sm"
              aria-label="Auto refresh"
            />
            Auto Refresh
          </Label>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="More options"
                className="text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontalIcon aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem>
                <RefreshCwIcon aria-hidden="true" />
                Refresh
              </DropdownMenuItem>
              <DropdownMenuItem>
                <DownloadIcon aria-hidden="true" />
                Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <SettingsIcon aria-hidden="true" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button size="sm" asChild>
          <a href="/chat?new=1">
            <PlusIcon aria-hidden="true" />
            New Brief
          </a>
        </Button>
      </div>
    </header>
  )
}
