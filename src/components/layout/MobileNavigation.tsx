"use client";

import {
  Activity,
  CalendarDays,
  ContactRound,
  Dumbbell,
  LayoutDashboard,
  Menu,
  PenSquare,
  Settings,
  Shapes,
  ShieldCheck,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import type { PersonaProfile } from "@/lib/club/persona";

const STAFF_PRIMARY = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/sessions", key: "session", icon: PenSquare },
  { href: "/teams", key: "teams", icon: Users },
  { href: "/planner", key: "planner", icon: CalendarDays },
] as const;

const STAFF_MORE = [
  { href: "/contingent", key: "contingent", icon: ContactRound },
  { href: "/tracking", key: "physical", icon: Activity },
  { href: "/exercises", key: "exercises", icon: Dumbbell },
  { href: "/systems", key: "systems", icon: Shapes },
  { href: "/settings/club", key: "settings", icon: Settings },
] as const;

const FREE_ITEMS = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/sessions", key: "session", icon: PenSquare },
  { href: "/exercises", key: "exercises", icon: Dumbbell },
] as const;

const PLAYER_ITEMS = [
  { href: "/me", key: "playerMe", icon: UserCircle },
  { href: "/team", key: "playerTeam", icon: Users },
  { href: "/schedule", key: "playerSchedule", icon: CalendarDays },
] as const;

type NavItem = {
  href: string;
  key: string;
  icon: typeof LayoutDashboard;
};

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNavigation({
  mode,
  hasMembership = false,
  isAdmin = false,
  activeProfile = "player",
  guardianCount = 0,
}: {
  mode: "staff" | "player";
  hasMembership?: boolean;
  isAdmin?: boolean;
  activeProfile?: PersonaProfile;
  guardianCount?: number;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const meKey =
    activeProfile === "parent"
      ? guardianCount === 1
        ? "parentChild"
        : "parentChildren"
      : "playerMe";

  let primary: readonly NavItem[] = PLAYER_ITEMS;
  let more: NavItem[] = [];
  if (mode === "staff") {
    primary = hasMembership ? STAFF_PRIMARY : FREE_ITEMS;
    more = hasMembership ? [...STAFF_MORE] : [];
    if (isAdmin) {
      more.push({ href: "/admin", key: "admin", icon: ShieldCheck });
    }
  }

  const moreActive = more.some((item) => isCurrent(pathname, item.href));

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 md:hidden dark:bg-black/50" onClick={() => setMoreOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("more")}
            className="absolute inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{t("more")}</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label={t("closeMenu")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {more.map(({ href, key, icon: Icon }) => {
                const active = isCurrent(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium ${
                      active
                        ? "bg-[var(--club-primary)] text-[var(--club-primary-foreground)]"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t(key)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label={t("mobileNavigation")}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-1">
          {primary.map(({ href, key, icon: Icon }) => {
            const active = isCurrent(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium ${
                  active ? "text-[var(--club-primary)]" : "text-zinc-500"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">
                  {t(key === "playerMe" ? meKey : key)}
                </span>
              </Link>
            );
          })}
          {more.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium ${
                moreOpen || moreActive ? "text-[var(--club-primary)]" : "text-zinc-500"
              }`}
            >
              <Menu className="h-5 w-5" />
              <span>{t("more")}</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
