"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, X, Minus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  markActualAttendanceAction,
  setSessionDeadlineAction,
} from "@/app/[locale]/(app)/planner/attendance-actions";
import { KindBadge } from "@/components/contingent/MedicalSection";
import type { UnavailabilityKind } from "@/lib/medical/unavailability";

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
  const [hours, setHours] = useState(deadlineHours);
  const [savingDeadline, startDeadline] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const counts = roster.reduce(
    (acc, r) => {
      if (r.announcedStatus === "present") acc.announcedPresent += 1;
      if (r.announcedStatus === "absent") acc.announcedAbsent += 1;
      if (r.announcedStatus === null) acc.noResponse += 1;
      if (r.actualStatus === "present") acc.actualPresent += 1;
      return acc;
    },
    { announcedPresent: 0, announcedAbsent: 0, noResponse: 0, actualPresent: 0 },
  );

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

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
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
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {t("deadlineHint")}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-widest text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2">{t("colPlayer")}</th>
              <th className="px-3 py-2">{t("colAnnounced")}</th>
              <th className="px-3 py-2">{t("colActual")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {roster.map((entry) => (
              <RosterRow
                key={entry.playerId}
                entry={entry}
                sessionId={sessionId}
                teamId={teamId}
                locale={locale}
              />
            ))}
            {roster.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-zinc-500">
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
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
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
}: {
  entry: RosterEntry;
  sessionId: string;
  teamId: string;
  locale: string;
}) {
  const t = useTranslations("attendance.coach");
  const tMed = useTranslations("medical");
  const [actual, setActual] = useState(entry.actualStatus);
  const [isPending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);
  const unavail = entry.unavailability;

  const mark = (next: "present" | "absent" | null) => {
    setRowError(null);
    const previous = actual;
    setActual(next);
    startTransition(async () => {
      const result = await markActualAttendanceAction({
        sessionId,
        playerId: entry.playerId,
        status: next,
        teamId,
        locale,
      });
      if (result.error) {
        setActual(previous);
        setRowError(result.error);
      }
    });
  };

  return (
    <tr className="bg-white dark:bg-zinc-950">
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          {entry.jerseyNumber !== null && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--club-primary-soft)] text-[11px] font-semibold text-[var(--club-primary)]">
              {entry.jerseyNumber}
            </span>
          )}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {entry.fullName}
          </span>
        </div>
      </td>
      <td className="px-3 py-3">
        {unavail ? (
          <div className="flex flex-col gap-1">
            <KindBadge kind={unavail.kind} label={tMed(`kind.${unavail.kind}`)} />
            {unavail.reason ? (
              <span className="flex items-start gap-1 text-[11px] italic text-zinc-500 dark:text-zinc-400">
                <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                {unavail.reason}
              </span>
            ) : null}
          </div>
        ) : entry.announcedStatus === null ? (
          <span className="text-[12px] text-zinc-400">{t("noResponse")}</span>
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
              <span className="flex items-start gap-1 text-[11px] italic text-zinc-500 dark:text-zinc-400">
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
            <span className="text-[12px] italic text-zinc-400">{tMed("excused")}</span>
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
          {rowError && <span className="text-[11px] text-red-600">{rowError}</span>}
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
      : "border-zinc-300 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-700",
    negative: active
      ? "bg-red-600 text-white border-red-600"
      : "border-zinc-300 text-zinc-500 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700",
    neutral: active
      ? "bg-zinc-700 text-white border-zinc-700"
      : "border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700",
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
