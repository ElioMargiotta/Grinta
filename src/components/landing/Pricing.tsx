"use client";

import { useMessages, useTranslations } from "next-intl";
import { Check, Gift } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Reveal } from "./Reveal";

type Tier = {
  name: string;
  originalPrice?: string;
  discountLabel?: string;
  price: string;
  priceSuffix: string;
  highlight?: string;
  sub: string;
  features: string[];
  notes?: string[];
  cta: string;
  href?: string;
};

export function Pricing() {
  const t = useTranslations("landing.pricing");
  const messages = useMessages() as {
    landing: { pricing: { tiers: Tier[] } };
  };
  const tiers = messages.landing.pricing.tiers;

  return (
    <section id="tarifs" className="relative py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal>
          <div className="max-w-2xl">
            <div className="eyebrow-mono">{t("eyebrow")}</div>
            <h2 className="h-display mt-4 text-[clamp(1.6rem,5.5vw,3rem)] font-semibold">
              {t("title")}
            </h2>
          </div>
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          {tiers.map((tier, i) => {
            const featured = i === 1;
            return (
              <Reveal key={tier.name} delay={i * 80}>
                <div
                  className={
                    "flex h-full flex-col gap-5 rounded-2xl border p-7 transition-transform hover:-translate-y-1 " +
                    (featured ? "border-accent" : "")
                  }
                  style={{
                    borderColor: featured ? undefined : "var(--line)",
                    background: featured ? "var(--paper)" : "transparent",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium">{tier.name}</span>
                    {featured && (
                      <span className="bg-accent-soft text-accent-ink rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest">
                        {t("recommended")}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {(tier.originalPrice || tier.discountLabel) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {tier.originalPrice && (
                          <span
                            className="text-sm font-medium line-through"
                            style={{ color: "var(--ink-3)" }}
                          >
                            {tier.originalPrice}
                          </span>
                        )}
                        {tier.discountLabel && (
                          <span className="bg-accent-soft text-accent-ink rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest">
                            {tier.discountLabel}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-semibold tracking-tight">
                        {tier.price}
                      </span>
                      {tier.priceSuffix && (
                        <span
                          className="font-mono text-[12px]"
                          style={{ color: "var(--ink-3)" }}
                        >
                          {tier.priceSuffix}
                        </span>
                      )}
                    </div>
                  </div>
                  {tier.highlight && (
                    <div
                      className="flex items-center gap-2 rounded-xl px-3.5 py-3 text-[14px] font-semibold"
                      style={{
                        background: "var(--brand-soft)",
                        color: "var(--brand-ink)",
                      }}
                    >
                      <Gift className="h-[18px] w-[18px] shrink-0" />
                      {tier.highlight}
                    </div>
                  )}
                  <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
                    {tier.sub}
                  </p>
                  <ul
                    className="flex flex-col gap-2 text-[13px]"
                    style={{ color: "var(--ink-2)" }}
                  >
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check
                          className="h-3.5 w-3.5"
                          style={{ color: "var(--brand-ink)" }}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {tier.notes && tier.notes.length > 0 && (
                    <ul
                      className="flex flex-col gap-1 pt-1 text-[11px] leading-relaxed"
                      style={{
                        color: "var(--ink-3)",
                        borderTop: "1px solid var(--line)",
                      }}
                    >
                      {tier.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={tier.href ?? "/signup"}
                    className={
                      "mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-medium " +
                      (featured ? "btn-accent" : "btn-ink")
                    }
                  >
                    {tier.cta}
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal>
          <p
            className="mx-auto mt-10 max-w-2xl text-center text-[13px] leading-relaxed"
            style={{ color: "var(--ink-2)" }}
          >
            {t("jsNote")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
