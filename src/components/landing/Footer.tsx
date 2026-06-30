import { getMessages, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GrintaLogoIcon, GrintaLogoType } from "./BrandSeal";

type FooterLink = { label: string; href: string };
type FooterCol = { title: string; links: FooterLink[] };

export async function FooterBar() {
  const t = await getTranslations("landing.footer");
  const messages = (await getMessages()) as {
    landing: { footer: { cols: FooterCol[] } };
  };
  const cols = messages.landing.footer.cols;
  return (
    <footer className="pb-10 pt-16" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2">
              <GrintaLogoIcon size={32} title="Grinta" />
              <GrintaLogoType height={18} title="GRINTA" />
            </div>
            <p
              className="mt-4 max-w-xs text-[13px] leading-relaxed"
              style={{ color: "var(--ink-3)", textWrap: "pretty" }}
            >
              {t("tagline")}
            </p>
            <div
              className="mt-6 font-mono text-[11px]"
              style={{ color: "var(--ink-3)" }}
            >
              {t("copyright")}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
            {cols.map((c) => (
              <div key={c.title}>
                <div
                  className="font-mono text-[11px] uppercase tracking-widest"
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
                          className="text-[13px] transition-colors hover:text-[var(--ink)]"
                          style={{ color: "var(--ink-2)" }}
                        >
                          {l.label}
                        </a>
                      ) : (
                        <Link
                          href={l.href}
                          className="text-[13px] transition-colors hover:text-[var(--ink)]"
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
