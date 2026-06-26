import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { ArrowLeft, Check, Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { NavBar } from "@/components/landing/NavBar";
import { ContactForm } from "@/components/landing/ContactForm";

const CONTACT_EMAIL = "contact@grinta.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: `${t("title")} · Grinta` };
}

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ topic?: string }>;
}) {
  const { locale } = await params;
  const { topic } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("contact");
  const isDevis = topic === "devis";
  const defaultMessage = isDevis ? t("form.devisMessage") : undefined;
  const devisPoints = isDevis ? (t.raw("devis.points") as string[]) : [];

  return (
    <div
      className="min-h-screen shrink-0"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <NavBar />
      <main className="mx-auto max-w-3xl px-6 lg:px-10 py-16 lg:py-24">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:text-[var(--ink)]"
          style={{ color: "var(--ink-2)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("backToHome")}
        </Link>

        <h1 className="h-display mt-6 text-4xl sm:text-5xl font-semibold">
          {t("title")}
        </h1>
        <p
          className="mt-6 text-[15px] leading-relaxed"
          style={{ color: "var(--ink-2)", textWrap: "pretty" }}
        >
          {t("intro")}
        </p>

        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-6 inline-flex items-center gap-2 text-[14px] font-medium transition-colors hover:text-[var(--ink)]"
          style={{ color: "var(--ink-2)" }}
        >
          <Mail className="h-4 w-4" />
          {CONTACT_EMAIL}
        </a>

        {isDevis && (
          <div
            className="mt-10 rounded-2xl p-6"
            style={{ border: "1px solid var(--line)", background: "var(--paper)" }}
          >
            <div className="text-[13px] font-medium">{t("devis.title")}</div>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {devisPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2 text-[13px]"
                  style={{ color: "var(--ink-2)" }}
                >
                  <Check
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    style={{ color: "var(--brand-ink)" }}
                  />
                  {point}
                </li>
              ))}
            </ul>
            <p
              className="mt-5 text-[13px] leading-relaxed"
              style={{ color: "var(--ink-2)" }}
            >
              {t("devis.pricing")}
            </p>
            <p
              className="mt-3 rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed"
              style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}
            >
              {t("devis.js")}
            </p>
          </div>
        )}

        <div className="mt-12">
          <ContactForm defaultMessage={defaultMessage} />
        </div>
      </main>
    </div>
  );
}
