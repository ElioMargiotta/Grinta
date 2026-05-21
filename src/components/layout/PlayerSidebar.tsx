"use client";

import { CalendarDays, UserCircle, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import type { ClubMembership } from "@/lib/club/types";

// Minimal player-side nav. The player is read-only on their own record and
// consults the schedule / teams of clubs they are licensed at.
const PLAYER_ITEMS = [
  { href: "/me", key: "playerMe", icon: UserCircle },
  { href: "/team", key: "playerTeam", icon: Users },
  { href: "/schedule", key: "playerSchedule", icon: CalendarDays },
] as const;

export function PlayerSidebar({
  currentMembership,
}: {
  currentMembership: ClubMembership | null;
}) {
  const t = useTranslations("nav");
  const ts = useTranslations("sidebar");
  const pathname = usePathname();
  const logoUrl = currentMembership?.logo_url;

  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--club-line)] bg-white/[0.92] md:flex md:flex-col dark:border-zinc-800 dark:bg-zinc-950">
      <div className="px-4 py-5">
        <Link
          href="/me"
          className="flex min-w-0 items-center gap-2 overflow-hidden"
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
          <div className="min-w-0">
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
      <nav className="flex flex-col gap-0.5 px-3">
        {PLAYER_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--club-primary)] text-[var(--club-primary-foreground)] shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  active
                    ? ""
                    : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200"
                }`}
              />
              <span>{t(key)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-[var(--club-line)] px-5 py-5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
        <span className="font-medium text-[var(--club-primary)]">{ts("fallbackOrgName")}</span>{" "}
        {ts("footerText")}
      </div>
    </aside>
  );
}
