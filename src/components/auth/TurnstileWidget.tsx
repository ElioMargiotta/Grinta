"use client";

import Script from "next/script";

// CAPTCHA anti-bot Cloudflare Turnstile (Lot A), gratuit. ENV-GATED : si
// NEXT_PUBLIC_TURNSTILE_SITE_KEY n'est pas défini, le composant ne rend rien et
// le flux d'auth reste inchangé (dev local sans clé). Lorsqu'il est rendu,
// Turnstile injecte automatiquement un input caché `cf-turnstile-response`
// DANS le <form> parent ; les server actions le lisent et le passent à Supabase
// via options.captchaToken. La protection CAPTCHA doit aussi être activée côté
// Supabase (Auth → Settings → Enable CAPTCHA protection, secret Turnstile).
export function TurnstileWidget() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
      />
      <div className="cf-turnstile" data-sitekey={siteKey} data-size="flexible" />
    </>
  );
}
