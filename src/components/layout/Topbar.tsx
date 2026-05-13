"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/app/[locale]/(app)/actions";
import { ClubSwitcher } from "./ClubSwitcher";
import type { ClubMembership } from "@/lib/club/types";

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

function planSubtitle(
  membership: ClubMembership | null,
  teamCount: number,
): string {
  if (!membership) return "Plan gratuit";

  const team = teamCount === 1 ? "équipe" : "équipes";
  const status = membership.subscription_status;

  if (status === "trialing") {
    const days = daysUntil(membership.trial_ends_at);
    const trial = days === null ? "Essai" : `Essai · ${days}j restants`;
    return `${trial} · ${teamCount} ${team}`;
  }

  if (status === "active") {
    const monthly = teamCount * PRICE_PER_TEAM_CHF;
    return `${teamCount} ${team} · ${monthly} CHF/mois`;
  }

  return `${status} · ${teamCount} ${team}`;
}

export function Topbar({
  userName,
  currentMembership,
  memberships,
  teamCount,
}: {
  userName: string;
  currentMembership: ClubMembership | null;
  memberships: ClubMembership[];
  teamCount: number;
}) {
  const t = useTranslations("nav");
  const [isPending, startTransition] = useTransition();
  const subtitle = planSubtitle(currentMembership, teamCount);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--club-line)] bg-white/82 px-4 backdrop-blur md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--club-primary)] text-xs font-semibold text-[var(--club-primary-foreground)]">
          {initials(userName)}
        </span>
        <div className="leading-tight">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {userName || "Coach"}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </div>
        </div>
        {currentMembership && (
          <div className="ml-2">
            <ClubSwitcher current={currentMembership} memberships={memberships} />
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          startTransition(async () => {
            await logoutAction();
          })
        }
        disabled={isPending}
      >
        <LogOut className="h-4 w-4" />
        {t("logout")}
      </Button>
    </header>
  );
}
