"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { fieldVariants } from "@/components/ui/field";
import { cn } from "@/lib/utils";
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
    <div className="rounded-lg border border-border bg-muted p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("title")}
      </div>

      <label className="mt-2 flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">
          {t("billableLabel")}
        </span>
        <input
          type="number"
          min={0}
          value={billable}
          onChange={(e) => setBillable(e.target.value)}
          placeholder="0"
          className={cn(fieldVariants(), "w-28 px-3 py-2")}
        />
        <span className="text-[11px] text-muted-foreground">{t("billableHint")}</span>
      </label>

      {price ? (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <div className="text-lg font-semibold tabular-nums text-foreground">
              {fmt(price.monthly)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">{t("monthly")}</span>
            </div>
            <div className="text-sm font-medium tabular-nums text-foreground">
              {fmt(price.annual)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {t("annual")} · {t("annualNote")}
              </span>
            </div>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {fmt(price.perTeam)} {t("perTeamSuffix")}
          </div>
        </div>
      ) : (
        <div className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
          {t("enterBillable")}
        </div>
      )}
    </div>
  );
}
