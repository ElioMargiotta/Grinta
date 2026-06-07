"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { GrintaLogoIcon, GrintaLogoType } from "./BrandSeal";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";

export function NavBar() {
  const t = useTranslations("landing.nav");
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: t("method"), hash: "methode" },
    { label: t("how"), hash: "flow" },
    { label: t("pricing"), hash: "tarifs" },
  ];

  return (
    <header
      className={"sticky top-0 z-40 transition-all duration-500 " + (scrolled ? "backdrop-blur-md" : "")}
      style={{
        background: scrolled
          ? "color-mix(in oklch, var(--bg) 80%, transparent)"
          : "transparent",
        boxShadow: scrolled ? "0 1px 0 var(--line)" : "none",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <GrintaLogoIcon size={32} title="Grinta" />
          <GrintaLogoType height={18} title="GRINTA" />
        </Link>
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) =>
            onHome ? (
              <a
                key={l.hash}
                href={`#${l.hash}`}
                className="text-[13px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.hash}
                href={{ pathname: "/", hash: l.hash }}
                className="text-[13px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <Link
            href="/login"
            className="hidden sm:inline-flex text-[13px] font-medium px-3 py-2 text-[var(--ink-2)] hover:text-[var(--ink)]"
          >
            {t("login")}
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-lg btn-ink"
          >
            {t("cta")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
