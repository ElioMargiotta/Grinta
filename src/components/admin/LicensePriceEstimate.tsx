"use client";

import { useLocale, useTranslations } from "next-intl";
import { computeLicensePrice, PRICING_CURRENCY } from "@/lib/license/pricing";

/**
 * Encart « devis estimé » calculé en direct à partir du nombre d'équipes du
 * formulaire. Indicatif — l'admin reste libre du montant réel.
 */
export function LicensePriceEstimate({ teams }: { teams: number | null }) {
  const t = useTranslations("admin.price");
  const locale = useLocale();
  const price = computeLicensePrice(teams);

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: PRICING_CURRENCY,
      maximumFractionDigits: 0,
    }).format(n);

  if (!price) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        {t("unlimited")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        {t("title")}
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
          {fmt(price.monthly)}
          <span className="ml-1 text-xs font-normal text-zinc-500">{t("monthly")}</span>
        </div>
        <div className="text-sm font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
          {fmt(price.annual)}
          <span className="ml-1 text-xs font-normal text-zinc-500">
            {t("annual")} · {t("annualNote")}
          </span>
        </div>
      </div>
      <div className="mt-1 text-[11px] text-zinc-400">
        {fmt(price.perTeam)} {t("perTeamSuffix")} · {t("hint")}
      </div>
    </div>
  );
}
