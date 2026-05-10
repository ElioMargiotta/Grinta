"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { GrintaMark, GrintaWordmark } from "./Brand";

export function NavBar({
  loginLabel,
  ctaLabel,
}: {
  loginLabel: string;
  ctaLabel: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Méthode", href: "#methode" },
    { label: "Comment ça marche", href: "#flow" },
    { label: "Tarifs", href: "#tarifs" },
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
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <GrintaMark size={32} />
          <GrintaWordmark height={20} />
        </Link>
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:inline-flex text-[13px] font-medium px-3 py-2 text-[var(--ink-2)] hover:text-[var(--ink)]"
          >
            {loginLabel}
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-lg btn-ink"
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
