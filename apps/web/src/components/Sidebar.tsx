"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Music,
  Clapperboard,
  Film,
  Calendar,
  Settings,
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

  return (
    <aside className="w-56 shrink-0 bg-sidebar-gradient border-r border-surface-border flex flex-col">
      <div className="p-4 border-b border-surface-border">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-90">
          <Image
            src="/logo.png"
            alt="setmix.er"
            width={44}
            height={44}
            className="rounded-full shrink-0 shadow-glow"
            priority
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warm-50 tracking-wide truncate">setmix.er</p>
            <p className="text-xs text-warm-500 truncate">Generator</p>
          </div>
        </Link>
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
    </aside>
  );
}
