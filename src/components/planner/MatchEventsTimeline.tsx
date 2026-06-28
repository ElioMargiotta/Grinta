"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ArrowLeftRight, ListPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { RosterPlayer } from "@/components/planner/MatchParticipations";
import { setMatchEventsAction } from "@/app/[locale]/(app)/teams/[teamId]/calendar/match-actions";

export type MatchEventType =
  | "goal"
  | "own_goal"
  | "yellow"
  | "red"
  | "substitution"
  | "note";

export type MatchEvent = {
  type: MatchEventType;
  minute: number | null;
  playerId: string | null;
  relatedPlayerId: string | null;
  isPenalty: boolean;
  note: string | null;
};

type Row = MatchEvent & { key: string };

const ADD_TYPES: MatchEventType[] = [
  "goal",
  "substitution",
  "yellow",
  "red",
  "own_goal",
  "note",
];

const TYPE_ICON: Record<MatchEventType, string> = {
  goal: "⚽",
  own_goal: "🥅",
  yellow: "🟨",
  red: "🟥",
  substitution: "↔",
  note: "📝",
};

function newKey() {
  return `e_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyOf(type: MatchEventType): Row {
  return {
    key: newKey(),
    type,
    minute: null,
    playerId: null,
    relatedPlayerId: null,
    isPenalty: false,
    note: null,
  };
}

export function MatchEventsTimeline({
  teamId,
  matchId,
  roster,
  initial,
}: {
  teamId: string;
  matchId: string;
  roster: RosterPlayer[];
  initial: MatchEvent[];
}) {
  const t = useTranslations("planner.match.result.events");
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((e) => ({ ...e, key: newKey() })),
  );
  const [addOpen, setAddOpen] = useState(false);

  function add(type: MatchEventType) {
    setRows((r) => [...r, emptyOf(type)]);
    setAddOpen(false);
  }
  function remove(key: string) {
    setRows((r) => r.filter((x) => x.key !== key));
  }
  function patch(key: string, p: Partial<MatchEvent>) {
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...p } : x)));
  }

  function save() {
    setError(null);
    setSavedMsg(null);
    const events = rows.map((r) => ({
      type: r.type,
      minute: r.minute,
      playerId: r.playerId,
      relatedPlayerId: r.relatedPlayerId,
      isPenalty: r.isPenalty,
      note: r.note,
    }));
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("matchId", matchId);
    fd.set("events", JSON.stringify(events));
    startSave(async () => {
      const res = await setMatchEventsAction(fd);
      if (res?.error) setError(res.error);
      else {
        setSavedMsg(t("saved"));
        router.refresh();
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        <ArrowLeftRight className="h-4 w-4 text-primary" />
        {t("title")}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <EventRow
              key={row.key}
              row={row}
              roster={roster}
              t={t}
              onPatch={(p) => patch(row.key, p)}
              onRemove={() => remove(row.key)}
            />
          ))}
        </ul>
      )}

      <div className="relative">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setAddOpen((v) => !v)}
        >
          <ListPlus className="h-3.5 w-3.5" />
          {t("add")}
        </Button>
        {addOpen ? (
          <div className="absolute z-10 mt-1 w-52 rounded-md border border-border bg-card p-1 shadow-lg">
            {ADD_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => add(type)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span>{TYPE_ICON[type]}</span>
                {t(`type.${type}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

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

function EventRow({
  row,
  roster,
  t,
  onPatch,
  onRemove,
}: {
  row: Row;
  roster: RosterPlayer[];
  t: ReturnType<typeof useTranslations<"planner.match.result.events">>;
  onPatch: (p: Partial<MatchEvent>) => void;
  onRemove: () => void;
}) {
  const showPlayer = row.type !== "note";
  const playerLabel =
    row.type === "substitution"
      ? t("playerIn")
      : row.type === "goal"
        ? t("scorer")
        : t("player");

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2">
      <span className="text-base" title={t(`type.${row.type}`)}>
        {TYPE_ICON[row.type]}
      </span>

      {/* Minute */}
      <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {t("minuteShort")}
        <input
          type="number"
          min={0}
          max={130}
          value={row.minute ?? ""}
          onChange={(e) =>
            onPatch({
              minute: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className="w-12 rounded-md border border-border bg-card px-1.5 py-1 text-xs tabular-nums focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
        />
      </label>

      {showPlayer ? (
        <PlayerSelect
          label={playerLabel}
          roster={roster}
          value={row.playerId}
          onChange={(v) => onPatch({ playerId: v })}
          placeholder={t("selectPlayer")}
        />
      ) : null}

      {row.type === "goal" ? (
        <>
          <PlayerSelect
            label={t("assist")}
            roster={roster}
            value={row.relatedPlayerId}
            onChange={(v) => onPatch({ relatedPlayerId: v })}
            placeholder={t("noAssist")}
          />
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={row.isPenalty}
              onChange={(e) => onPatch({ isPenalty: e.target.checked })}
              className="h-3.5 w-3.5 accent-primary"
            />
            {t("penalty")}
          </label>
        </>
      ) : null}

      {row.type === "substitution" ? (
        <PlayerSelect
          label={t("playerOut")}
          roster={roster}
          value={row.relatedPlayerId}
          onChange={(v) => onPatch({ relatedPlayerId: v })}
          placeholder={t("selectPlayer")}
        />
      ) : null}

      {row.type === "note" ? (
        <input
          type="text"
          value={row.note ?? ""}
          onChange={(e) => onPatch({ note: e.target.value })}
          placeholder={t("notePlaceholder")}
          className="min-w-[12rem] flex-1 rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
        />
      ) : null}

      <button
        type="button"
        onClick={onRemove}
        className="ml-auto text-muted-foreground transition hover:text-destructive"
        aria-label={t("remove")}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function PlayerSelect({
  label,
  roster,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  roster: RosterPlayer[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
}) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className="sr-only sm:not-sr-only">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className="max-w-[10rem] rounded-md border border-border bg-card px-1.5 py-1 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
      >
        <option value="">{placeholder}</option>
        {roster.map((p) => (
          <option key={p.playerId} value={p.playerId}>
            {p.jerseyNumber !== null ? `${p.jerseyNumber} · ` : ""}
            {p.fullName}
          </option>
        ))}
      </select>
    </label>
  );
}
