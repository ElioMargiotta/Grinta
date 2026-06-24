import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { ArrowLeft, Mail } from "lucide-react";
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
  const defaultMessage = topic === "devis" ? t("form.devisMessage") : undefined;

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

        <div className="mt-12">
          <ContactForm defaultMessage={defaultMessage} />
        </div>
      </main>
    </div>
  );
}
