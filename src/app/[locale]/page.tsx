import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePersona } from "@/lib/club/persona";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { NavBar } from "@/components/landing/NavBar";
import { Reveal } from "@/components/landing/Reveal";
import { Hero } from "@/components/landing/Hero";
import { ProfilSerpentin } from "@/components/landing/ProfilSerpentin";
import { TrustedBy } from "@/components/landing/TrustedBy";
import { Pricing } from "@/components/landing/Pricing";
import { FooterBar } from "@/components/landing/Footer";

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
        <ProfilSerpentin />
        <TrustedBy />
        <Pricing />
        <FinalCTA />
      </main>

      <FooterBar />
    </div>
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
            className="relative overflow-hidden rounded-3xl px-8 py-14 sm:px-14 sm:py-20"
            style={{ background: "var(--ink)", color: "var(--bg)" }}
          >
            <div className="pitch-stripes pointer-events-none absolute inset-0 opacity-[0.18]" />
            <div
              className="pointer-events-none absolute -inset-40"
              style={{
                background:
                  "radial-gradient(40% 40% at 80% 30%, color-mix(in oklch, var(--brand) 50%, transparent) 0%, transparent 60%)",
              }}
            />
            <div className="relative grid items-end gap-10 lg:grid-cols-12">
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
                  <span className="italic" style={{ color: "var(--brand)" }}>
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
              <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
                <Link
                  href="/signup"
                  className="btn-accent inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-[14px] font-medium lg:w-auto"
                >
                  {t("cta")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#profils"
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
