"use client";

import { LogOut, UserCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/app/[locale]/(app)/actions";
import { ClubSwitcher } from "./ClubSwitcher";
import { PersonaSwitcher } from "./PersonaSwitcher";
import { LocaleSwitcher } from "./LocaleSwitcher";
import type { ClubMembership } from "@/lib/club/types";
import type { PersonaState } from "@/lib/club/persona";

const PRICE_PER_TEAM_CHF = 12;

function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function Topbar({
  userName,
  currentMembership,
  memberships,
  teamCount,
  persona,
}: {
  userName: string;
  currentMembership: ClubMembership | null;
  memberships: ClubMembership[];
  teamCount: number;
  persona?: PersonaState | null;
}) {
  const t = useTranslations("nav");
  const tp = useTranslations("topbar");
  const [isPending, startTransition] = useTransition();

  let subtitle: string;
  if (!currentMembership) {
    subtitle = tp("freePlan");
  } else {
    const teamWord = teamCount === 1 ? tp("teamSingular") : tp("teamPlural");
    const status = currentMembership.subscription_status;
    if (status === "trialing") {
      const days = daysUntil(currentMembership.trial_ends_at);
      subtitle = days === null ? tp("trial") : tp("trialDays", { days });
      subtitle += ` · ${teamCount} ${teamWord}`;
    } else if (status === "active") {
      const monthly = teamCount * PRICE_PER_TEAM_CHF;
      subtitle = tp("planPerTeam", { count: teamCount, teams: teamWord, amount: monthly });
    } else {
      subtitle = tp("planStatus", { status, count: teamCount, teams: teamWord });
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--club-line)] bg-white/[0.82] px-4 backdrop-blur md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--club-primary)] text-xs font-semibold text-[var(--club-primary-foreground)]">
          {initials(userName)}
        </span>
        <div className="leading-tight">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {userName || tp("fallbackName")}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </div>
        </div>
        {currentMembership && persona?.active !== "player" && (
          <div className="ml-2">
            <ClubSwitcher current={currentMembership} memberships={memberships} />
          </div>
        )}
        {persona?.available === "dual" && (
          <div className="ml-2">
            <PersonaSwitcher active={persona.active} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <LocaleSwitcher variant="subtle" />
        <Link
          href="/account"
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <UserCog className="h-4 w-4" />
          <span className="hidden sm:inline">{t("account")}</span>
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
          {t("logout")}
        </Button>
      </div>
    </header>
  );
}
