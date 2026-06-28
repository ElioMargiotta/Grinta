"use client";

import { useTranslations } from "next-intl";
import { ClipboardList } from "lucide-react";

export type DerivedStat = {
  goals: number;
  assists: number;
  yellow: number;
  red: boolean;
};

export type SquadRecapRow = {
  playerId: string;
  fullName: string;
  jerseyNumber: number | null;
  status: "starter" | "substitute" | "unused" | "unavailable";
  minutes: number | null;
};

const GROUP_ORDER: SquadRecapRow["status"][] = [
  "starter",
  "substitute",
  "unused",
];

export function MatchSquadRecap({
  squad,
  derived,
}: {
  squad: SquadRecapRow[];
  derived: Record<string, DerivedStat>;
}) {
  const t = useTranslations("planner.match.result.recap");

  if (squad.length === 0) {
    return (
      <section className="flex flex-col gap-2 border-t border-border pt-5">
        <div className="flex items-center gap-2 text-base font-semibold text-foreground">
          <ClipboardList className="h-4 w-4 text-primary" />
          {t("title")}
        </div>
        <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        <ClipboardList className="h-4 w-4 text-primary" />
        {t("title")}
      </div>
      {GROUP_ORDER.map((group) => {
        const rows = squad.filter((r) => r.status === group);
        if (rows.length === 0) return null;
        return (
          <div key={group} className="flex flex-col gap-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`group.${group}`)} · {rows.length}
            </div>
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
              {rows.map((r) => {
                const d = derived[r.playerId];
                return (
                  <li
                    key={r.playerId}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold tabular-nums">
                        {r.jerseyNumber ?? "—"}
                      </span>
                      <span className="truncate text-foreground">
                        {r.fullName}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
                      {d && d.goals > 0 ? <span>⚽{d.goals}</span> : null}
                      {d && d.assists > 0 ? <span>🅰{d.assists}</span> : null}
                      {d && d.yellow > 0 ? <span>🟨{d.yellow}</span> : null}
                      {d && d.red ? <span>🟥</span> : null}
                      {r.minutes !== null ? (
                        <span className="text-muted-foreground">{r.minutes}′</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
