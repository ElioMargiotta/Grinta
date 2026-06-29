"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// Connexion sociale Google / Apple (Lot A). Le flux PKCE renvoie sur notre
// route /{locale}/auth/callback qui échange le code puis redirige vers `next`.
// Les providers doivent être activés dans Supabase (Auth → Providers) avec
// l'URL de callback en liste blanche ; sans config, le bouton renverra une
// erreur claire côté Supabase.

const GoogleIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
    />
  </svg>
);

const AppleIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M16.36 12.78c.02 2.5 2.19 3.33 2.22 3.34-.02.06-.35 1.2-1.15 2.37-.69 1.02-1.41 2.03-2.54 2.05-1.11.02-1.47-.66-2.74-.66-1.27 0-1.67.64-2.72.68-1.09.04-1.92-1.1-2.62-2.11-1.42-2.07-2.51-5.85-1.05-8.41.72-1.27 2.02-2.08 3.43-2.1 1.07-.02 2.08.72 2.74.72.65 0 1.88-.89 3.17-.76.54.02 2.06.22 3.03 1.65-.08.05-1.81 1.06-1.79 3.16M14.3 4.85c.58-.7.97-1.68.86-2.65-.84.03-1.85.56-2.45 1.26-.54.62-1.01 1.61-.88 2.56.93.07 1.89-.47 2.47-1.17" />
  </svg>
);

export function OAuthButtons({
  next,
  variant = "buttons",
}: {
  next?: string;
  variant?: "buttons" | "icons";
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: "google" | "apple") {
    setError(null);
    setLoading(provider);
    const supabase = createClient();
    const origin = window.location.origin;
    const nextPath = next && next.startsWith("/") ? next : "/dashboard";
    const redirectTo = `${origin}/${locale}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
    // En cas de succès, le navigateur est redirigé vers le provider.
  }

  if (variant === "icons") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-xs text-[var(--ink-3)]">
          <span className="h-px flex-1 bg-[var(--line)]" />
          {t("orSeparator")}
          <span className="h-px flex-1 bg-[var(--line)]" />
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => signIn("google")}
            disabled={loading !== null}
            aria-label={t("continueWithGoogle")}
            title={t("continueWithGoogle")}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--paper)] transition-colors hover:border-[var(--line-2)] hover:bg-[var(--bg-2)] disabled:opacity-60"
          >
            <GoogleIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => signIn("apple")}
            disabled={loading !== null}
            aria-label={t("continueWithApple")}
            title={t("continueWithApple")}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] transition-colors hover:border-[var(--line-2)] hover:bg-[var(--bg-2)] disabled:opacity-60"
          >
            <AppleIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => signIn("google")}
          disabled={loading !== null}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          <GoogleIcon />
          {t("continueWithGoogle")}
        </button>
        <button
          type="button"
          onClick={() => signIn("apple")}
          disabled={loading !== null}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          <AppleIcon />
          {t("continueWithApple")}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("orSeparator")}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
