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
} from "@nessalabs/ui"
import {
  Boxes,
  Compass,
  FileJson2,
  GitBranch,
  History,
  LayoutDashboard,
  Layers,
  ShieldCheck,
  Workflow,
} from "lucide-react"
import { cn } from "@/lib/cn"
import { DocReaderProvider } from "@/components/doc-reader"

type NavItem = {
  href: string
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}

const WORK: NavItem[] = [
  { href: "/", label: "Now", hint: "Active workstream + open turn", icon: LayoutDashboard },
  { href: "/workstreams", label: "Workstreams", hint: "Sealed workstreams", icon: Workflow },
  { href: "/turns", label: "Turns", hint: "What changed, in order", icon: History },
]

const TRUTH: NavItem[] = [
  { href: "/claims", label: "Claims", hint: "Standing must-stay-true", icon: ShieldCheck },
  { href: "/verify", label: "Verify", hint: "Live pass/fail report", icon: Boxes },
]

const MORE: NavItem[] = [
  { href: "/compass", label: "Compass", hint: "Vision, tenets, themes", icon: Compass },
  { href: "/features", label: "Features", hint: "Capability map", icon: Layers },
  { href: "/graph", label: "Graph", hint: "Packages & edges", icon: GitBranch },
  { href: "/contracts", label: "Contracts", hint: "Schemas + HTTP API", icon: FileJson2 },
]

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function RailNavItem({
  href,
  label,
  hint,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
}) {
  return (
    <li className="group/rail relative min-w-0">
      <Link
        href={href}
        aria-label={`${label}: ${hint}`}
        title={hint}
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
        <span className="min-w-0 flex-1 truncate group-data-[state=collapsed]/sidebar:sr-only">
          {label}
        </span>
      </Link>
      <PopoverSurface
        role="tooltip"
        elevation="xl"
        radius="lg"
        className={cn(
          "pointer-events-none absolute start-full top-1/2 z-50 ms-2 -translate-y-1/2 px-2.5 py-1.5",
          "max-w-48 text-xs font-medium",
          "hidden group-data-[state=collapsed]/sidebar:group-hover/rail:block",
          "group-data-[state=collapsed]/sidebar:group-focus-within/rail:block",
        )}
      >
        <span className="block">{label}</span>
        <span className="mt-0.5 block font-normal text-muted-foreground">{hint}</span>
      </PopoverSurface>
    </li>
  )
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string
  items: NavItem[]
  pathname: string
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <ul className="flex w-full min-w-0 list-none flex-col gap-0.5 p-0">
          {items.map((item) => (
            <RailNavItem
              key={item.href}
              href={item.href}
              label={item.label}
              hint={item.hint}
              icon={item.icon}
              active={isActive(pathname, item.href)}
            />
          ))}
        </ul>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/** App chrome for Spec Ledger (read-only viewing). */
export function SpecLedgerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <SidebarProvider className="spec-ledger-shell h-svh max-h-svh overflow-hidden" defaultOpen>
      <Sidebar collapsible="icon" className="h-svh shrink-0">
        <SidebarHeader className="gap-2 border-b border-sidebar-border px-3 py-3">
          <div className="group/brand relative flex items-center gap-2">
            <SidebarTrigger
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <span aria-hidden className="text-sm leading-none">
                ◼
              </span>
            </SidebarTrigger>
            <div className="min-w-0 group-data-[state=collapsed]/sidebar:hidden">
              <Link
                href="/"
                className="block text-sm tracking-tight text-sidebar-foreground no-underline"
                aria-label="specLedger"
              >
                <span className="font-semibold">spec</span>
                <span className="font-normal">Ledger</span>
              </Link>
            </div>
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
          <NavGroup label="Browse" items={WORK} pathname={pathname} />
          <NavGroup label="Truth" items={TRUTH} pathname={pathname} />
          <NavGroup label="More" items={MORE} pathname={pathname} />
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <DocReaderProvider>{children}</DocReaderProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

