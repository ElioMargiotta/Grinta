"use client";

import { CalendarDays, Dumbbell, LayoutDashboard, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const items = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/teams", key: "teams", icon: Users },
  { href: "/exercises", key: "exercises", icon: Dumbbell },
  { href: "/planner", key: "planner", icon: CalendarDays },
] as const;

export function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white md:flex md:flex-col dark:border-zinc-800 dark:bg-zinc-950">
      <div className="px-5 py-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white shadow-sm dark:bg-white dark:text-zinc-900">
            G
          </span>
          <span className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Grinta
          </span>
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
