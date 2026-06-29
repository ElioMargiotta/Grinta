"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { HeartPulse, Pencil, Plus, Trash2, X } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/Section";
import { EmptyState } from "@/components/ui/EmptyState";
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
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Plus className="h-4 w-4" />
            {t("add")}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((u) => {
            const ongoing = coversDate(u, today);
            return (
              <li
                key={u.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3"
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
                  <div className="mt-1 text-[13px] text-muted-foreground">
                    {formatDay(u.startDate)} →{" "}
                    {u.endDate ? formatDay(u.endDate) : t("openEnd")}
                  </div>
                  {u.reason ? (
                    <p className="mt-1 text-[12px] italic text-muted-foreground">
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
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => remove(u.id)}
                      title={t("delete")}
                      aria-label={t("delete")}
                      className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
    other: "bg-muted text-muted-foreground",
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
    "rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15";

  const canSubmit = draft.startDate && (!draft.endDate || draft.endDate >= draft.startDate);

  return (
    <div className="mb-4 rounded-md border border-border bg-muted/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-[13px] font-semibold text-foreground">
          {draft.id ? t("editTitle") : t("addTitle")}
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={t("cancel")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
        <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("field.startDate")}
          <input
            type="date"
            value={draft.startDate}
            onChange={(e) => onChange({ ...draft, startDate: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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

      <label className="mt-3 flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
          className="rounded-md border border-border px-3 py-1.5 text-[13px] font-semibold text-foreground hover:bg-accent"
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          disabled={pending || !canSubmit}
          onClick={onSubmit}
          className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}
