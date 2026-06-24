"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Check, X, Minus, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import {
  markStaffAttendanceAction,
  setMembershipJsNumberAction,
} from "@/app/[locale]/(app)/planner/attendance-actions";

type ActualStatus = "present" | "absent" | null;

export type StaffEntry = {
  membershipId: string;
  fullName: string;
  jsNumber: string | null;
  actualStatus: "present" | "absent" | null;
};

type Props = {
  sessionId: string;
  teamId: string;
  staff: StaffEntry[];
};

export function StaffAttendanceRoster({ sessionId, teamId, staff }: Props) {
  const t = useTranslations("attendance.staff");

  if (staff.length === 0) {
    return (
      <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {t("title")}
      </h2>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t("hint")}</p>
      <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-widest text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2">{t("colName")}</th>
              <th className="px-3 py-2">{t("colJsNumber")}</th>
              <th className="px-3 py-2">{t("colPresence")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {staff.map((entry) => (
              <StaffRow
                key={entry.membershipId}
                entry={entry}
                sessionId={sessionId}
                teamId={teamId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffRow({
  entry,
  sessionId,
  teamId,
}: {
  entry: StaffEntry;
  sessionId: string;
  teamId: string;
}) {
  const t = useTranslations("attendance.staff");
  const tCoach = useTranslations("attendance.coach");
  const locale = useLocale();
  const router = useRouter();
  const [status, setStatus] = useState<ActualStatus>(entry.actualStatus);
  const [jsNumber, setJsNumber] = useState(entry.jsNumber ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const mark = (next: ActualStatus) => {
    setError(null);
    const previous = status;
    setStatus(next);
    startTransition(async () => {
      const res = await markStaffAttendanceAction({
        sessionId,
        membershipId: entry.membershipId,
        status: next,
        teamId,
        locale,
      });
      if (res.error) {
        setStatus(previous);
        setError(res.error);
      }
    });
  };

  const saveJsNumber = () => {
    if (jsNumber === (entry.jsNumber ?? "")) return;
    setError(null);
    startTransition(async () => {
      const res = await setMembershipJsNumberAction({
        membershipId: entry.membershipId,
        jsNumber,
        teamId,
        sessionId,
        locale,
      });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <tr className="bg-white dark:bg-zinc-950">
      <td className="px-3 py-3 font-medium text-zinc-900 dark:text-zinc-100">
        {entry.fullName || t("unnamed")}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <Input
            id={`js-${entry.membershipId}`}
            name={`js-${entry.membershipId}`}
            value={jsNumber}
            onChange={(e) => setJsNumber(e.target.value)}
            onBlur={saveJsNumber}
            placeholder={t("jsNumberPlaceholder")}
            className="w-32"
            aria-label={t("colJsNumber")}
          />
          {!jsNumber.trim() && (
            <AlertTriangle
              className="h-3.5 w-3.5 shrink-0 text-amber-500"
              aria-label={t("jsNumberMissing")}
            />
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          <Toggle
            active={status === "present"}
            onClick={() => mark(status === "present" ? null : "present")}
            disabled={isPending}
            tone="positive"
            label={tCoach("markPresent")}
          >
            <Check className="h-3.5 w-3.5" />
          </Toggle>
          <Toggle
            active={status === "absent"}
            onClick={() => mark(status === "absent" ? null : "absent")}
            disabled={isPending}
            tone="negative"
            label={tCoach("markAbsent")}
          >
            <X className="h-3.5 w-3.5" />
          </Toggle>
          <Toggle
            active={status === null}
            onClick={() => mark(null)}
            disabled={isPending}
            tone="neutral"
            label={tCoach("markUnknown")}
          >
            <Minus className="h-3.5 w-3.5" />
          </Toggle>
        </div>
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </td>
    </tr>
  );
}

function Toggle({
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
