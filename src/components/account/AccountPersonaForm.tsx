"use client";

import { useEffect, useState, useTransition } from "react";
import { Shield, UserCircle, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { updatePersonaPreferenceAction } from "@/app/[locale]/account/actions";

type Preference = "staff" | "player" | "dual";

const OPTIONS: { value: Preference; icon: typeof Shield; labelKey: string; descKey: string }[] = [
  { value: "staff", icon: Shield, labelKey: "optionStaffLabel", descKey: "optionStaffDesc" },
  { value: "player", icon: UserCircle, labelKey: "optionPlayerLabel", descKey: "optionPlayerDesc" },
  { value: "dual", icon: Users, labelKey: "optionDualLabel", descKey: "optionDualDesc" },
];

export function AccountPersonaForm({
  initialPreference,
}: {
  initialPreference: Preference;
}) {
  const t = useTranslations("account");
  const [preference, setPreference] = useState<Preference>(initialPreference);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Sync local state with server-rendered preference after each save so the
  // "saved" badge and dirty check stay coherent across multiple updates.
  useEffect(() => {
    setPreference(initialPreference);
  }, [initialPreference]);

  const dirty = preference !== initialPreference;

  return (
    <form
      className="flex flex-col gap-5"
      action={(formData) => {
        setError(null);
        setSaved(false);
        formData.set("personaPreference", preference);
        startTransition(async () => {
          const result = await updatePersonaPreferenceAction(formData);
          if (result?.error) {
            setError(t("saveError"));
          } else {
            setSaved(true);
          }
        });
      }}
    >
      <div>
        <div className="text-sm font-medium text-foreground">
          {t("personaLabel")}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("personaHelp")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {OPTIONS.map(({ value, icon: Icon, labelKey, descKey }) => {
          const active = preference === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setPreference(value)}
              aria-pressed={active}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:border-input"
              }`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">
                  {t(labelKey)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t(descKey)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
