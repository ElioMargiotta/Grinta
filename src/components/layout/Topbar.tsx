"use client";

import { LogOut, UserCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/app/[locale]/(app)/actions";
import { ClubSwitcher } from "./ClubSwitcher";
import { SeasonSwitcher } from "./SeasonSwitcher";
import { PersonaSwitcher } from "./PersonaSwitcher";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { NotificationBell } from "./NotificationBell";
import type { ClubMembership } from "@/lib/club/types";
import type { PersonaState } from "@/lib/club/persona";
import type { LicenseUsage } from "@/lib/license/types";
import type { NotificationRow, NotificationView } from "@/lib/notifications/types";
import { ThemeToggle } from "./ThemeToggle";

export type TopbarNotifications = {
  userId: string;
  view: NotificationView;
  items: NotificationRow[];
  unread: number;
};

function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Topbar({
  userName,
  currentMembership,
  memberships,
  licenseUsage,
  persona,
  currentSeason,
  seasons,
  notifications,
}: {
  userName: string;
  currentMembership: ClubMembership | null;
  memberships: ClubMembership[];
  licenseUsage?: LicenseUsage | null;
  persona?: PersonaState | null;
  currentSeason?: string | null;
  seasons?: string[];
  notifications?: TopbarNotifications | null;
}) {
  const t = useTranslations("nav");
  const tp = useTranslations("topbar");
  const [isPending, startTransition] = useTransition();

  // Subtitle = licence usage. Shows the team count against its cap (or just the
  // count when unlimited), plus a read-only marker while in the grace window.
  let subtitle: string;
  if (persona?.active === "player") {
    subtitle =
      persona.activeProfile === "parent"
        ? t(persona.profiles.includes("player") ? "parentChildren" : "parentChild")
        : t("playerMe");
  } else if (!currentMembership || !licenseUsage) {
    subtitle = tp("noLicense");
  } else {
    const teams = licenseUsage.teams;
    const teamWord = teams === 1 ? tp("teamSingular") : tp("teamPlural");
    subtitle =
      licenseUsage.max_teams === null
        ? `${teams} ${teamWord}`
        : tp("teamsOfMax", { count: teams, max: licenseUsage.max_teams, teams: teamWord });
    if (licenseUsage.state === "grace") {
      subtitle = `${tp("readOnly")} · ${subtitle}`;
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center justify-between gap-2 border-b border-[var(--club-line)] bg-white/95 px-3 backdrop-blur sm:px-4 lg:px-6 dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="flex min-w-0 items-center gap-2 lg:gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--club-primary)] text-xs font-semibold text-[var(--club-primary-foreground)]">
          {initials(userName)}
        </span>
        <div className="hidden min-w-0 leading-tight xl:block">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {userName || tp("fallbackName")}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </div>
        </div>
        {currentMembership && persona?.active !== "player" && (
          <div className="hidden min-w-0 md:block lg:ml-1">
            <ClubSwitcher current={currentMembership} memberships={memberships} />
          </div>
        )}
        {currentMembership && persona?.active !== "player" && currentSeason && (
          <div className="hidden md:block lg:ml-1">
            <SeasonSwitcher current={currentSeason} seasons={seasons ?? []} />
          </div>
        )}
        {persona && persona.profiles.length > 1 && (
          <div className="hidden lg:ml-1 lg:block">
            <PersonaSwitcher
              active={persona.activeProfile}
              profiles={persona.profiles}
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        {notifications && (
          <NotificationBell
            userId={notifications.userId}
            view={notifications.view}
            initialItems={notifications.items}
            initialUnread={notifications.unread}
          />
        )}
        <ThemeToggle />
        <LocaleSwitcher variant="subtle" />
        <Link
          href="/account"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 sm:w-auto sm:gap-1.5 sm:px-2 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <UserCog className="h-4 w-4" />
          <span className="hidden lg:inline">{t("account")}</span>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            startTransition(async () => {
              await logoutAction();
            })
          }
          loading={isPending}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden lg:inline">{t("logout")}</span>
        </Button>
      </div>
    </header>
  );
}
