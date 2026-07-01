"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { gsap, useGSAP, SplitText } from "./gsap/register";

export function Hero() {
  const t = useTranslations("landing.hero");
  const root = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const fadeUp = "[data-hero-fade]";

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set([title.current, fadeUp], { opacity: 1, y: 0 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = new SplitText(title.current, {
          type: "lines",
          mask: "lines",
          linesClass: "split-line",
        });

        const tl = gsap.timeline({
          defaults: { ease: "power4.out" },
          delay: 0.1,
        });
        tl.set(title.current, { opacity: 1 })
          .from(split.lines, { yPercent: 115, duration: 1.05, stagger: 0.1 })
          .from(
            fadeUp,
            { y: 22, opacity: 0, duration: 0.8, stagger: 0.12 },
            "-=0.7",
          );

        return () => split.revert();
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative overflow-hidden">
      <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-20 text-center lg:px-10 lg:pb-28 lg:pt-32">
        <div
          data-hero-fade
          className="eyebrow-mono inline-flex items-center gap-2"
          style={{ opacity: 0 }}
        >
          <span className="dot-accent h-1.5 w-1.5 rounded-full" />
          {t("eyebrow")}
        </div>

        <h1
          ref={title}
          className="h-display mx-auto mt-6 max-w-4xl text-[clamp(2.4rem,9vw,5.5rem)] font-semibold"
          style={{ opacity: 0 }}
        >
          {t("title1")}
          <br />
          {t("title2Prefix")}{" "}
          <span className="text-accent-ink italic">{t("title2Accent")}</span>
          {t("title2Suffix")}
          <br />
          {t("title3")}
        </h1>

        <p
          data-hero-fade
          className="mx-auto mt-7 max-w-xl text-[16px] leading-relaxed"
          style={{ color: "var(--ink-2)", textWrap: "pretty", opacity: 0 }}
        >
          {t("subtitle")}
        </p>

        <div
          data-hero-fade
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
          style={{ opacity: 0 }}
        >
          <Link
            href="/signup"
            className="btn-accent inline-flex items-center gap-2 rounded-lg px-5 py-3 text-[14px] font-medium"
          >
            {t("ctaHow")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#profils"
            className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-[14px] font-medium"
            style={{ borderColor: "var(--line-2)" }}
          >
            {t("ctaPricing")}
          </a>
        </div>

        <dl
          data-hero-fade
          className="mx-auto mt-14 grid max-w-lg grid-cols-3 gap-4 sm:gap-6 [&>div]:min-w-0"
          style={{ opacity: 0 }}
        >
          {(["stat1", "stat2", "stat3"] as const).map((s) => (
            <div key={s}>
              <dt
                className="font-mono text-[11px] uppercase tracking-widest"
                style={{ color: "var(--ink-3)" }}
              >
                {t(`${s}Label`)}
              </dt>
              <dd
                className="mt-1 text-[13px] font-semibold leading-snug tracking-tight sm:text-[15px]"
                style={{ textWrap: "balance" }}
              >
                {t(`${s}Value`)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
