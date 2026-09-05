"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
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
  useSidebar,
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
  PanelLeft,
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
  { href: "/", label: "Follow work", hint: "Progress and what needs your attention", icon: LayoutDashboard },
  { href: "/workstreams", label: "Specs", hint: "Read the plans and their requirements", icon: Workflow },
  { href: "/verify", label: "Evidence", hint: "Inspect checks and their results", icon: ShieldCheck },
]
const MORE: NavItem[] = [
  { href: "/turns", label: "Changes", hint: "What changed, in order", icon: History },
  { href: "/claims", label: "Requirements", hint: "All requirements and supporting checks", icon: Boxes },
  { href: "/compass", label: "Project direction", hint: "Vision and guiding principles", icon: Compass },
  { href: "/features", label: "Features", hint: "Capability map", icon: Layers },
  { href: "/graph", label: "Code map", hint: "Packages and dependencies", icon: GitBranch },
  { href: "/contracts", label: "Technical reference", hint: "Schemas and API", icon: FileJson2 },
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
  const { setOpen } = useSidebar()
  return (
    <li className="group/rail relative min-w-0">
      <Link
        href={href}
        onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && window.matchMedia("(max-width: 47.999rem)").matches) setOpen(false) }}
        aria-label={`${label}: ${hint}`}
        title={hint}
        aria-current={active ? "page" : undefined}
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
  const [open, setOpen] = useState(true)
  useEffect(() => {
    const media = window.matchMedia("(max-width: 47.999rem)")
    const adapt = () => setOpen(!media.matches)
    adapt()
    media.addEventListener("change", adapt)
    return () => media.removeEventListener("change", adapt)
  }, [])
  useEffect(() => { if (window.matchMedia("(max-width: 47.999rem)").matches) setOpen(false) }, [pathname])

  return (
    <SidebarProvider className="spec-ledger-shell h-svh max-h-svh overflow-hidden" open={open} onOpenChange={setOpen}>
      <Sidebar collapsible="offcanvas" className="h-svh shrink-0">
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
          <nav aria-label="Main navigation"><NavGroup label="Workspace" items={WORK} pathname={pathname} /></nav>
          <details key={pathname} open={MORE.some(item => isActive(pathname, item.href))} className="mx-2 mt-4">
            <summary className="cursor-pointer rounded-lg px-3 py-2 text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">More</summary>
            <nav aria-label="More navigation"><NavGroup label="Explore and reference" items={MORE} pathname={pathname} /></nav>
          </details>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
          <SidebarTrigger aria-label="Open navigation" className="shrink-0"><PanelLeft className="size-4" aria-hidden="true" /></SidebarTrigger>
          <nav aria-label="You are here" className="min-w-0 truncate text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">Spec Ledger</Link>
            {pathname !== "/" && <> / <Link href={[...WORK, ...MORE].find(item => item.href !== "/" && isActive(pathname, item.href))?.href ?? "/"} className="hover:underline">{[...WORK, ...MORE].find(item => item.href !== "/" && isActive(pathname, item.href))?.label ?? "Details"}</Link></>}
          </nav>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <DocReaderProvider>{children}</DocReaderProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

