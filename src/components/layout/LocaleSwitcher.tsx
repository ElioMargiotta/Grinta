"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { useParams } from "next/navigation";
import { Globe } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = {
  fr: "FR",
  en: "EN",
  de: "DE",
  it: "IT",
};

type Variant = "ghost" | "subtle";

export function LocaleSwitcher({ variant = "ghost" }: { variant?: Variant }) {
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onChange = (next: string) => {
    if (next === locale) return;
    startTransition(() => {
      // @ts-expect-error -- next-intl typed pathnames are strict; params are dynamic
      router.replace({ pathname, params }, { locale: next });
    });
  };

  const wrapper =
    "relative inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors";
  const tone =
    variant === "subtle"
      ? "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      : "text-[var(--ink-2)] hover:text-[var(--ink)]";

  return (
    <div className={`${wrapper} ${tone} ${isPending ? "opacity-60" : ""}`}>
      <Globe className="h-3.5 w-3.5" />
      <span>{LABELS[locale] ?? locale.toUpperCase()}</span>
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value)}
        disabled={isPending}
        aria-label="Change language"
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {LABELS[l] ?? l.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}
