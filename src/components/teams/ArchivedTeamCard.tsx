"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  restoreTeamAction,
  permanentlyDeleteTeamAction,
} from "@/app/[locale]/(app)/teams/actions";

type ArchivedTeam = {
  id: string;
  name: string;
  season: string | null;
  age_group: string | null;
  archived_at: string;
};

export function ArchivedTeamCard({ team }: { team: ArchivedTeam }) {
  const locale = useLocale();
  const t = useTranslations("teams.archived");
  const tc = useTranslations("common");
  const [purging, setPurging] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canPurge = typed.trim() === team.name.trim();
  const archivedDate = new Date(team.archived_at).toLocaleDateString(locale);

  const restore = () => {
    setError(null);
    const fd = new FormData();
    fd.set("teamId", team.id);
    fd.set("locale", locale);
    startTransition(async () => {
      try {
        await restoreTeamAction(fd);
      } catch (e) {
        const msg = e instanceof Error ? e.message : tc("unknownError");
        if (!msg.includes("NEXT_REDIRECT")) setError(msg);
      }
    });
  };

  const purge = () => {
    setError(null);
    if (!canPurge) return;
    const fd = new FormData();
    fd.set("teamId", team.id);
    fd.set("locale", locale);
    startTransition(async () => {
      try {
        await permanentlyDeleteTeamAction(fd);
      } catch (e) {
        const msg = e instanceof Error ? e.message : tc("unknownError");
        if (!msg.includes("NEXT_REDIRECT")) setError(msg);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {team.name}
          </div>
          <div className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {[team.age_group, team.season].filter(Boolean).join(" · ") || "—"}
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {t("archivedOn", { date: archivedDate })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={restore}
            disabled={isPending}
          >
            <RotateCcw className="h-4 w-4" />
            {t("restore")}
          </Button>
          {!purging ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPurging(true)}
              disabled={isPending}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              {t("deletePermanently")}
            </Button>
          ) : null}
        </div>
      </div>

      {purging && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm dark:border-red-500/30 dark:bg-red-950/30">
          <div className="font-medium text-red-900 dark:text-red-100">
            {t("purgeTitle")}
          </div>
          <p className="mt-1 text-red-800 dark:text-red-300">
            {t("purgeWarning")}
          </p>
          <label className="mt-3 flex flex-col gap-1 text-zinc-900 dark:text-zinc-100">
            <span>
              {t.rich("typeNameToConfirm", {
                name: team.name,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </span>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/15 dark:border-zinc-700 dark:bg-zinc-900"
              autoFocus
            />
          </label>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={purge}
              disabled={!canPurge || isPending}
            >
              {isPending ? t("purging") : t("deletePermanently")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPurging(false);
                setTyped("");
                setError(null);
              }}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
