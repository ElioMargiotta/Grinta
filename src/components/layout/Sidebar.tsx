"use client";

import { CalendarDays, Dumbbell, LayoutDashboard, PenSquare, Settings, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";

// Free-tier (no club) sees only dashboard + their solo session + library.
// Club-affiliated members also see teams, planner, and club settings.
const FREE_ITEMS = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/sessions", key: "session", icon: PenSquare },
  { href: "/exercises", key: "exercises", icon: Dumbbell },
] as const;

const CLUB_ITEMS = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/sessions", key: "session", icon: PenSquare },
  { href: "/teams", key: "teams", icon: Users },
  { href: "/exercises", key: "exercises", icon: Dumbbell },
  { href: "/planner", key: "planner", icon: CalendarDays },
  { href: "/settings/club", key: "settings", icon: Settings },
] as const;

export function Sidebar({ hasMembership }: { hasMembership: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = hasMembership ? CLUB_ITEMS : FREE_ITEMS;

  return (
    <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white md:flex md:flex-col dark:border-zinc-800 dark:bg-zinc-950">
      <div className="px-4 py-5">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2 overflow-hidden"
        >
          <Image
            src="/grinta-icon.svg"
            alt="Grinta"
            width={36}
            height={36}
            priority
            className="h-9 w-9 shrink-0"
          />
          <Image
            src="/grinta-wordmark.svg"
            alt="Grinta"
            width={120}
            height={28}
            priority
            className="h-6 w-auto max-w-[140px] object-contain"
          />
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5 px-3">
        {items.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  active ? "" : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200"
                }`}
              />
              <span>{t(key)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-5 py-5 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
        Plan, prepare and print elite training sessions.
      </div>
    </aside>
  );
}
