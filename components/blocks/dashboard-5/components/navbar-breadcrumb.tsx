import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export function NavbarBreadcrumb() {
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="hidden md:inline-flex">
          <BreadcrumbLink asChild>
            <a href="/chat">Workspace</a>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator className="hidden md:flex" />

        <BreadcrumbItem className="hidden md:inline-flex">
          <BreadcrumbLink asChild>
            <a href="/chat/telemetry">Edge Security</a>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator className="hidden md:flex" />

        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate">Telemetry</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
