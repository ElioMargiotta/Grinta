"use client";

import { useState, useTransition } from "react";
import { KeyRound, Copy, Check, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { generateRecoveryCodesAction } from "@/app/[locale]/account/mfa-recovery-actions";

const codeInputClass =
  "h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-center text-lg font-medium tracking-[0.3em] text-zinc-900 placeholder:tracking-normal placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function RecoveryCodesBlock({ remaining }: { remaining: number }) {
  const t = useTranslations("account.security.recovery");
  const router = useRouter();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [prompting, setPrompting] = useState(false);
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generate() {
    if (totp.length < 6) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("code", totp);
      const result = await generateRecoveryCodesAction(fd);
      if (result?.codes) {
        setCodes(result.codes);
        setPrompting(false);
        setTotp("");
        setCopied(false);
      } else if (result?.errorCode === "invalidCode") {
        setError(t("invalidCode"));
        setTotp("");
      } else {
        console.error("[recovery codes]", result);
        setError(t("genericError"));
      }
    });
  }

  function copy() {
    if (!codes) return;
    navigator.clipboard.writeText(codes.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function done() {
    setCodes(null);
    router.refresh();
  }

  if (codes) {
    return (
      <div className="mt-3 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
        <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("warning")}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-md bg-white p-3 font-mono text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
          {codes.map((c) => (
            <span key={c} className="tracking-wider">
              {c}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t("copied") : t("copy")}
          </Button>
          <Button size="sm" onClick={done}>
            {t("acknowledge")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            <KeyRound className="h-4 w-4" />
            {t("title")}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {remaining > 0 ? t("remaining", { count: remaining }) : t("none")}
          </p>
        </div>
        {!prompting && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setError(null);
              setPrompting(true);
            }}
          >
            {remaining > 0 ? t("regenerate") : t("generate")}
          </Button>
        )}
      </div>

      {prompting && (
        <div className="mt-3 flex flex-col gap-2">
          <label
            htmlFor="recovery-gen-code"
            className="text-xs text-zinc-600 dark:text-zinc-400"
          >
            {t("codeLabel")}
          </label>
          <input
            id="recovery-gen-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="••••••"
            value={totp}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className={codeInputClass}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={generate}
              loading={isPending}
              disabled={isPending || totp.length < 6}
            >
              {t("confirm")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPrompting(false);
                setTotp("");
                setError(null);
              }}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
      {error && !prompting && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
