"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { GrintaLogoIcon, GrintaLogoType } from "./BrandSeal";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function NavBar() {
  const t = useTranslations("landing.nav");
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const solid = scrolled || open;

  const links = [
    { label: t("method"), hash: "methode" },
    { label: t("how"), hash: "flow" },
    { label: t("pricing"), hash: "tarifs" },
  ];

  const linkHref = (hash: string) =>
    onHome ? `#${hash}` : { pathname: "/" as const, hash };

  return (
    <header
      className={
        "sticky top-0 z-40 border-b transition-colors duration-300 " +
        (solid ? "backdrop-blur-md" : "")
      }
      style={{
        background: solid
          ? "color-mix(in oklch, var(--paper) 82%, transparent)"
          : "transparent",
        borderColor: solid ? "var(--line)" : "transparent",
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6 lg:px-10">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <GrintaLogoIcon
            size={32}
            title="Grinta"
            className="h-7 w-7 lg:h-8 lg:w-8"
          />
          <GrintaLogoType
            height={18}
            title="GRINTA"
            className="hidden h-4 w-auto sm:block lg:h-[18px]"
          />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) =>
            onHome ? (
              <a
                key={l.hash}
                href={`#${l.hash}`}
                className="text-[13px] font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink)]"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.hash}
                href={{ pathname: "/", hash: l.hash }}
                className="text-[13px] font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink)]"
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <LocaleSwitcher />
            <Link
              href="/login"
              className="px-3 py-2 text-[13px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)]"
            >
              {t("login")}
            </Link>
          </div>

          <Link
            href="/signup"
            className="hidden items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium btn-ink md:inline-flex"
          >
            {t("cta")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--ink-2)] transition-colors hover:bg-[color-mix(in_oklch,var(--ink)_8%,transparent)] hover:text-[var(--ink)] md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t md:hidden" style={{ borderColor: "var(--line)" }}>
          <div className="mx-auto flex max-w-7xl flex-col px-6 py-3">
            <nav className="flex flex-col">
              {links.map((l) =>
                onHome ? (
                  <a
                    key={l.hash}
                    href={`#${l.hash}`}
                    onClick={() => setOpen(false)}
                    className="py-2.5 text-[15px] font-medium text-[var(--ink)]"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    key={l.hash}
                    href={linkHref(l.hash)}
                    onClick={() => setOpen(false)}
                    className="py-2.5 text-[15px] font-medium text-[var(--ink)]"
                  >
                    {l.label}
                  </Link>
                ),
              )}
            </nav>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="py-2.5 text-[15px] font-medium text-[var(--ink)]"
            >
              {t("login")}
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-3 text-[14px] font-medium btn-ink"
            >
              {t("cta")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <div
              className="mt-3 flex items-center justify-between border-t pt-3"
              style={{ borderColor: "var(--line)" }}
            >
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
