"use client";

import { useState, useTransition } from "react";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { isStrongPassword } from "@/lib/auth/password";
import { verifyTotpStepUp } from "@/lib/auth/totp-client";
import { changePasswordAction } from "@/app/[locale]/account/security-actions";

const inputClass =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function ChangePasswordSection({
  has2FA,
  factorId,
}: {
  has2FA: boolean;
  factorId: string | null;
}) {
  const t = useTranslations("account.password");
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [totp, setTotp] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setTotp("");
    setError(null);
  }

  function submit() {
    setError(null);
    if (!isStrongPassword(next)) {
      setError(t("weakPassword"));
      return;
    }
    if (next !== confirm) {
      setError(t("mismatch"));
      return;
    }
    if (has2FA && totp.length < 6) {
      setError(t("invalidCode"));
      return;
    }

    startTransition(async () => {
      // Step-up 2FA : re-prouver la possession du téléphone au moment du change.
      if (has2FA && factorId) {
        const step = await verifyTotpStepUp(factorId, totp);
        if (!step.ok) {
          setError(step.reason === "code" ? t("invalidCode") : t("genericError"));
          if (step.reason === "code") setTotp("");
          return;
        }
      }

      const fd = new FormData();
      fd.set("currentPassword", current);
      fd.set("newPassword", next);
      const result = await changePasswordAction(fd);

      if (result?.success) {
        reset();
        setOpen(false);
        setDone(true);
        return;
      }
      console.error("[changePassword]", result);
      if (result?.errorCode === "wrongPassword") setError(t("wrongPassword"));
      else if (result?.errorCode === "mfaRequired") setError(t("mfaRequired"));
      else if (result?.errorCode === "weakPassword") setError(t("weakPassword"));
      else if (result?.errorCode === "noSession") setError(t("mfaRequired"));
      else if (result?.error) setError(result.error);
      else setError(t("genericError"));
    });
  }

  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {t("label")}
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("desc")}</p>

      {done && !open && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          {t("success")}
        </div>
      )}

      <div className="mt-4">
        {!open ? (
          <Button
            variant="secondary"
            onClick={() => {
              setDone(false);
              setOpen(true);
            }}
            className="w-fit"
          >
            <KeyRound className="h-4 w-4" />
            {t("cta")}
          </Button>
        ) : (
          <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
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

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t("new")}
              </label>
              <PasswordInput
                name="newPassword"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="••••••••"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t("policyHint")}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t("confirm")}
              </label>
              <PasswordInput
                name="confirmPassword"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
                disabled={isPending}
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
