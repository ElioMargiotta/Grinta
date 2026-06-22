"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  CalendarDays,
  ClipboardList,
  MapPin,
  Pencil,
  Trash2,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MatchEditor, type EditableMatch } from "@/components/teams/MatchEditor";
import {
  MatchParticipations,
  type ParticipationState,
  type RosterPlayer,
} from "@/components/planner/MatchParticipations";
import {
  deleteMatchAction,
  setMatchResultAction,
} from "@/app/[locale]/(app)/teams/[teamId]/calendar/match-actions";

export type MatchHubMatch = EditableMatch & {
  ends_at: string | null;
  match_url: string | null;
  archived: boolean;
  home_score: number | null;
  away_score: number | null;
  result_note: string | null;
};

export type WeekSession = {
  id: string;
  date: string;
  startTime: string | null;
  theme: string | null;
  mdOffset: number | null;
};

type Outcome = "win" | "draw" | "loss";

/** Sens V/N/D du point de vue de notre équipe, dérivé du score objectif. */
function outcomeOf(match: MatchHubMatch): Outcome | null {
  if (match.home_score === null || match.away_score === null) return null;
  if (match.home_away !== "home" && match.home_away !== "away") return null;
  const away = match.home_away === "away";
  const our = away ? match.away_score : match.home_score;
  const opp = away ? match.home_score : match.away_score;
  if (our > opp) return "win";
  if (our < opp) return "loss";
  return "draw";
}

function formatMdOffset(n: number | null): string {
  if (n === null) return "";
  return n > 0 ? `MD+${n}` : `MD${n}`;
}

export function MatchHub({
  teamId,
  match,
  weekSessions,
  roster,
  participations,
}: {
  teamId: string;
  match: MatchHubMatch;
  weekSessions: WeekSession[];
  roster: RosterPlayer[];
  participations: Record<string, ParticipationState>;
}) {
  const t = useTranslations("planner.match");
  const tCal = useTranslations("teams.calendar.match");
  const locale = useLocale();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [homeScore, setHomeScore] = useState(
    match.home_score === null ? "" : String(match.home_score),
  );
  const [awayScore, setAwayScore] = useState(
    match.away_score === null ? "" : String(match.away_score),
  );
  const [note, setNote] = useState(match.result_note ?? "");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const [nowMs] = useState(() => Date.now());
  const start = new Date(match.starts_at);
  const isPast = start.getTime() < nowMs;
  const dateStr = start.toLocaleDateString(locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeStr = start.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const title = match.summary ?? match.opponent ?? t("fallback");
  const kind = match.kind ?? "league";
  const canDelete = match.source === "manual" || match.archived;
  const outcome = useMemo(() => outcomeOf(match), [match]);

  function saveResult() {
    setError(null);
    setSavedMsg(null);
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("matchId", match.id);
    fd.set("home_score", homeScore.trim());
    fd.set("away_score", awayScore.trim());
    fd.set("result_note", note);
    startSave(async () => {
      const r = await setMatchResultAction(fd);
      if (r?.error) {
        setError(tCal.has(`err.${r.error}`) ? tCal(`err.${r.error}`) : r.error);
      } else {
        setSavedMsg(t("resultSaved"));
        router.refresh();
      }
    });
  }

  function onDelete() {
    if (!window.confirm(tCal("deleteConfirm"))) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("matchId", match.id);
    startDelete(async () => {
      const r = await deleteMatchAction(fd);
      if (r?.error) {
        setError(tCal.has(`err.${r.error}`) ? tCal(`err.${r.error}`) : r.error);
      } else {
        router.push(`/planner/${teamId}`);
      }
    });
  }

  const outcomeChip =
    outcome === "win"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : outcome === "loss"
        ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <div className="flex flex-col gap-6">
      {/* Fil d'ariane / retour */}
      <button
        type="button"
        onClick={() => router.push(`/planner/${teamId}`)}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <CalendarDays className="h-4 w-4" />
        {t("backToPlanning")}
      </button>

      {/* En-tête match */}
      <header className="flex flex-col gap-3 border-b border-[var(--club-line)] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-[var(--club-primary-soft)] px-2 py-0.5 text-xs font-medium text-[var(--club-primary)]">
            {tCal(`kindOption.${kind}`)}
          </span>
          {match.home_away ? (
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium uppercase text-zinc-500 dark:bg-zinc-800">
              {tCal(match.home_away)}
            </span>
          ) : (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {tCal("homeAwayUnknown")}
            </span>
          )}
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              isPast
                ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
            }`}
          >
            {isPast ? t("statusPlayed") : t("statusUpcoming")}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="capitalize">
            {dateStr} · {timeStr}
          </span>
          {match.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {match.location}
            </span>
          ) : null}
          {match.competition ? <span>{match.competition}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {editing ? tCal("cancel") : t("editInfo")}
          </Button>
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              loading={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {tCal("delete")}
            </Button>
          ) : null}
        </div>
        {editing ? (
          <div className="mt-1">
            <MatchEditor
              teamId={teamId}
              match={match}
              onDone={() => {
                setEditing(false);
                router.refresh();
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : null}
      </header>

      {/* Résultat / score */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          <Trophy className="h-4 w-4 text-[var(--club-primary)]" />
          {t("resultTitle")}
        </div>

        {outcome ? (
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
              {match.home_score} – {match.away_score}
            </span>
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${outcomeChip}`}>
              {t(`outcome.${outcome}`)}
            </span>
          </div>
        ) : null}

        <div className="grid max-w-md gap-3 sm:grid-cols-2">
          <Input
            id="home-score"
            type="number"
            min={0}
            max={99}
            label={t("homeScore")}
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
          />
          <Input
            id="away-score"
            type="number"
            min={0}
            max={99}
            label={t("awayScore")}
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
          />
        </div>
        <div className="max-w-2xl">
          <label
            htmlFor="result-note"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t("resultNote")}
          </label>
          <textarea
            id="result-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={t("resultNotePlaceholder")}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" onClick={saveResult} loading={isSaving}>
            {t("saveResult")}
          </Button>
          {savedMsg ? (
            <span className="text-sm text-emerald-700 dark:text-emerald-400">{savedMsg}</span>
          ) : null}
          {error ? (
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          ) : null}
        </div>
      </section>

      {/* Semaine de préparation (MD-) */}
      <section className="flex flex-col gap-3 border-t border-[var(--club-line)] pt-5">
        <div className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          <ClipboardList className="h-4 w-4 text-[var(--club-primary)]" />
          {t("weekTitle")}
        </div>
        {weekSessions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--club-line)] bg-white/40 p-4 text-sm text-zinc-500 dark:bg-zinc-900/30">
            {t("weekEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--club-line)] overflow-hidden rounded-lg border border-[var(--club-line)]">
            {weekSessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/planner/${teamId}/sessions/${s.id}/preparation`)
                  }
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {s.mdOffset !== null ? (
                      <span className="shrink-0 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                        {formatMdOffset(s.mdOffset)}
                      </span>
                    ) : null}
                    <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">
                      {s.theme || t("sessionFallback")}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {new Date(`${s.date}T00:00:00`).toLocaleDateString(locale, {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                    })}
                    {s.startTime ? ` · ${s.startTime.slice(0, 5)}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Feuille de match — participations (Lot 2) */}
      <MatchParticipations
        teamId={teamId}
        matchId={match.id}
        roster={roster}
        initial={participations}
      />
    </div>
  );
}
