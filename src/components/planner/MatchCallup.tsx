"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Check, Clock, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { RosterPlayer } from "@/components/planner/MatchParticipations";
import { setMatchCallupAction } from "@/app/[locale]/(app)/teams/[teamId]/calendar/match-actions";

export type CallupInfo = {
  calledUp: boolean;
  availability: "available" | "unavailable" | null;
  availabilityReason: string | null;
};

export function MatchCallup({
  teamId,
  matchId,
  roster,
  initial,
}: {
  teamId: string;
  matchId: string;
  roster: RosterPlayer[];
  initial: Record<string, CallupInfo>;
}) {
  const t = useTranslations("planner.match.prematch.callup");
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [convened, setConvened] = useState<Set<string>>(
    () =>
      new Set(
        Object.entries(initial)
          .filter(([, v]) => v.calledUp)
          .map(([id]) => id),
      ),
  );

  const count = convened.size;
  const responded = useMemo(() => {
    let yes = 0;
    let no = 0;
    for (const id of convened) {
      const a = initial[id]?.availability;
      if (a === "available") yes += 1;
      else if (a === "unavailable") no += 1;
    }
    return { yes, no };
  }, [convened, initial]);

  function toggle(playerId: string) {
    setConvened((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function save() {
    setError(null);
    setSavedMsg(null);
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("matchId", matchId);
    fd.set("callups", JSON.stringify([...convened]));
    startSave(async () => {
      const r = await setMatchCallupAction(fd);
      if (r?.error) setError(r.error);
      else {
        setSavedMsg(t("saved"));
        router.refresh();
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-base font-semibold text-foreground">
          <UserCheck className="h-4 w-4 text-primary" />
          {t("title")}
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="rounded bg-accent px-2 py-0.5 text-primary">
            {t("convenedCount", { count })}
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            {responded.yes}
          </span>
          <span className="inline-flex items-center gap-1 text-destructive">
            <X className="h-3.5 w-3.5" />
            {responded.no}
          </span>
        </div>
      </div>

      {roster.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          {t("emptyRoster")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
          {roster.map((p) => {
            const isConvened = convened.has(p.playerId);
            const info = initial[p.playerId];
            const availability = isConvened ? info?.availability ?? null : null;
            return (
              <li
                key={p.playerId}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isConvened}
                    onChange={() => toggle(p.playerId)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold tabular-nums">
                    {p.jerseyNumber ?? "—"}
                  </span>
                  <span className="truncate text-sm text-foreground">
                    {p.fullName}
                  </span>
                </label>
                {isConvened ? (
                  <span className="shrink-0">
                    {availability === "available" ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <Check className="h-3 w-3" />
                        {t("present")}
                      </span>
                    ) : availability === "unavailable" ? (
                      <span
                        title={info?.availabilityReason ?? undefined}
                        className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
                      >
                        <X className="h-3 w-3" />
                        {t("absent")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {t("pending")}
                      </span>
                    )}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={save} loading={isSaving}>
          {t("save")}
        </Button>
        {savedMsg ? (
          <span className="text-sm text-emerald-700 dark:text-emerald-400">
            {savedMsg}
          </span>
        ) : null}
        {error ? (
          <span className="text-sm text-destructive">{error}</span>
        ) : null}
      </div>
    </section>
  );
}
