"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLoading } from "@/components/ui/LoadingProvider";
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
  const { run } = useLoading();

  const canPurge = typed.trim() === team.name.trim();
  const archivedDate = new Date(team.archived_at).toLocaleDateString(locale);

  const restore = () => {
    setError(null);
    const fd = new FormData();
    fd.set("teamId", team.id);
    fd.set("locale", locale);
    startTransition(async () => {
      try {
        await run(() => restoreTeamAction(fd), {
          label: t("restore"),
          message: tc("pleaseWait"),
        });
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
        await run(() => permanentlyDeleteTeamAction(fd), {
          label: t("purging"),
          message: tc("pleaseWait"),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : tc("unknownError");
        if (!msg.includes("NEXT_REDIRECT")) setError(msg);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-foreground">
            {team.name}
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {[team.age_group, team.season].filter(Boolean).join(" · ") || "—"}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {t("archivedOn", { date: archivedDate })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={restore}
            loading={isPending}
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
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              {t("deletePermanently")}
            </Button>
          ) : null}
        </div>
      </div>

      {purging && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="font-medium text-destructive">
            {t("purgeTitle")}
          </div>
          <p className="mt-1 text-destructive">
            {t("purgeWarning")}
          </p>
          <label className="mt-3 flex flex-col gap-1 text-foreground">
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
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-destructive focus:outline-none focus:ring-2 focus:ring-destructive/15"
              autoFocus
            />
          </label>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={purge}
              disabled={!canPurge}
              loading={isPending}
              loadingLabel={t("purging")}
            >
              {t("deletePermanently")}
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
