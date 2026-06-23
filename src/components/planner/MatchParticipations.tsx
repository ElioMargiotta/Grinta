"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { setMatchParticipationsAction } from "@/app/[locale]/(app)/teams/[teamId]/calendar/match-actions";

export type ParticipationStatus =
  | "starter"
  | "substitute"
  | "unused"
  | "unavailable";

export type RosterPlayer = {
  playerId: string;
  fullName: string;
  jerseyNumber: number | null;
};

export type ParticipationState = {
  status: ParticipationStatus;
  minutes: number | null;
  goals: number;
  assists: number;
  yellowCards: number;
  redCard: boolean;
};

/** Statuts proposés, dans l'ordre d'affichage. `null` = hors feuille. */
const STATUS_ORDER: (ParticipationStatus | null)[] = [
  null,
  "starter",
  "substitute",
  "unused",
  "unavailable",
];

function emptyState(): ParticipationState {
  return {
    status: "starter",
    minutes: null,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCard: false,
  };
}

export function MatchParticipations({
  teamId,
  matchId,
  roster,
  initial,
}: {
  teamId: string;
  matchId: string;
  roster: RosterPlayer[];
  initial: Record<string, ParticipationState>;
}) {
  const t = useTranslations("planner.match.squad");
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // État local : une entrée par joueur de l'effectif (les non sélectionnés
  // n'ont pas de `status` dans `selected`).
  const [selected, setSelected] = useState<Record<string, ParticipationState>>(
    () => ({ ...initial }),
  );

  const counts = useMemo(() => {
    let starters = 0;
    let subs = 0;
    for (const p of Object.values(selected)) {
      if (p.status === "starter") starters += 1;
      else if (p.status === "substitute") subs += 1;
    }
    return { starters, subs };
  }, [selected]);

  function setStatus(playerId: string, value: ParticipationStatus | null) {
    setSelected((prev) => {
      const next = { ...prev };
      if (value === null) {
        delete next[playerId];
      } else {
        next[playerId] = { ...(next[playerId] ?? emptyState()), status: value };
      }
      return next;
    });
  }

  function patch(playerId: string, p: Partial<ParticipationState>) {
    setSelected((prev) => {
      const cur = prev[playerId];
      if (!cur) return prev;
      return { ...prev, [playerId]: { ...cur, ...p } };
    });
  }

  function save() {
    setError(null);
    setSavedMsg(null);
    const participations = Object.entries(selected).map(([playerId, p]) => ({
      playerId,
      status: p.status,
      minutes: p.minutes,
      goals: p.goals,
      assists: p.assists,
      yellowCards: p.yellowCards,
      redCard: p.redCard,
    }));
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("matchId", matchId);
    fd.set("participations", JSON.stringify(participations));
    startSave(async () => {
      const r = await setMatchParticipationsAction(fd);
      if (r?.error) {
        setError(r.error);
      } else {
        setSavedMsg(t("saved"));
        router.refresh();
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 border-t border-[var(--club-line)] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          <Users className="h-4 w-4 text-[var(--club-primary)]" />
          {t("title")}
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <span className="rounded bg-[var(--club-primary-soft)] px-2 py-0.5 text-[var(--club-primary)]">
            {t("startersCount", { count: counts.starters })}
          </span>
          <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
            {t("subsCount", { count: counts.subs })}
          </span>
        </div>
      </div>

      {roster.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--club-line)] bg-white/40 p-4 text-sm text-zinc-500 dark:bg-zinc-900/30">
          {t("emptyRoster")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--club-line)] overflow-hidden rounded-lg border border-[var(--club-line)]">
          {roster.map((p) => {
            const state = selected[p.playerId] ?? null;
            const playing =
              state?.status === "starter" || state?.status === "substitute";
            return (
              <li
                key={p.playerId}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-100 text-[11px] font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {p.jerseyNumber ?? "—"}
                  </span>
                  <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">
                    {p.fullName}
                  </span>
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={state?.status ?? ""}
                    onChange={(e) =>
                      setStatus(
                        p.playerId,
                        e.target.value === ""
                          ? null
                          : (e.target.value as ParticipationStatus),
                      )
                    }
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s ?? "none"} value={s ?? ""}>
                        {s === null ? t("status.none") : t(`status.${s}`)}
                      </option>
                    ))}
                  </select>

                  {playing ? (
                    <div className="flex items-center gap-1.5">
                      <label className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {t("min")}
                        <input
                          type="number"
                          min={0}
                          max={200}
                          value={state?.minutes ?? ""}
                          onChange={(e) =>
                            patch(p.playerId, {
                              minutes:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          className="w-12 rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs tabular-nums text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        ⚽
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={state?.goals ?? 0}
                          onChange={(e) =>
                            patch(p.playerId, {
                              goals: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-11 rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs tabular-nums text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </label>
                      <button
                        type="button"
                        title={t("yellow")}
                        onClick={() =>
                          patch(p.playerId, {
                            yellowCards: ((state?.yellowCards ?? 0) + 1) % 3,
                          })
                        }
                        className={`flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold tabular-nums transition ${
                          (state?.yellowCards ?? 0) > 0
                            ? "bg-amber-400 text-amber-950"
                            : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                        }`}
                      >
                        {state?.yellowCards ? state.yellowCards : "🟨"}
                      </button>
                      <button
                        type="button"
                        title={t("red")}
                        onClick={() =>
                          patch(p.playerId, { redCard: !state?.redCard })
                        }
                        className={`flex h-6 w-6 items-center justify-center rounded text-[11px] transition ${
                          state?.redCard
                            ? "bg-red-500 text-white"
                            : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                        }`}
                      >
                        🟥
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={save}
          loading={isSaving}
          disabled={roster.length === 0}
        >
          {t("save")}
        </Button>
        {savedMsg ? (
          <span className="text-sm text-emerald-700 dark:text-emerald-400">
            {savedMsg}
          </span>
        ) : null}
        {error ? (
          <span className="text-sm text-red-600 dark:text-red-400">
            {t.has(`err.${error}`) ? t(`err.${error}`) : error}
          </span>
        ) : null}
      </div>
    </section>
  );
}
