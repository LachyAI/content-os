'use client'

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Grid2X2,
  BarChart2,
  Newspaper,
  CalendarDays,
  Menu,
  X,
  PlayCircle,
} from "lucide-react";

const navItems = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Competitors", href: "/competitors", icon: Users },
  { label: "Instagram", href: "/instagram", icon: Grid2X2 },
  { label: "YouTube", href: "/youtube", icon: PlayCircle },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Analytics", href: "/analytics", icon: BarChart2 },
  { label: "News", href: "/news", icon: Newspaper },
];

function NavItems({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon
              size={16}
              className={cn(
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentPage = navItems.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  )?.label ?? "Content Manager";

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center h-12 px-4 border-b border-sidebar-border bg-sidebar">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="ml-3 text-sm font-semibold">
          Content <span className="text-primary">Manager</span>
          <span className="ml-2 text-muted-foreground font-normal">— {currentPage}</span>
        </span>
      </div>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-sidebar h-full flex flex-col border-r border-sidebar-border">
            <div className="px-4 py-4 border-b border-sidebar-border flex items-center justify-between">
              <span className="text-sm font-semibold tracking-tight text-foreground">
                Content <span className="text-primary">Manager</span>
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>
            <nav className="flex-1 px-2 py-4 space-y-0.5">
              <NavItems pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </nav>
            <div className="px-4 py-4 border-t border-sidebar-border">
              <p className="text-xs text-muted-foreground">v0.1.0</p>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 bg-sidebar border-r border-sidebar-border flex-col min-h-screen">
        <div className="px-4 py-5 border-b border-sidebar-border">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Content <span className="text-primary">Manager</span>
          </span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          <NavItems pathname={pathname} />
        </nav>

        <div className="px-4 py-4 border-t border-sidebar-border">
          <p className="text-xs text-muted-foreground">v0.1.0</p>
        </div>
      </aside>
    </>
  );
}
