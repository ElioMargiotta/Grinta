"use client";

import { useState, useTransition } from "react";
import { AtSign } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { setUsernameAction } from "@/app/[locale]/account/actions";

// Handle public optionnel (Lot A). Particulièrement utile aux comptes créés
// via OAuth (Google/Apple) qui n'ont jamais rempli de formulaire d'inscription.
export function AccountUsernameForm({
  initialUsername,
}: {
  initialUsername: string | null;
}) {
  const t = useTranslations("account");
  const [username, setUsername] = useState(initialUsername ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const normalized = username.trim().toLowerCase();
  const dirty = normalized !== (initialUsername ?? "");

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        setSaved(false);
        formData.set("username", normalized);
        startTransition(async () => {
          const result = await setUsernameAction(formData);
          if (result.ok) {
            setSaved(true);
          } else if (result.error === "taken") {
            setError(t("usernameTaken"));
          } else if (result.error === "invalid") {
            setError(t("usernameInvalid"));
          } else {
            setError(t("saveError"));
          }
        });
      }}
    >
      <div>
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {t("usernameLabel")}
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {t("usernameHelp")}
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900">
        <AtSign className="h-4 w-4 shrink-0 text-zinc-400" />
        <input
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={t("usernamePlaceholder")}
          className="h-10 w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
        />
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
        disabled={!dirty || isPending || normalized.length < 3}
        className="w-full"
      >
        {t("save")}
      </Button>
    </form>
  );
}
