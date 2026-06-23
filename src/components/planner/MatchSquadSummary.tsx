"use client";

import { useTranslations } from "next-intl";
import { Check, Clock, UserCheck, X } from "lucide-react";
import type { RosterPlayer } from "@/components/planner/MatchParticipations";
import type { CallupInfo } from "@/components/planner/MatchCallup";
import type { UnavailableMap } from "@/components/planner/LineupBoard";
import type { UnavailabilityKind } from "@/lib/availability/unavailability";

const KIND_BADGE: Record<UnavailabilityKind, string> = {
  injury: "🩹",
  illness: "🤒",
  suspension: "🟥",
  other: "⛔",
};

const KIND_ORDER: UnavailabilityKind[] = [
  "injury",
  "suspension",
  "illness",
  "other",
];

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : full;
}

/**
 * Récap visuel de la convocation, « à la suite de la compo ». Dérivé de l'état
 * de la compo (titulaires + remplaçants) ; les autres joueurs sont automatiquement
 * classés non convoqués ou indisponibles (blessé/suspendu/malade) selon le médical.
 */
export function MatchSquadSummary({
  roster,
  starters,
  subs,
  unavailable,
  callup,
}: {
  roster: RosterPlayer[];
  starters: string[];
  subs: string[];
  unavailable: UnavailableMap;
  callup: Record<string, CallupInfo>;
}) {
  const t = useTranslations("planner.match.prematch.summary");
  const byId = new Map(roster.map((p) => [p.playerId, p]));

  const used = new Set<string>([...starters, ...subs]);
  const notUsed = roster.filter((p) => !used.has(p.playerId));

  const notCalled: RosterPlayer[] = [];
  const byKind: Record<UnavailabilityKind, RosterPlayer[]> = {
    injury: [],
    illness: [],
    suspension: [],
    other: [],
  };
  for (const p of notUsed) {
    const unav = unavailable[p.playerId];
    if (unav) byKind[unav.kind].push(p);
    else notCalled.push(p);
  }

  const resolve = (ids: string[]): RosterPlayer[] =>
    ids.map((id) => byId.get(id)).filter((p): p is RosterPlayer => Boolean(p));

  const starterPlayers = resolve(starters);
  const subPlayers = resolve(subs);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        <UserCheck className="h-4 w-4 text-[var(--club-primary)]" />
        {t("title")}
      </div>

      {/* Titulaires — la compo en gros */}
      <Group label={t("starters")} count={starterPlayers.length}>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {starterPlayers.map((p) => (
            <li
              key={p.playerId}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--club-line)] bg-white px-2.5 py-1.5 dark:bg-zinc-900"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--club-primary-soft)] text-[11px] font-bold tabular-nums text-[var(--club-primary)]">
                  {p.jerseyNumber ?? "—"}
                </span>
                <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">
                  {p.fullName}
                </span>
              </span>
              <RsvpBadge availability={callup[p.playerId]?.availability ?? null} t={t} />
            </li>
          ))}
        </ul>
      </Group>

      {subPlayers.length > 0 ? (
        <Group label={t("subs")} count={subPlayers.length}>
          <Chips players={subPlayers} callup={callup} t={t} />
        </Group>
      ) : null}

      {notCalled.length > 0 ? (
        <Group label={t("notCalled")} count={notCalled.length} muted>
          <Chips players={notCalled} muted />
        </Group>
      ) : null}

      {KIND_ORDER.map((kind) =>
        byKind[kind].length > 0 ? (
          <Group
            key={kind}
            label={`${KIND_BADGE[kind]} ${t(kind)}`}
            count={byKind[kind].length}
            muted
          >
            <Chips players={byKind[kind]} danger unavailable={unavailable} />
          </Group>
        ) : null,
      )}
    </section>
  );
}

function Group({
  label,
  count,
  muted = false,
  children,
}: {
  label: string;
  count: number;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-semibold ${
            muted
              ? "text-zinc-500 dark:text-zinc-400"
              : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          {label}
        </span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function Chips({
  players,
  muted = false,
  danger = false,
  callup,
  unavailable,
  t,
}: {
  players: RosterPlayer[];
  muted?: boolean;
  danger?: boolean;
  callup?: Record<string, CallupInfo>;
  unavailable?: UnavailableMap;
  t?: ReturnType<typeof useTranslations<"planner.match.prematch.summary">>;
}) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {players.map((p) => {
        const unav = unavailable?.[p.playerId];
        const availability = callup?.[p.playerId]?.availability ?? null;
        return (
          <li
            key={p.playerId}
            className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-1 pr-2 text-sm ${
              danger
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                : muted
                  ? "border-[var(--club-line)] bg-zinc-50 text-zinc-500 dark:bg-zinc-900/40 dark:text-zinc-400"
                  : "border-[var(--club-line)] bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
            }`}
          >
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums ${
                danger
                  ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  : "bg-zinc-100 dark:bg-zinc-800"
              }`}
            >
              {p.jerseyNumber ?? "—"}
            </span>
            <span className="truncate">{lastName(p.fullName)}</span>
            {unav ? <span>{KIND_BADGE[unav.kind]}</span> : null}
            {t && availability ? (
              <RsvpBadge availability={availability} t={t} compact />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function RsvpBadge({
  availability,
  t,
  compact = false,
}: {
  availability: "available" | "unavailable" | null;
  t: ReturnType<typeof useTranslations<"planner.match.prematch.summary">>;
  compact?: boolean;
}) {
  if (availability === "available") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Check className="h-3 w-3" />
        {compact ? null : t("present")}
      </span>
    );
  }
  if (availability === "unavailable") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
        <X className="h-3 w-3" />
        {compact ? null : t("absent")}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      <Clock className="h-3 w-3" />
      {compact ? null : t("pending")}
    </span>
  );
}
