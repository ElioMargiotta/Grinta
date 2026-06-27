"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { updateProfileIdentityAction } from "@/app/[locale]/account/actions";

const inputClass =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function AccountIdentityForm({
  initialFirstName,
  initialLastName,
  initialBirthDate,
  initialPhone,
  email,
  initialUsername,
}: {
  initialFirstName: string | null;
  initialLastName: string | null;
  initialBirthDate: string | null;
  initialPhone: string | null;
  email: string | null;
  initialUsername: string | null;
}) {
  const t = useTranslations("account");
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");
  const [birthDate, setBirthDate] = useState(initialBirthDate ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [username, setUsername] = useState(initialUsername);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        setSaved(false);
        setError(null);
        startTransition(async () => {
          const result = await updateProfileIdentityAction(formData);
          if (result.ok) {
            setUsername(result.username);
            setSaved(true);
          } else {
            setError(t(`identityErrors.${result.error}`));
          }
        });
      }}
    >
      <div>
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {t("profileInfoTitle")}
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {t("profileInfoHelp")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {t("firstName")}
          </span>
          <input
            name="firstName"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {t("lastName")}
          </span>
          <input
            name="lastName"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {t("email")}
          </span>
          <input value={email ?? ""} disabled className={`${inputClass} opacity-70`} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {t("phone")}
          </span>
          <input
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {t("birthDate")}
          </span>
          <input
            name="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            autoComplete="bday"
            className={inputClass}
          />
        </label>
        <div className="min-w-0">
          <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {t("usernameLabel")}
          </div>
          <div className="mt-2 h-10 truncate rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
            {username ? `@${username}` : "—"}
          </div>
        </div>
      </div>

      <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t("usernameChangeWarning")}</span>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {t("identitySaved")}
        </div>
      )}

      <Button
        type="submit"
        loading={isPending}
        loadingLabel={t("saving")}
        className="w-full"
      >
        {t("save")}
      </Button>
    </form>
  );
}
