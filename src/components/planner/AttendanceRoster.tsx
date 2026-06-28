"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, X, Minus, MessageSquare } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  markActualAttendanceAction,
  markAllActualAttendanceAction,
  setSessionDeadlineAction,
} from "@/app/[locale]/(app)/planner/attendance-actions";

type ActualStatus = "present" | "absent" | null;
import { KindBadge } from "@/components/contingent/AvailabilitySection";
import type { UnavailabilityKind } from "@/lib/availability/unavailability";

export type RosterEntry = {
  playerId: string;
  fullName: string;
  jerseyNumber: number | null;
  announcedStatus: "present" | "absent" | null;
  announcedReason: string | null;
  announcedAt: string | null;
  actualStatus: "present" | "absent" | null;
  unavailability: { kind: UnavailabilityKind; reason: string | null } | null;
};

type Props = {
  sessionId: string;
  teamId: string;
  deadlineHours: number;
  roster: RosterEntry[];
};

export function AttendanceRoster({
  sessionId,
  teamId,
  deadlineHours,
  roster,
}: Props) {
  const t = useTranslations("attendance.coach");
  const locale = useLocale();
  const router = useRouter();
  const [hours, setHours] = useState(deadlineHours);
  const [savingDeadline, startDeadline] = useTransition();
  const [bulkPending, startBulk] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // État « présence réelle » remonté au parent : permet le pointage en masse.
  // Par défaut = statut saisi, sinon réponse RSVP du joueur (auto-lien) : le
  // coach ne corrige que les exceptions.
  const [actualMap, setActualMap] = useState<Map<string, ActualStatus>>(
    () => new Map(roster.map((r) => [r.playerId, r.actualStatus ?? r.announcedStatus])),
  );

  const setActual = (playerId: string, next: ActualStatus) =>
    setActualMap((prev) => new Map(prev).set(playerId, next));

  const counts = useMemo(() => {
    const acc = { announcedPresent: 0, announcedAbsent: 0, noResponse: 0, actualPresent: 0 };
    for (const r of roster) {
      if (r.announcedStatus === "present") acc.announcedPresent += 1;
      if (r.announcedStatus === "absent") acc.announcedAbsent += 1;
      if (r.announcedStatus === null) acc.noResponse += 1;
      if (actualMap.get(r.playerId) === "present") acc.actualPresent += 1;
    }
    return acc;
  }, [roster, actualMap]);

  // Pointage en masse : applique le statut aux joueurs disponibles (les indispos
  // restent excusés). Optimiste, puis refresh serveur.
  const markAll = (status: "present" | "absent") => {
    const targets = roster.filter((r) => !r.unavailability).map((r) => r.playerId);
    if (targets.length === 0) return;
    setError(null);
    setActualMap((prev) => {
      const next = new Map(prev);
      for (const id of targets) next.set(id, status);
      return next;
    });
    startBulk(async () => {
      const res = await markAllActualAttendanceAction({
        sessionId,
        teamId,
        playerIds: targets,
        status,
        locale,
      });
      if (res.error) setError(res.error);
      router.refresh();
    });
  };

  const saveDeadline = () => {
    setError(null);
    startDeadline(async () => {
      const result = await setSessionDeadlineAction({
        sessionId,
        teamId,
        hours,
        locale,
      });
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={t("statAnnouncedPresent")} value={counts.announcedPresent} />
        <Stat label={t("statAnnouncedAbsent")} value={counts.announcedAbsent} />
        <Stat label={t("statNoResponse")} value={counts.noResponse} />
        <Stat label={t("statActualPresent")} value={counts.actualPresent} />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-3">
        <Input
          id="deadline-hours"
          name="deadline-hours"
          type="number"
          min={0}
          max={168}
          label={t("deadlineLabel")}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="w-28"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={saveDeadline}
          loading={savingDeadline}
        >
          {t("deadlineSave")}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          {t("deadlineHint")}
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {roster.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-muted-foreground">
            {t("bulkLabel")}
          </span>
          <button
            type="button"
            disabled={bulkPending}
            onClick={() => markAll("present")}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <Check className="h-3.5 w-3.5" />
            {t("markAllPresent")}
          </button>
          <button
            type="button"
            disabled={bulkPending}
            onClick={() => markAll("absent")}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[12px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          >
            <X className="h-3.5 w-3.5" />
            {t("markAllAbsent")}
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{t("colPlayer")}</th>
              <th className="px-3 py-2">{t("colAnnounced")}</th>
              <th className="px-3 py-2">{t("colActual")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {roster.map((entry) => (
              <RosterRow
                key={entry.playerId}
                entry={entry}
                sessionId={sessionId}
                teamId={teamId}
                locale={locale}
                actual={actualMap.get(entry.playerId) ?? null}
                onChange={setActual}
              />
            ))}
            {roster.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  {t("emptyRoster")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

function RosterRow({
  entry,
  sessionId,
  teamId,
  locale,
  actual,
  onChange,
}: {
  entry: RosterEntry;
  sessionId: string;
  teamId: string;
  locale: string;
  actual: ActualStatus;
  onChange: (playerId: string, next: ActualStatus) => void;
}) {
  const t = useTranslations("attendance.coach");
  const tMed = useTranslations("availability");
  const [isPending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);
  const unavail = entry.unavailability;

  const mark = (next: ActualStatus) => {
    setRowError(null);
    const previous = actual;
    onChange(entry.playerId, next);
    startTransition(async () => {
      const result = await markActualAttendanceAction({
        sessionId,
        playerId: entry.playerId,
        status: next,
        teamId,
        locale,
      });
      if (result.error) {
        onChange(entry.playerId, previous);
        setRowError(result.error);
      }
    });
  };

  return (
    <tr className="bg-card">
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          {entry.jerseyNumber !== null && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-primary">
              {entry.jerseyNumber}
            </span>
          )}
          <span className="font-medium text-foreground">
            {entry.fullName}
          </span>
        </div>
      </td>
      <td className="px-3 py-3">
        {unavail ? (
          <div className="flex flex-col gap-1">
            <KindBadge kind={unavail.kind} label={tMed(`kind.${unavail.kind}`)} />
            {unavail.reason ? (
              <span className="flex items-start gap-1 text-[11px] italic text-muted-foreground">
                <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                {unavail.reason}
              </span>
            ) : null}
          </div>
        ) : entry.announcedStatus === null ? (
          <span className="text-[12px] text-muted-foreground">{t("noResponse")}</span>
        ) : (
          <div className="flex flex-col gap-1">
            <span
              className={
                entry.announcedStatus === "present"
                  ? "inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                  : "inline-flex w-fit items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700"
              }
            >
              {entry.announcedStatus === "present" ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              {entry.announcedStatus === "present" ? t("present") : t("absent")}
            </span>
            {entry.announcedStatus === "absent" && entry.announcedReason && (
              <span className="flex items-start gap-1 text-[11px] italic text-muted-foreground">
                <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                {entry.announcedReason}
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1">
          {unavail ? (
            <span className="text-[12px] italic text-muted-foreground">{tMed("excused")}</span>
          ) : null}
          <div className="flex gap-1">
            <IconToggle
              active={actual === "present"}
              onClick={() => mark(actual === "present" ? null : "present")}
              disabled={isPending}
              tone="positive"
              label={t("markPresent")}
            >
              <Check className="h-3.5 w-3.5" />
            </IconToggle>
            <IconToggle
              active={actual === "absent"}
              onClick={() => mark(actual === "absent" ? null : "absent")}
              disabled={isPending}
              tone="negative"
              label={t("markAbsent")}
            >
              <X className="h-3.5 w-3.5" />
            </IconToggle>
            <IconToggle
              active={actual === null}
              onClick={() => mark(null)}
              disabled={isPending}
              tone="neutral"
              label={t("markUnknown")}
            >
              <Minus className="h-3.5 w-3.5" />
            </IconToggle>
          </div>
          {rowError && <span className="text-[11px] text-destructive">{rowError}</span>}
        </div>
      </td>
    </tr>
  );
}

function IconToggle({
  active,
  onClick,
  disabled,
  tone,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  tone: "positive" | "negative" | "neutral";
  label: string;
  children: React.ReactNode;
}) {
  const toneStyles = {
    positive: active
      ? "bg-emerald-600 text-white border-emerald-600"
      : "border-input text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700",
    negative: active
      ? "bg-red-600 text-white border-red-600"
      : "border-input text-muted-foreground hover:bg-red-50 hover:text-red-700",
    neutral: active
      ? "bg-foreground text-background border-foreground"
      : "border-input text-muted-foreground hover:bg-accent",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:opacity-50 ${toneStyles[tone]}`}
    >
      {children}
    </button>
  );
}
