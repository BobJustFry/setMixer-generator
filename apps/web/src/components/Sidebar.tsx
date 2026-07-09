"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Music,
  Clapperboard,
  Film,
  Calendar,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
  { href: "/mixes", label: "Миксы", icon: Music },
  { href: "/jobs", label: "Задачи", icon: Clapperboard },
  { href: "/videos", label: "Видео", icon: Film },
  { href: "/schedule", label: "Расписание", icon: Calendar },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-56 shrink-0 bg-sidebar-gradient border-r border-surface-border flex flex-col">
      <div className="p-5 border-b border-surface-border">
        <h1 className="text-sm font-semibold text-warm-50 tracking-wide">
          SetMixer
        </h1>
        <p className="text-xs text-warm-500 mt-0.5">Generator</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-accent/10 text-accent border border-accent/20"
                : "text-warm-400 hover:text-warm-100 hover:bg-surface-overlay"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-surface-border">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-warm-500 hover:text-warm-300 hover:bg-surface-overlay w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>
    </aside>
  );
}
