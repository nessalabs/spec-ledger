"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

export type Theme = "light" | "dark"

const STORAGE_KEY = "spec-ledger-theme"

/**
 * Applied before paint by the inline script in the root layout and again on
 * every toggle, so the class on <html> is the single source of truth.
 */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
  document.documentElement.style.colorScheme = theme
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
  }, [])

  function choose(next: Theme) {
    setTheme(next)
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private browsing can refuse storage; the class still applies this session.
    }
  }

  // Render nothing until the client has read the resolved theme, so the button
  // never claims the wrong state during hydration.
  if (!theme) return <span className="size-7" aria-hidden />

  const next = theme === "dark" ? "light" : "dark"
  const Icon = theme === "dark" ? Sun : Moon
  return (
    <button
      type="button"
      onClick={() => choose(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  )
}
