"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Script from "next/script";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      execution: "execute";
      appearance: "execute";
      size: "flexible";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileHandle = {
  execute: () => Promise<string | null>;
  reset: () => void;
};

// CAPTCHA anti-bot Cloudflare Turnstile. ENV-GATED : si
// NEXT_PUBLIC_TURNSTILE_SITE_KEY n'est pas défini, execute() retourne null et
// le flux d'auth reste inchangé (dev local sans clé). En prod, le widget est
// rendu en mode manuel : il ne lance le challenge qu'au submit du formulaire.
export const TurnstileWidget = forwardRef<TurnstileHandle>(function TurnstileWidget(
  _props,
  ref,
) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pendingRef = useRef<{
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || widgetIdRef.current) {
      return;
    }

    const turnstile = window.turnstile;
    if (!turnstile) return;

    widgetIdRef.current = turnstile.render(containerRef.current, {
      sitekey: siteKey,
      execution: "execute",
      appearance: "execute",
      size: "flexible",
      callback(token) {
        pendingRef.current?.resolve(token);
        pendingRef.current = null;
      },
      "error-callback"() {
        pendingRef.current?.reject(new Error("captcha_failed"));
        pendingRef.current = null;
      },
      "expired-callback"() {
        pendingRef.current?.reject(new Error("captcha_expired"));
        pendingRef.current = null;
      },
    });
  }, [scriptReady, siteKey]);

  useImperativeHandle(
    ref,
    () => ({
      execute() {
        if (!siteKey) return Promise.resolve(null);
        const widgetId = widgetIdRef.current;
        const turnstile = window.turnstile;
        if (!widgetId || !turnstile) {
          return Promise.reject(new Error("captcha_not_ready"));
        }

        pendingRef.current?.reject(new Error("captcha_interrupted"));
        return new Promise<string>((resolve, reject) => {
          pendingRef.current = { resolve, reject };
          turnstile.execute(widgetId);
        });
      },
      reset() {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
        pendingRef.current = null;
      },
    }),
    [siteKey],
  );

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} />
    </>
  );
});
