"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PlannerDateField } from "@/components/planner/PlannerSeasonCalendar";
import { PlannerTimeField } from "@/components/planner/PlannerTimeField";
import {
  createManualMatchAction,
  updateMatchAction,
} from "@/app/[locale]/(app)/teams/[teamId]/calendar/match-actions";

export type EditableMatch = {
  id: string;
  starts_at: string;
  summary: string | null;
  location: string | null;
  kind: string | null;
  home_away: string | null;
  opponent: string | null;
  competition: string | null;
  is_anchor: boolean;
  source: string;
};

const KINDS = ["league", "cup", "friendly", "tournament", "break"] as const;

/** ISO UTC → {date:'YYYY-MM-DD', time:'HH:MM'} en Europe/Zurich. */
function splitLocal(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { date, time };
}

type PickerMatch = EditableMatch & {
  ends_at: string | null;
  match_url: string | null;
};

export function MatchEditor({
  teamId,
  match,
  matches = [],
  onDone,
  onCancel,
}: {
  teamId: string;
  /** undefined = création d'un match manuel. */
  match?: EditableMatch;
  /** Matchs déjà au calendrier, affichés dans le sélecteur de date. */
  matches?: PickerMatch[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("teams.calendar.match");
  const isManual = !match || match.source === "manual";
  const initial = splitLocal(match?.starts_at ?? null);

  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time || "15:00");
  const [opponent, setOpponent] = useState(match?.opponent ?? "");
  const [homeAway, setHomeAway] = useState(match?.home_away ?? "");
  const [competition, setCompetition] = useState(match?.competition ?? "");
  const [location, setLocation] = useState(match?.location ?? "");
  const [kind, setKind] = useState(match?.kind ?? "league");
  const [isAnchor, setIsAnchor] = useState(match?.is_anchor ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    if (isManual && !date) {
      setError(t("err.dateRequired"));
      return;
    }
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("kind", kind);
    fd.set("is_anchor", isAnchor ? "on" : "");
    if (isManual) {
      fd.set("date", date);
      fd.set("time", time);
      fd.set("opponent", opponent);
      fd.set("home_away", homeAway);
      fd.set("competition", competition);
      fd.set("location", location);
    }
    if (match) fd.set("matchId", match.id);

    startTransition(async () => {
      const r = match
        ? await updateMatchAction(fd)
        : await createManualMatchAction(fd);
      if (r?.error) setError(t.has(`err.${r.error}`) ? t(`err.${r.error}`) : r.error);
      else onDone();
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--club-line)] bg-white/70 p-4 dark:bg-zinc-900/40">
      {!isManual ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("icsHint")}</p>
      ) : null}

      {isManual ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PlannerDateField
            id="match-date"
            label={t("date")}
            value={date}
            matches={matches}
            frameStart=""
            frameEnd=""
            onChange={setDate}
          />
          <PlannerTimeField
            id="match-time"
            label={t("time")}
            value={time}
            onChange={setTime}
          />
          <Input
            id="match-opponent"
            label={t("opponent")}
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder={t("opponentPlaceholder")}
          />
          <Select
            id="match-homeaway"
            label={t("homeAway")}
            value={homeAway}
            onChange={(e) => setHomeAway(e.target.value)}
          >
            <option value="">{t("homeAwayUnset")}</option>
            <option value="home">{t("home")}</option>
            <option value="away">{t("away")}</option>
          </Select>
          <Input
            id="match-competition"
            label={t("competition")}
            value={competition}
            onChange={(e) => setCompetition(e.target.value)}
          />
          <Input
            id="match-location"
            label={t("location")}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          id="match-kind"
          label={t("kind")}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kindOption.${k}`)}
            </option>
          ))}
        </Select>
        <label className="flex items-end gap-2 pb-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={isAnchor}
            onChange={(e) => setIsAnchor(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          <span>
            {t("isAnchor")}
            <span className="block text-xs text-zinc-400">{t("isAnchorHint")}</span>
          </span>
        </label>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          loading={isPending}
          loadingLabel={t("saving")}
        >
          {match ? t("save") : t("create")}
        </Button>
      </div>
    </div>
  );
}
