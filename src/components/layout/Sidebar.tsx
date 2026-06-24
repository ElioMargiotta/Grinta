"use client";

import { Activity, CalendarDays, ContactRound, Dumbbell, LayoutDashboard, PenSquare, Settings, Shapes, ShieldCheck, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import type { ClubMembership } from "@/lib/club/types";

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
  { href: "/contingent", key: "contingent", icon: ContactRound },
  { href: "/tracking", key: "physical", icon: Activity },
  { href: "/exercises", key: "exercises", icon: Dumbbell },
  { href: "/planner", key: "planner", icon: CalendarDays },
  { href: "/systems", key: "systems", icon: Shapes },
  { href: "/settings/club", key: "settings", icon: Settings },
] as const;

export function Sidebar({
  hasMembership,
  currentMembership,
  isAdmin = false,
}: {
  hasMembership: boolean;
  currentMembership: ClubMembership | null;
  isAdmin?: boolean;
}) {
  const t = useTranslations("nav");
  const ts = useTranslations("sidebar");
  const pathname = usePathname();
  const items = hasMembership ? CLUB_ITEMS : FREE_ITEMS;
  const logoUrl = currentMembership?.logo_url;

  return (
    <aside className="sticky top-0 hidden h-screen w-16 shrink-0 border-r border-[var(--club-line)] bg-white md:flex md:flex-col lg:w-60 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="px-2 py-4 lg:px-4 lg:py-5">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center justify-center gap-2 overflow-hidden lg:justify-start"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={currentMembership?.club_name ?? ts("fallbackClubName")}
              className="h-10 w-10 shrink-0 rounded-md object-contain"
            />
          ) : (
            <Image
              src="/documents/svg/grinta-icon.svg"
              alt="Grinta"
              width={36}
              height={36}
              priority
              className="h-9 w-9 shrink-0"
            />
          )}
          <div className="hidden min-w-0 lg:block">
            <div className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-100">
              {currentMembership?.club_name ?? ts("fallbackOrgName")}
            </div>
            <Image
              src="/documents/svg/grinta-wordmark.svg"
              alt="Grinta"
              width={86}
              height={20}
              priority
              className="mt-0.5 h-4 w-auto max-w-[86px] object-contain"
            />
          </div>
        </Link>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 lg:gap-0.5 lg:px-3">
        {items.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={t(key)}
              aria-label={t(key)}
              className={`group relative flex items-center justify-center gap-3 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors lg:justify-start lg:px-3 lg:py-2 lg:text-sm ${
                  active
                  ? "bg-[var(--club-primary)] text-[var(--club-primary-foreground)] shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  active ? "" : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200"
                }`}
              />
              <span className="hidden lg:inline">{t(key)}</span>
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            title={t("admin")}
            aria-label={t("admin")}
            className="group relative mt-1 flex items-center justify-center gap-3 rounded-lg px-2 py-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 lg:justify-start lg:px-3 lg:py-2 lg:text-sm dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200" />
            <span className="hidden lg:inline">{t("admin")}</span>
          </Link>
        )}
      </nav>
      <div className="mt-auto hidden border-t border-[var(--club-line)] px-5 py-5 text-[11px] leading-relaxed text-zinc-500 lg:block dark:text-zinc-500">
        <span className="font-medium text-[var(--club-primary)]">{ts("fallbackOrgName")}</span>{" "}
        {ts("footerText")}
      </div>
    </aside>
  );
}
