"use client";

import { useState, useTransition } from "react";
import { AtSign, MailCheck } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { verifyTotpStepUp } from "@/lib/auth/totp-client";
import { changeEmailAction } from "@/app/[locale]/account/security-actions";

const inputClass =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function ChangeEmailSection({
  currentEmail,
  has2FA,
  factorId,
}: {
  currentEmail: string;
  has2FA: boolean;
  factorId: string | null;
}) {
  const t = useTranslations("account.changeEmail");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [totp, setTotp] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setNewEmail("");
    setCurrent("");
    setTotp("");
    setError(null);
  }

  function submit() {
    setError(null);
    if (has2FA && totp.length < 6) {
      setError(t("invalidCode"));
      return;
    }

    startTransition(async () => {
      if (has2FA && factorId) {
        const step = await verifyTotpStepUp(factorId, totp);
        if (!step.ok) {
          setError(step.reason === "code" ? t("invalidCode") : t("genericError"));
          if (step.reason === "code") setTotp("");
          return;
        }
      }

      const fd = new FormData();
      fd.set("newEmail", newEmail);
      fd.set("currentPassword", current);
      fd.set("locale", locale);
      const result = await changeEmailAction(fd);

      if (result?.success) {
        reset();
        setOpen(false);
        setSent(true);
        return;
      }
      console.error("[changeEmail]", result);
      if (result?.errorCode === "wrongPassword") setError(t("wrongPassword"));
      else if (result?.errorCode === "mfaRequired") setError(t("mfaRequired"));
      else if (result?.errorCode === "noSession") setError(t("mfaRequired"));
      else if (result?.errorCode === "invalidEmail") setError(t("invalidEmail"));
      else if (result?.errorCode === "sameEmail") setError(t("sameEmail"));
      else if (result?.error) setError(result.error);
      else setError(t("genericError"));
    });
  }

  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {t("label")}
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {t("desc", { email: currentEmail })}
      </p>

      {sent && !open && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {t("sent")}
        </div>
      )}

      <div className="mt-4">
        {!open ? (
          <Button
            variant="secondary"
            onClick={() => {
              setSent(false);
              setOpen(true);
            }}
            className="w-fit"
          >
            <AtSign className="h-4 w-4" />
            {t("cta")}
          </Button>
        ) : (
          <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t("new")}
              </label>
              <input
                type="email"
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t("newPlaceholder")}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t("current")}
              </label>
              <PasswordInput
                name="currentPassword"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {has2FA && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("totp")}
                </label>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="••••••"
                  value={totp}
                  onChange={(e) =>
                    setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className={`${inputClass} text-center tracking-[0.3em]`}
                />
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <Button
                onClick={submit}
                loading={isPending}
                loadingLabel={t("submitting")}
                disabled={isPending || !newEmail || !current}
              >
                {t("submit")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
                disabled={isPending}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
