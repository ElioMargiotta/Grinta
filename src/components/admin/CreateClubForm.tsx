"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createClubAction } from "@/app/[locale]/(admin)/admin/actions";
import { LicensePriceEstimate } from "@/components/admin/LicensePriceEstimate";
import { DirectoryPicker } from "@/components/admin/DirectoryPicker";
import { AccountDirectoryInput } from "@/components/account/AccountDirectoryInput";
import type { DirectoryClub } from "@/lib/admin/queries";

type State = { error?: string } | null;

export function CreateClubForm({
  locale,
  directory = [],
}: {
  locale: string;
  directory?: DirectoryClub[];
}) {
  const t = useTranslations("admin");
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => createClubAction(formData),
    null,
  );

  const [directoryId, setDirectoryId] = useState("");
  const [name, setName] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="directoryId" value={directoryId} />

      {directory.length > 0 && (
        <Field label={t("clubs.directoryLabel")} hint={t("clubs.directoryHint")}>
          <DirectoryPicker
            clubs={directory}
            value={directoryId}
            onSelect={(id, clubName) => {
              setDirectoryId(id);
              if (clubName) setName(clubName);
            }}
          />
        </Field>
      )}

      <Field label={t("clubs.name")}>
        <input
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
        />
      </Field>

      <AccountDirectoryInput
        name="ownerIdentifier"
        label={t("clubs.ownerEmail")}
        hint={t("clubs.ownerEmailHint")}
        placeholder={t("owner.placeholder")}
        inputClassName={inputCls}
      />

      <fieldset className="grid grid-cols-3 gap-3">
        <Field label={t("license.maxTeams")} hint={t("license.unlimitedHint")}>
          <input name="maxTeams" type="number" min={0} className={inputCls} />
        </Field>
        <Field label={t("license.maxPlayers")}>
          <input name="maxPlayers" type="number" min={0} className={inputCls} />
        </Field>
        <Field label={t("license.maxStaff")}>
          <input name="maxStaff" type="number" min={0} className={inputCls} />
        </Field>
      </fieldset>

      <LicensePriceEstimate />

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("license.endsAt")} hint={t("license.endsAtHint")}>
          <input name="endsAt" type="datetime-local" className={inputCls} />
        </Field>
        <Field label={t("license.quoteReference")}>
          <input name="quoteReference" className={inputCls} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input name="autoRenew" type="checkbox" defaultChecked className="h-4 w-4" />
        {t("license.autoRenew")}
      </label>

      <Field label={t("license.notes")}>
        <textarea name="notes" rows={2} className={inputCls} />
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? t("common.saving") : t("clubs.create")}
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
