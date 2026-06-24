"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { updateLicenseAction } from "@/app/[locale]/(admin)/admin/actions";
import { LicensePriceEstimate } from "@/components/admin/LicensePriceEstimate";
import type { LicenseStatus } from "@/lib/license/types";

type State = { ok?: true; error?: string } | null;

export type LicenseFormValues = {
  status: LicenseStatus;
  auto_renew: boolean;
  ends_at: string | null;
  quote_reference: string | null;
  notes: string | null;
  max_teams: number | null;
  max_players: number | null;
  max_staff: number | null;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LicenseForm({
  clubId,
  locale,
  values,
}: {
  clubId: string;
  locale: string;
  values: LicenseFormValues;
}) {
  const t = useTranslations("admin");
  const [maxTeams, setMaxTeams] = useState(values.max_teams != null ? String(values.max_teams) : "");
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => updateLicenseAction(formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="locale" value={locale} />

      <fieldset className="grid grid-cols-3 gap-3">
        <Field label={t("license.maxTeams")} hint={t("license.unlimitedHint")}>
          <input
            name="maxTeams"
            type="number"
            min={0}
            value={maxTeams}
            onChange={(e) => setMaxTeams(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label={t("license.maxPlayers")}>
          <input name="maxPlayers" type="number" min={0} defaultValue={values.max_players ?? ""} className={inputCls} />
        </Field>
        <Field label={t("license.maxStaff")}>
          <input name="maxStaff" type="number" min={0} defaultValue={values.max_staff ?? ""} className={inputCls} />
        </Field>
      </fieldset>

      <LicensePriceEstimate teams={maxTeams ? Number(maxTeams) : null} />

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("license.status")}>
          <select name="status" defaultValue={values.status} className={inputCls}>
            <option value="active">{t("state.active")}</option>
            <option value="suspended">{t("license.statusSuspended")}</option>
            <option value="expired">{t("license.statusExpired")}</option>
          </select>
        </Field>
        <Field label={t("license.endsAt")} hint={t("license.endsAtHint")}>
          <input name="endsAt" type="datetime-local" defaultValue={toLocalInput(values.ends_at)} className={inputCls} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input name="autoRenew" type="checkbox" defaultChecked={values.auto_renew} className="h-4 w-4" />
        {t("license.autoRenew")}
      </label>

      <Field label={t("license.quoteReference")}>
        <input name="quoteReference" defaultValue={values.quote_reference ?? ""} className={inputCls} />
      </Field>
      <Field label={t("license.notes")}>
        <textarea name="notes" rows={2} defaultValue={values.notes ?? ""} className={inputCls} />
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
          {t("common.saved")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
    </label>
  );
}
