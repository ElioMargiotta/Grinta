"use client";

import { CalendarDays, UserCircle, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import { ClubLogos } from "@/components/club/ClubLogos";
import type { ClubMembership } from "@/lib/club/types";
import type { PersonaProfile } from "@/lib/club/persona";

// Minimal player-side nav. The player is read-only on their own record and
// consults the schedule / teams of clubs they are licensed at.
const PLAYER_ITEMS = [
  { href: "/me", key: "playerMe", icon: UserCircle },
  { href: "/team", key: "playerTeam", icon: Users },
  { href: "/schedule", key: "playerSchedule", icon: CalendarDays },
] as const;

export function PlayerSidebar({
  currentMembership,
  activeProfile,
  guardianCount,
}: {
  currentMembership: ClubMembership | null;
  activeProfile: PersonaProfile;
  guardianCount: number;
}) {
  const t = useTranslations("nav");
  const ts = useTranslations("sidebar");
  const pathname = usePathname();
  const logos = currentMembership?.logos ?? [];
  const meKey =
    activeProfile === "parent"
      ? guardianCount === 1
        ? "parentChild"
        : "parentChildren"
      : "playerMe";

  return (
    <aside className="sticky top-0 hidden h-screen w-16 shrink-0 border-r border-border bg-card md:flex md:flex-col lg:w-60">
      <div className="px-2 py-4 lg:px-4 lg:py-5">
        <Link
          href="/me"
          className="flex min-w-0 items-center justify-center gap-2 overflow-hidden lg:justify-start"
        >
          <ClubLogos
            logos={logos}
            alt={currentMembership?.club_name ?? ts("fallbackClubName")}
            imgClassName="h-10 w-10 rounded-md"
            fallback={
              <Image
                src="/documents/svg/grinta-icon.svg"
                alt="Grinta"
                width={36}
                height={36}
                priority
                className="h-9 w-9 shrink-0"
              />
            }
          />
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
        {PLAYER_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={t(key === "playerMe" ? meKey : key)}
              aria-label={t(key === "playerMe" ? meKey : key)}
              className={`group relative flex items-center justify-center gap-3 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors lg:justify-start lg:px-3 lg:py-2 lg:text-sm ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  active
                    ? ""
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              />
              <span className="hidden lg:inline">
                {t(key === "playerMe" ? meKey : key)}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden border-t border-border px-5 py-5 text-[11px] leading-relaxed text-muted-foreground lg:block">
        <span className="font-medium text-[var(--club-primary)]">{ts("fallbackOrgName")}</span>{" "}
        {ts("footerText")}
      </div>
    </aside>
  );
}
