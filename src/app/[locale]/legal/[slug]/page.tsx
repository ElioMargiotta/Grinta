import { getMessages, setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { NavBar } from "@/components/landing/NavBar";

const SLUGS = ["mentions-legales", "cgv", "confidentialite"] as const;
type Slug = (typeof SLUGS)[number];

type LegalSection = { heading: string; body: string[] };
type LegalDoc = { title: string; intro: string; sections: LegalSection[] };
type LegalMessages = {
  legal: {
    backToHome: string;
    lastUpdated: string;
    docs: Record<Slug, LegalDoc>;
  };
};

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

function isSlug(value: string): value is Slug {
  return (SLUGS as readonly string[]).includes(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSlug(slug)) return {};
  setRequestLocale(locale);
  const messages = (await getMessages()) as unknown as LegalMessages;
  const doc = messages.legal.docs[slug];
  return { title: `${doc.title} · Grinta` };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isSlug(slug)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("legal");
  const messages = (await getMessages()) as unknown as LegalMessages;
  const doc = messages.legal.docs[slug];

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
          {doc.title}
        </h1>
        <p
          className="mt-3 text-[12px] font-mono uppercase tracking-widest"
          style={{ color: "var(--ink-3)" }}
        >
          {t("lastUpdated")}
        </p>
        <p
          className="mt-6 text-[15px] leading-relaxed"
          style={{ color: "var(--ink-2)", textWrap: "pretty" }}
        >
          {doc.intro}
        </p>

        <div className="mt-12 flex flex-col gap-10">
          {doc.sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold tracking-tight">
                {section.heading}
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                {section.body.map((paragraph, j) => (
                  <p
                    key={j}
                    className="text-[14px] leading-relaxed"
                    style={{ color: "var(--ink-2)", textWrap: "pretty" }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
