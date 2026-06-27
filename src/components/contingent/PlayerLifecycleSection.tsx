"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Section, SectionHeader } from "@/components/ui/Section";
import {
  setPlayerStatusAction,
  removeGuardianAction,
  type PlayerStatus,
} from "@/app/[locale]/(app)/contingent/lifecycle-actions";

export type GuardianRow = { id: string; relation: string; name: string | null };

const STATUSES: PlayerStatus[] = ["active", "inactive", "left", "archived"];

// Cycle de vie de la fiche (statut) + gestion des liens parents/tuteurs (Lot D).
export function PlayerLifecycleSection({
  locale,
  playerId,
  status,
  guardians,
}: {
  locale: string;
  playerId: string;
  status: PlayerStatus;
  guardians: GuardianRow[];
}) {
  const t = useTranslations("invitePlayer");
  const router = useRouter();
  const [current, setCurrent] = useState<PlayerStatus>(status);
  const [isPending, startTransition] = useTransition();

  function changeStatus(next: PlayerStatus) {
    if (next === current) return;
    if (
      (next === "left" || next === "archived") &&
      !window.confirm(t(`lifecycle.confirm_${next}`))
    )
      return;
    setCurrent(next);
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("playerId", playerId);
    fd.set("status", next);
    startTransition(async () => {
      await setPlayerStatusAction(fd);
      router.refresh();
    });
  }

  function removeGuardian(guardianId: string) {
    if (!window.confirm(t("lifecycle.removeGuardianConfirm"))) return;
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("playerId", playerId);
    fd.set("guardianId", guardianId);
    startTransition(async () => {
      await removeGuardianAction(fd);
      router.refresh();
    });
  }

  return (
    <Section>
      <SectionHeader icon={Activity} title={t("lifecycle.title")} className="mb-3" />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("lifecycle.statusLabel")}
        </span>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => {
            const active = current === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => changeStatus(s)}
                disabled={isPending}
                aria-pressed={active}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-[var(--club-primary)] bg-[var(--club-primary-soft)] text-[var(--club-primary)]"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                }`}
              >
                {t(`status.${s}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 border-t border-[var(--club-line)] pt-4">
        <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("lifecycle.guardiansTitle")}
        </h3>
        {guardians.length === 0 ? (
          <p className="text-xs text-zinc-500">{t("lifecycle.noGuardians")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {guardians.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="truncate text-zinc-900 dark:text-zinc-100">
                  {g.name ?? t("lifecycle.guardianUnnamed")}
                </span>
                <button
                  type="button"
                  onClick={() => removeGuardian(g.id)}
                  disabled={isPending}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <X className="h-3 w-3" />
                  {t("lifecycle.removeGuardian")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
