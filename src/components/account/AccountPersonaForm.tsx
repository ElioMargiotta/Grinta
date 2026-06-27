"use client";

import { useMemo, useState, useTransition } from "react";
import { Shield, UserCircle, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { updatePersonaPreferenceAction } from "@/app/[locale]/account/actions";

export type AccountCapability = "staff" | "player" | "parent";

const OPTIONS: { value: AccountCapability; icon: typeof Shield; labelKey: string; descKey: string }[] = [
  { value: "staff", icon: Shield, labelKey: "optionStaffLabel", descKey: "optionStaffDesc" },
  { value: "player", icon: UserCircle, labelKey: "optionPlayerLabel", descKey: "optionPlayerDesc" },
  { value: "parent", icon: Users, labelKey: "optionParentLabel", descKey: "optionParentDesc" },
];

export function AccountPersonaForm({
  initialCapabilities,
}: {
  initialCapabilities: AccountCapability[];
}) {
  const t = useTranslations("account");
  const initialKey = useMemo(
    () => [...initialCapabilities].sort().join("|"),
    [initialCapabilities],
  );
  const [capabilities, setCapabilities] =
    useState<AccountCapability[]>(initialCapabilities);
  const [savedKey, setSavedKey] = useState(initialKey);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const currentKey = [...capabilities].sort().join("|");
  const dirty = currentKey !== savedKey;

  function toggle(value: AccountCapability) {
    setSaved(false);
    setCapabilities((current) => {
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return next.length > 0 ? next : current;
    });
  }

  return (
    <form
      className="flex flex-col gap-5"
      action={(formData) => {
        setError(null);
        setSaved(false);
        for (const capability of capabilities) {
          formData.append("capabilities", capability);
        }
        startTransition(async () => {
          const result = await updatePersonaPreferenceAction(formData);
          if (result?.error) {
            setError(t("saveError"));
          } else {
            setSavedKey(currentKey);
            setSaved(true);
          }
        });
      }}
    >
      <div>
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {t("personaLabel")}
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {t("personaHelp")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {OPTIONS.map(({ value, icon: Icon, labelKey, descKey }) => {
          const active = capabilities.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggle(value)}
              aria-pressed={active}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                active
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                  : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
              }`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-zinc-700 dark:text-zinc-200" />
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t(labelKey)}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t(descKey)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && !dirty && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {t("saved")}
        </div>
      )}

      <Button
        type="submit"
        loading={isPending}
        loadingLabel={t("saving")}
        disabled={!dirty || isPending}
        className="w-full"
      >
        {t("save")}
      </Button>
    </form>
  );
}
