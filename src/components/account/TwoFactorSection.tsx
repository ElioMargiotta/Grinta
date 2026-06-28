"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { RecoveryCodesBlock } from "@/components/account/RecoveryCodesBlock";
import { disableMfaAction } from "@/app/[locale]/account/mfa-recovery-actions";

type EnrollState = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function TwoFactorSection({
  enrolled,
  recoveryRemaining,
}: {
  enrolled: boolean;
  recoveryRemaining: number;
}) {
  const t = useTranslations("account.security");
  const router = useRouter();
  const supabase = createClient();
  const [enroll, setEnroll] = useState<EnrollState | null>(null);
  const [code, setCode] = useState("");
  const [disarming, setDisarming] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Démarre l'enrôlement : nettoie d'éventuels facteurs non vérifiés, puis
  // crée un nouveau facteur TOTP et affiche le QR code.
  async function start() {
    setError(null);
    setBusy(true);
    try {
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) {
        if (f.factor_type === "totp" && f.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Grinta ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error || !data) {
        console.error("[2FA enroll]", error);
        setError(error?.message ?? t("genericError"));
        return;
      }
      setEnroll({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } finally {
      setBusy(false);
    }
  }

  // Annule un enrôlement en cours (supprime le facteur non vérifié).
  async function cancel() {
    if (enroll) await supabase.auth.mfa.unenroll({ factorId: enroll.factorId });
    setEnroll(null);
    setCode("");
    setError(null);
  }

  function confirm() {
    if (!enroll || code.length < 6) return;
    setError(null);
    startTransition(async () => {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
      if (challengeError || !challenge) {
        console.error("[2FA challenge]", challengeError);
        setError(challengeError?.message ?? t("genericError"));
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) {
        console.error("[2FA verify]", verifyError);
        setError(t("invalidCode"));
        setCode("");
        return;
      }
      setEnroll(null);
      setCode("");
      router.refresh();
    });
  }

  // Désactiver la 2FA est sensible → vérification CÔTÉ SERVEUR d'un code TOTP
  // OU d'un code de secours (perte du téléphone) avant de retirer le facteur.
  function disable() {
    if (disableCode.trim().length < 6) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("code", disableCode.trim());
      const result = await disableMfaAction(fd);
      if (result?.success) {
        setDisarming(false);
        setDisableCode("");
        router.refresh();
        return;
      }
      console.error("[disable mfa]", result);
      if (result?.errorCode === "invalidCode") setError(t("invalidCode"));
      else setError(t("genericError"));
      setDisableCode("");
    });
  }

  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {t("label")}
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("desc")}</p>

      <div className="mt-4">
        {enrolled ? (
          /* ── Déjà activée ─────────────────────────────────────────── */
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-950/30">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-100">
                <ShieldCheck className="h-4 w-4" />
                {t("enabled")}
              </span>
              {!disarming && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    setDisarming(true);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <ShieldOff className="h-4 w-4" />
                  {t("disable")}
                </Button>
              )}
            </div>

            {disarming && (
              <div className="mt-3 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-950/20">
                <p className="text-sm text-red-900 dark:text-red-200">
                  {t("disableConfirm")}
                </p>
                <input
                  autoComplete="one-time-code"
                  maxLength={11}
                  placeholder={t("disableCodePlaceholder")}
                  value={disableCode}
                  onChange={(e) =>
                    setDisableCode(e.target.value.toUpperCase().replace(/\s/g, ""))
                  }
                  className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-center text-lg font-medium tracking-[0.2em] text-zinc-900 placeholder:tracking-normal placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                {error && <p className="text-sm text-red-700">{error}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={disable}
                    loading={isPending}
                    disabled={isPending || disableCode.length < 6}
                  >
                    <ShieldOff className="h-4 w-4" />
                    {t("disableConfirmCta")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDisarming(false);
                      setDisableCode("");
                      setError(null);
                    }}
                    disabled={isPending}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            )}

            <RecoveryCodesBlock remaining={recoveryRemaining} />
          </>
        ) : enroll ? (
          /* ── Enrôlement en cours : QR + code ──────────────────────── */
          <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t("scanHint")}
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- data:URL SVG renvoyé par Supabase, non géré par next/image */}
              <img
                src={enroll.qrCode}
                alt="QR code"
                width={160}
                height={160}
                className="rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-700"
              />
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-zinc-600 dark:text-zinc-400">{t("manualHint")}</p>
                <code className="mt-1 block break-all rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  {enroll.secret}
                </code>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="totp-enroll-code"
                className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                {t("codeLabel")}
              </label>
              <input
                id="totp-enroll-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-center text-lg font-medium tracking-[0.3em] text-zinc-900 placeholder:tracking-normal placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={confirm}
                loading={isPending}
                disabled={isPending || code.length < 6}
              >
                {t("confirm")}
              </Button>
              <Button variant="ghost" onClick={cancel} disabled={isPending}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          /* ── Désactivée : proposer d'activer ──────────────────────── */
          <div className="flex flex-col gap-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={start} disabled={busy} className="w-fit">
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {t("enable")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
