import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePersona } from "@/lib/club/persona";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMessages } from "next-intl/server";
import { ArrowRight, Check, Gift } from "lucide-react";
import { NavBar } from "@/components/landing/NavBar";
import { Reveal } from "@/components/landing/Reveal";
import {
  GrintaLogoIcon,
  GrintaLogoType,
  GrintaLogoTagline,
} from "@/components/landing/BrandSeal";
import {
  FlowSection,
  PlayerFlowSection,
} from "@/components/landing/FlowSection";
import { ManifestoLine } from "@/components/landing/ManifestoLine";

type Pillar = { kicker: string; title: string; body: string };
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
type FooterLink = { label: string; href: string };
type FooterCol = { title: string; links: FooterLink[] };

export default async function LocaleHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Dispatch to the active persona's landing. Player-only accounts go
    // straight to /me; staff (or dual with staff active) keep /dashboard.
    const persona = await resolvePersona();
    redirect({
      href: persona?.active === "player" ? "/me" : "/dashboard",
      locale,
    });
  }

  const messages = (await getMessages()) as {
    landing: {
      manifesto: { pillars: Pillar[] };
      pricing: { tiers: Tier[] };
      footer: { cols: FooterCol[] };
    };
  };

  return (
    <div
      className="relative isolate min-h-screen overflow-x-clip"
      style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
        <span className="blob blob-d" />
        <span className="blob blob-e" />
        <span className="blob blob-f" />
      </div>
      <NavBar />

      <main>
        <Hero />
        <Manifesto pillars={messages.landing.manifesto.pillars} />
        <FlowSection />
        <PlayerFlowSection />
        <PricingSection tiers={messages.landing.pricing.tiers} />
        <FinalCTA />
      </main>

      <FooterBar cols={messages.landing.footer.cols} />
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────
async function Hero() {
  const t = await getTranslations("landing.hero");
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-6 lg:px-10 pt-16 pb-24 lg:pt-24 lg:pb-28">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-end">
          <div className="lg:col-span-6">
            <Reveal>
              <div className="eyebrow-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full dot-accent" />
                {t("eyebrow")}
              </div>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="h-display mt-5 text-[clamp(1.9rem,8vw,4.5rem)] font-semibold">
                {t("title1")}
                <br />
                {t("title2Prefix")}{" "}
                <span className="text-accent-ink italic">{t("title2Accent")}</span>
                {t("title2Suffix")}
                <br />
                {t("title3")}
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p
                className="mt-6 max-w-xl text-[16px] leading-relaxed"
                style={{ color: "var(--ink-2)", textWrap: "pretty" }}
              >
                {t("subtitle")}
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#flow"
                  className="inline-flex items-center gap-2 text-[14px] font-medium px-5 py-3 rounded-lg btn-accent"
                >
                  {t("ctaHow")}
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#tarifs"
                  className="inline-flex items-center gap-2 text-[14px] font-medium px-5 py-3 rounded-lg border"
                  style={{ borderColor: "var(--line-2)" }}
                >
                  {t("ctaPricing")}
                </a>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <dl className="mt-12 grid grid-cols-3 gap-4 sm:gap-6 max-w-lg [&>div]:min-w-0">
                <div>
                  <dt
                    className="text-[11px] font-mono uppercase tracking-widest"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {t("stat1Label")}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight">
                    {t("stat1Value")}
                  </dd>
                </div>
                <div>
                  <dt
                    className="text-[11px] font-mono uppercase tracking-widest"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {t("stat2Label")}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight">
                    {t("stat2Value")}
                  </dd>
                </div>
                <div>
                  <dt
                    className="text-[11px] font-mono uppercase tracking-widest"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {t("stat3Label")}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight">
                    {t("stat3Value")}
                  </dd>
                </div>
              </dl>
            </Reveal>
          </div>
          <div className="hidden lg:block lg:col-span-6">
            <Reveal delay={200}>
              <div className="relative mx-auto flex w-full max-w-[520px] flex-col items-center gap-6">
                <GrintaLogoIcon
                  size={420}
                  title="Grinta"
                  className="h-auto w-full max-w-[420px]"
                />
                <div className="flex flex-col items-center gap-3">
                  <GrintaLogoType
                    height={56}
                    title="GRINTA"
                    className="h-auto w-auto max-w-[320px]"
                  />
                  <GrintaLogoTagline
                    height={18}
                    title={t("tagline")}
                    className="h-auto w-auto max-w-[320px] opacity-80"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Manifesto ─────────────────────────────────────────────────────────────
async function Manifesto({ pillars }: { pillars: Pillar[] }) {
  const t = await getTranslations("landing.manifesto");
  return (
    <section id="methode" className="relative py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal>
          <div className="max-w-3xl">
            <div className="eyebrow-mono">{t("eyebrow")}</div>
            <h2
              className="h-display mt-4 text-[clamp(1.6rem,5.5vw,3rem)] font-semibold tracking-tight"
              style={{ textWrap: "balance" }}
            >
              {t("title")}
            </h2>
            <p
              className="mt-5 text-[15px] leading-relaxed"
              style={{ color: "var(--ink-2)", textWrap: "pretty" }}
            >
              {t("body")}
            </p>
          </div>
        </Reveal>
        <div className="mt-16 hidden md:block">
          <ManifestoLine />
          <div className="mt-8 grid md:grid-cols-3 gap-12">
            {pillars.map((p, i) => (
              <Reveal key={p.kicker} delay={i * 120}>
                <div className="flex flex-col gap-3 text-center">
                  <span
                    className="font-mono text-[11px] tracking-widest"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {p.kicker}
                  </span>
                  <h3
                    className="text-3xl font-semibold tracking-tight"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {p.title}
                  </h3>
                  <p
                    className="text-[14px] leading-relaxed mx-auto max-w-xs"
                    style={{ color: "var(--ink-2)", textWrap: "pretty" }}
                  >
                    {p.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="md:hidden mt-12 flex flex-col gap-10">
          {pillars.map((p, i) => (
            <Reveal key={p.kicker} delay={i * 80}>
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="mt-2 w-2.5 h-2.5 rounded-full dot-accent shrink-0"
                />
                <div className="flex flex-col gap-2">
                  <span
                    className="font-mono text-[11px] tracking-widest"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {p.kicker}
                  </span>
                  <h3
                    className="text-2xl font-semibold tracking-tight"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {p.title}
                  </h3>
                  <p
                    className="text-[14px] leading-relaxed"
                    style={{ color: "var(--ink-2)", textWrap: "pretty" }}
                  >
                    {p.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing ──────────────────────────────────────────────────────────────
async function PricingSection({ tiers }: { tiers: Tier[] }) {
  const t = await getTranslations("landing.pricing");
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
                    "h-full rounded-2xl border p-7 flex flex-col gap-5 transition-transform hover:-translate-y-1 " +
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
                      <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-accent-soft text-accent-ink">
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
                          <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-accent-soft text-accent-ink">
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
                          className="text-[12px] font-mono"
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
                      style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}
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
                      className="flex flex-col gap-1 text-[11px] leading-relaxed pt-1"
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
                      "mt-auto inline-flex justify-center items-center gap-1.5 text-[13px] font-medium px-4 py-2.5 rounded-lg " +
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

// ── Final CTA ────────────────────────────────────────────────────────────
async function FinalCTA() {
  const t = await getTranslations("landing.finalCta");
  return (
    <section id="cta" className="py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal>
          <div
            className="rounded-3xl px-8 py-14 sm:px-14 sm:py-20 relative overflow-hidden"
            style={{ background: "var(--ink)", color: "var(--bg)" }}
          >
            <div className="absolute inset-0 pitch-stripes opacity-[0.18] pointer-events-none" />
            <div
              className="absolute -inset-40 pointer-events-none"
              style={{
                background:
                  "radial-gradient(40% 40% at 80% 30%, color-mix(in oklch, var(--brand) 50%, transparent) 0%, transparent 60%)",
              }}
            />
            <div className="relative grid lg:grid-cols-12 gap-10 items-end">
              <div className="lg:col-span-8">
                <div
                  className="eyebrow-mono"
                  style={{ color: "color-mix(in oklch, var(--bg) 55%, transparent)" }}
                >
                  {t("eyebrow")}
                </div>
                <h2
                  className="h-display mt-4 text-[clamp(1.9rem,6vw,3.75rem)] font-semibold"
                  style={{ textWrap: "balance" }}
                >
                  {t("title1")}
                  <br />
                  <span
                    className="italic"
                    style={{ color: "var(--brand)" }}
                  >
                    {t("title2Accent")}
                  </span>{" "}
                  {t("title2Suffix")}
                </h2>
                <p
                  className="mt-6 max-w-xl text-[15px] leading-relaxed"
                  style={{
                    color: "color-mix(in oklch, var(--bg) 70%, transparent)",
                    textWrap: "pretty",
                  }}
                >
                  {t("body")}
                </p>
              </div>
              <div className="lg:col-span-4 flex flex-col gap-3 lg:items-end">
                <Link
                  href="/signup"
                  className="w-full lg:w-auto inline-flex justify-center items-center gap-2 text-[14px] font-medium px-6 py-3.5 rounded-lg btn-accent"
                >
                  {t("cta")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#flow"
                  className="text-[13px] font-medium"
                  style={{ color: "color-mix(in oklch, var(--bg) 70%, transparent)" }}
                >
                  {t("ctaSecondary")}
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────
async function FooterBar({ cols }: { cols: FooterCol[] }) {
  const t = await getTranslations("landing.footer");
  return (
    <footer
      className="pt-16 pb-10"
      style={{ borderTop: "1px solid var(--line)" }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2">
              <GrintaLogoIcon size={32} title="Grinta" />
              <GrintaLogoType height={18} title="GRINTA" />
            </div>
            <p
              className="mt-4 text-[13px] leading-relaxed max-w-xs"
              style={{ color: "var(--ink-3)", textWrap: "pretty" }}
            >
              {t("tagline")}
            </p>
            <div
              className="mt-6 text-[11px] font-mono"
              style={{ color: "var(--ink-3)" }}
            >
              {t("copyright")}
            </div>
          </div>
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {cols.map((c) => (
              <div key={c.title}>
                <div
                  className="text-[11px] font-mono uppercase tracking-widest"
                  style={{ color: "var(--ink-3)" }}
                >
                  {c.title}
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {c.links.map((l) => (
                    <li key={l.href}>
                      {l.href.startsWith("#") ? (
                        <a
                          href={l.href}
                          className="text-[13px] hover:text-[var(--ink)] transition-colors"
                          style={{ color: "var(--ink-2)" }}
                        >
                          {l.label}
                        </a>
                      ) : (
                        <Link
                          href={l.href}
                          className="text-[13px] hover:text-[var(--ink)] transition-colors"
                          style={{ color: "var(--ink-2)" }}
                        >
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
