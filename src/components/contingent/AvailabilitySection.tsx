"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { HeartPulse, Pencil, Plus, Trash2, X } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/Section";
import { formatDay, todayISO } from "@/lib/contingent/week";
import {
  UNAVAILABILITY_KINDS,
  type Unavailability,
  type UnavailabilityKind,
  coversDate,
} from "@/lib/availability/unavailability";
import {
  createUnavailabilityAction,
  deleteUnavailabilityAction,
  updateUnavailabilityAction,
} from "@/app/[locale]/(app)/contingent/[playerId]/availability/actions";

type Draft = {
  id?: string;
  kind: UnavailabilityKind;
  startDate: string;
  endDate: string;
  reason: string;
};

function emptyDraft(): Draft {
  return { kind: "injury", startDate: todayISO(), endDate: "", reason: "" };
}

function draftFrom(u: Unavailability): Draft {
  return {
    id: u.id,
    kind: u.kind,
    startDate: u.startDate,
    endDate: u.endDate ?? "",
    reason: u.reason ?? "",
  };
}

export function AvailabilitySection({
  playerId,
  locale,
  unavailabilities,
  canManage,
}: {
  playerId: string;
  locale: string;
  unavailabilities: Unavailability[];
  canManage: boolean;
}) {
  const t = useTranslations("availability");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const today = todayISO();

  const sorted = useMemo(() => {
    const ongoing = (u: Unavailability) => coversDate(u, today);
    return [...unavailabilities].sort(
      (a, b) =>
        Number(ongoing(b)) - Number(ongoing(a)) ||
        b.startDate.localeCompare(a.startDate),
    );
  }, [unavailabilities, today]);

  function save(d: Draft) {
    setError(null);
    startTransition(async () => {
      const payload = {
        playerId,
        locale,
        kind: d.kind,
        reason: d.reason.trim() || null,
        startDate: d.startDate,
        endDate: d.endDate || null,
      };
      const res = d.id
        ? await updateUnavailabilityAction({ id: d.id, ...payload })
        : await createUnavailabilityAction(payload);
      if (res?.error) setError(res.error);
      else setDraft(null);
    });
  }

  function remove(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteUnavailabilityAction({ playerId, locale, id });
      if (res?.error) setError(res.error);
    });
  }

  function endToday(u: Unavailability) {
    setError(null);
    startTransition(async () => {
      const res = await updateUnavailabilityAction({
        playerId,
        locale,
        id: u.id,
        kind: u.kind,
        reason: u.reason,
        startDate: u.startDate,
        endDate: today,
      });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <Section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionHeader icon={HeartPulse} title={t("title")} description={t("intro")} />
        {canManage ? (
          <button
            type="button"
            onClick={() => setDraft(emptyDraft())}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--club-primary)] px-3 py-1.5 text-[13px] font-semibold text-[var(--club-primary-foreground)]"
          >
            <Plus className="h-4 w-4" />
            {t("add")}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {draft ? (
        <UnavailabilityForm
          t={t}
          draft={draft}
          pending={pending}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSubmit={() => save(draft)}
        />
      ) : null}

      {sorted.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--club-line)] p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {t("empty")}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((u) => {
            const ongoing = coversDate(u, today);
            return (
              <li
                key={u.id}
                className="flex items-start justify-between gap-3 rounded-md border border-[var(--club-line)] bg-white p-3 dark:bg-zinc-900"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <KindBadge kind={u.kind} label={t(`kind.${u.kind}`)} />
                    {ongoing ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        {t("ongoing")}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[13px] text-zinc-600 dark:text-zinc-300">
                    {formatDay(u.startDate)} →{" "}
                    {u.endDate ? formatDay(u.endDate) : t("openEnd")}
                  </div>
                  {u.reason ? (
                    <p className="mt-1 text-[12px] italic text-zinc-500 dark:text-zinc-400">
                      {u.reason}
                    </p>
                  ) : null}
                </div>
                {canManage ? (
                  <div className="flex shrink-0 items-center gap-1">
                    {ongoing ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => endToday(u)}
                        className="rounded-md px-2 py-1 text-[12px] font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      >
                        {t("endToday")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setDraft(draftFrom(u))}
                      title={t("edit")}
                      aria-label={t("edit")}
                      className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => remove(u.id)}
                      title={t("delete")}
                      aria-label={t("delete")}
                      className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

export function KindBadge({
  kind,
  label,
}: {
  kind: UnavailabilityKind;
  label: string;
}) {
  const tone: Record<UnavailabilityKind, string> = {
    injury: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    illness: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    suspension: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone[kind]}`}
    >
      {label}
    </span>
  );
}

function UnavailabilityForm({
  t,
  draft,
  pending,
  onChange,
  onCancel,
  onSubmit,
}: {
  t: ReturnType<typeof useTranslations>;
  draft: Draft;
  pending: boolean;
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const inputClass =
    "rounded-md border border-[var(--club-line)] bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100";

  const canSubmit = draft.startDate && (!draft.endDate || draft.endDate >= draft.startDate);

  return (
    <div className="mb-4 rounded-md border border-[var(--club-line)] bg-zinc-50/60 p-4 dark:bg-zinc-800/30">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
          {draft.id ? t("editTitle") : t("addTitle")}
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          aria-label={t("cancel")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {t("field.kind")}
          <select
            value={draft.kind}
            onChange={(e) =>
              onChange({ ...draft, kind: e.target.value as UnavailabilityKind })
            }
            className={inputClass}
          >
            {UNAVAILABILITY_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {t("field.startDate")}
          <input
            type="date"
            value={draft.startDate}
            onChange={(e) => onChange({ ...draft, startDate: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {t("field.endDate")}
          <input
            type="date"
            value={draft.endDate}
            min={draft.startDate || undefined}
            onChange={(e) => onChange({ ...draft, endDate: e.target.value })}
            className={inputClass}
          />
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {t("field.reason")}
        <input
          type="text"
          value={draft.reason}
          maxLength={500}
          placeholder={t("field.reasonPlaceholder")}
          onChange={(e) => onChange({ ...draft, reason: e.target.value })}
          className={inputClass}
        />
      </label>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[var(--club-line)] px-3 py-1.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/50"
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          disabled={pending || !canSubmit}
          onClick={onSubmit}
          className="rounded-md bg-[var(--club-primary)] px-3 py-1.5 text-[13px] font-semibold text-[var(--club-primary-foreground)] disabled:opacity-50"
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}
