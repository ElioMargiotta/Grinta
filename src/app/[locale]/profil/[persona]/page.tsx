import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { NavBar } from "@/components/landing/NavBar";
import { FooterBar } from "@/components/landing/Footer";
import { PERSONAS, isProfilePersona, profileThemeStyle } from "@/components/landing/profils/theme";

export function generateStaticParams() {
  return PERSONAS.map((persona) => ({ persona }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; persona: string }>;
}): Promise<Metadata> {
  const { locale, persona } = await params;
  if (!isProfilePersona(persona)) return {};
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: `landing.profils.${persona}` });
  return { title: `${t("title")} · Grinta` };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string; persona: string }>;
}) {
  const { locale, persona } = await params;
  if (!isProfilePersona(persona)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations(`landing.profils.${persona}`);
  const tNav = await getTranslations("landing.profils.section");

  return (
    <div
      className="relative isolate min-h-screen overflow-x-clip"
      style={{ ...profileThemeStyle(persona), backgroundColor: "var(--bg)", color: "var(--ink)" }}
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
        <section className="relative pb-24 pt-16 lg:pb-28 lg:pt-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Link
              href="/#profils"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:text-[var(--ink)]"
              style={{ color: "var(--ink-2)" }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {tNav("back")}
            </Link>
            <div className="mt-8 max-w-2xl">
              <div className="eyebrow-mono">{t("eyebrow")}</div>
              <h1
                className="h-display mt-4 text-[clamp(2rem,7vw,4rem)] font-semibold"
                style={{ textWrap: "balance" }}
              >
                {t("title")}
              </h1>
              <p
                className="mt-5 text-[16px] leading-relaxed"
                style={{ color: "var(--ink-2)", textWrap: "pretty" }}
              >
                {t("intro")}
              </p>
            </div>
          </div>
        </section>
      </main>

      <FooterBar />
    </div>
  );
}
