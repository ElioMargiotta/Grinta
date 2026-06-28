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
    <aside className="sticky top-0 hidden h-screen w-16 shrink-0 border-r border-border bg-card md:flex md:flex-col lg:w-60">
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
            <div className="truncate text-sm font-semibold text-foreground">
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
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  active ? "" : "text-muted-foreground group-hover:text-foreground"
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
            className="group relative mt-1 flex items-center justify-center gap-3 rounded-lg px-2 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:justify-start lg:px-3 lg:py-2 lg:text-sm"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            <span className="hidden lg:inline">{t("admin")}</span>
          </Link>
        )}
      </nav>
      <div className="mt-auto hidden border-t border-border px-5 py-5 text-[11px] leading-relaxed text-muted-foreground lg:block">
        <span className="font-medium text-[var(--club-primary)]">{ts("fallbackOrgName")}</span>{" "}
        {ts("footerText")}
      </div>
    </aside>
  );
}
