"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  PopoverSurface,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  CodeBlockProvider,
} from "@nessa-ui/react"
import {
  Boxes,
  Compass,
  FileJson2,
  GitBranch,
  History,
  LayoutDashboard,
  Layers,
  ShieldCheck,
  Timer,
} from "lucide-react"
import { cn } from "@/lib/cn"

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/compass", label: "Compass", icon: Compass },
  { href: "/timeline", label: "Timeline", icon: Timer },
  { href: "/claims", label: "Claims", icon: ShieldCheck },
  { href: "/features", label: "Features", icon: Layers },
  { href: "/contracts", label: "Contracts", icon: FileJson2 },
  { href: "/graph", label: "Graph", icon: GitBranch },
  { href: "/turns", label: "Turns", icon: History },
  { href: "/verify", label: "Verify", icon: Boxes },
] as const

function RailNavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
}) {
  return (
    <li className="group/rail relative min-w-0">
      <Link
        href={href}
        aria-label={label}
        data-active={active || undefined}
        className={cn(
          "relative flex w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground no-underline outline-none transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
          "data-[active]:bg-sidebar-accent data-[active]:font-medium data-[active]:text-sidebar-accent-foreground",
          "group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate group-data-[state=collapsed]/sidebar:sr-only">
          {label}
        </span>
      </Link>
      <PopoverSurface
        role="tooltip"
        elevation="xl"
        radius="lg"
        className={cn(
          "pointer-events-none absolute start-full top-1/2 z-50 ms-2 -translate-y-1/2 px-2.5 py-1.5",
          "whitespace-nowrap text-xs font-medium",
          "hidden group-data-[state=collapsed]/sidebar:group-hover/rail:block",
          "group-data-[state=collapsed]/sidebar:group-focus-within/rail:block",
        )}
      >
        {label}
      </PopoverSurface>
    </li>
  )
}

export function LatticeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <SidebarProvider className="h-svh max-h-svh overflow-hidden" defaultOpen>
      <Sidebar collapsible="icon" className="h-svh shrink-0">
        <SidebarHeader className="gap-2 border-b border-sidebar-border px-3 py-3">
          <div className="group/brand relative flex items-center gap-2">
            {/* Small ◼ only — toggles the rail. No full-width button chrome. */}
            <SidebarTrigger
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <span aria-hidden className="text-sm leading-none">
                ◼
              </span>
            </SidebarTrigger>
            <Link
              href="/"
              className="min-w-0 text-sm font-semibold tracking-tight text-sidebar-foreground no-underline group-data-[state=collapsed]/sidebar:hidden"
            >
              spec<span className="font-normal text-muted-foreground">ledger</span>
            </Link>
            <PopoverSurface
              role="tooltip"
              elevation="xl"
              radius="lg"
              className={cn(
                "pointer-events-none absolute start-full top-1/2 z-50 ms-2 -translate-y-1/2 px-2.5 py-1.5",
                "whitespace-nowrap text-xs font-medium",
                "hidden group-data-[state=collapsed]/sidebar:group-hover/brand:block",
                "group-data-[state=collapsed]/sidebar:group-focus-within/brand:block",
              )}
            >
              Spec Ledger
            </PopoverSurface>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigate</SidebarGroupLabel>
            <SidebarGroupContent>
              <ul className="flex w-full min-w-0 list-none flex-col gap-0.5 p-0">
                {NAV.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href)
                  return (
                    <RailNavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      active={active}
                    />
                  )
                })}
              </ul>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="min-h-0 overflow-hidden">
        <CodeBlockProvider mode="dark">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
            {children}
          </div>
        </CodeBlockProvider>
      </SidebarInset>
    </SidebarProvider>
  )
}
