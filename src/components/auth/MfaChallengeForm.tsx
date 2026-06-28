"use client";

import { useEffect, useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { consumeRecoveryCodeAction } from "@/app/[locale]/account/mfa-recovery-actions";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-center text-lg font-medium tracking-[0.3em] text-foreground placeholder:tracking-normal placeholder:text-muted-foreground focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--brand)_22%,transparent)]";

export function MfaChallengeForm() {
  const t = useTranslations("auth.mfa");
  const router = useRouter();
  const supabase = createClient();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingFactor, setLoadingFactor] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Récupère le facteur TOTP vérifié du compte au montage.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!active) return;
      const totp = data?.totp?.[0];
      if (error || !totp) {
        setError(t("noFactor"));
      } else {
        setFactorId(totp.id);
      }
      setLoadingFactor(false);
    })();
    return () => {
      active = false;
    };
  }, [supabase, t]);

  function submitTotp() {
    if (!factorId || code.length < 6) return;
    setError(null);
    startTransition(async () => {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) {
        setError(t("genericError"));
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) {
        setError(t("invalidCode"));
        setCode("");
        return;
      }
      // Session élevée en aal2 — la page racine redirige selon le persona.
      router.replace("/");
    });
  }

  function submitRecovery() {
    const cleaned = recovery.trim();
    if (cleaned.length < 8) {
      setError(t("recovery.invalid"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("code", cleaned);
      const result = await consumeRecoveryCodeAction(fd);
      if (result?.success) {
        // Facteur désactivé + session repassée en aal1 : accès débloqué.
        router.replace("/");
        return;
      }
      if (result?.errorCode === "invalidCode") setError(t("recovery.invalid"));
      else setError(t("genericError"));
      setRecovery("");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-soft)]">
          <ShieldCheck className="h-6 w-6 text-[var(--brand-ink)]" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "totp" ? t("subtitle") : t("recovery.subtitle")}
          </p>
        </div>
      </div>

      {mode === "totp" ? (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submitTotp();
          }}
        >
          <AuthField label={t("codeLabel")} htmlFor="mfa-code" required>
            <input
              id="mfa-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              placeholder="••••••"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className={inputClass}
              disabled={loadingFactor || !factorId}
            />
          </AuthField>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            loading={isPending}
            loadingLabel={t("verifying")}
            disabled={isPending || code.length < 6 || !factorId}
            className="w-full"
          >
            {t("verify")}
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submitRecovery();
          }}
        >
          <AuthField
            label={t("recovery.label")}
            htmlFor="recovery-code"
            required
          >
            <input
              id="recovery-code"
              name="recovery"
              autoComplete="one-time-code"
              required
              autoFocus
              placeholder="XXXXX-XXXXX"
              value={recovery}
              onChange={(e) => setRecovery(e.target.value.toUpperCase())}
              className={`${inputClass} tracking-[0.2em]`}
            />
          </AuthField>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            loading={isPending}
            loadingLabel={t("verifying")}
            disabled={isPending || recovery.trim().length < 8}
            className="w-full"
          >
            {t("recovery.submit")}
          </Button>
        </form>
      )}

      <button
        type="button"
        onClick={() => {
          setError(null);
          setMode((m) => (m === "totp" ? "recovery" : "totp"));
        }}
        className="text-center text-sm font-medium text-[var(--brand-ink)] underline"
      >
        {mode === "totp" ? t("recovery.use") : t("recovery.back")}
      </button>

      {mode === "totp" && (
        <p className="text-center text-xs text-muted-foreground">{t("hint")}</p>
      )}
    </div>
  );
}
