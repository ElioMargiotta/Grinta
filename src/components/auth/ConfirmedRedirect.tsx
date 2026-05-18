"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

const REDIRECT_SECONDS = 10;

export function ConfirmedRedirect() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (seconds <= 0) {
      router.replace("/login");
      return;
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds, router]);

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-7 w-7 text-emerald-600"
          aria-hidden="true"
        >
          <path
            d="M20 6 9 17l-5-5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          {t("confirmedTitle")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">{t("confirmedBody")}</p>
      </div>

      <p className="text-sm text-zinc-500">
        {t("confirmedRedirect")} ({seconds})
      </p>

      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
      >
        {t("confirmedCta")}
      </Link>
    </div>
  );
}
