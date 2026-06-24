"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { computeLicensePrice, PRICING_CURRENCY } from "@/lib/license/pricing";

/**
 * Calculatrice « devis estimé » : l'admin saisit le nombre d'équipes
 * facturables (formation D/C/B/A + actifs ; le football des enfants G/F/E est
 * inclus gratuitement) et voit le mensuel / annuel. Indicatif, non persisté —
 * découplé du quota d'équipes (qui, lui, est une limite de capacité).
 */
export function LicensePriceEstimate({ defaultBillable = "" }: { defaultBillable?: string }) {
  const t = useTranslations("admin.price");
  const locale = useLocale();
  const [billable, setBillable] = useState(defaultBillable);
  const price = computeLicensePrice(billable ? Number(billable) : null);

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: PRICING_CURRENCY,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        {t("title")}
      </div>

      <label className="mt-2 flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {t("billableLabel")}
        </span>
        <input
          type="number"
          min={0}
          value={billable}
          onChange={(e) => setBillable(e.target.value)}
          placeholder="0"
          className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <span className="text-[11px] text-zinc-400">{t("billableHint")}</span>
      </label>

      {price ? (
        <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
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
            {fmt(price.perTeam)} {t("perTeamSuffix")}
          </div>
        </div>
      ) : (
        <div className="mt-3 border-t border-zinc-200 pt-3 text-[11px] text-zinc-400 dark:border-zinc-800">
          {t("enterBillable")}
        </div>
      )}
    </div>
  );
}
