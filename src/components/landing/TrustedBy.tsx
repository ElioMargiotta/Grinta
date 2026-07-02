"use client";

import Image from "next/image";
import { useMessages, useTranslations } from "next-intl";
import { Reveal } from "./Reveal";

type Club = {
  name: string;
  logo: string;
  logoDark?: string;
  w: number;
  h: number;
  scale?: number; // optional visual balance for shape-heavy marks (e.g. crests)
};

const DISPLAY_H = 64; // px — fixed logo height, width follows the aspect ratio

function ClubLogo({ club }: { club: Club }) {
  const displayH = Math.round(DISPLAY_H * (club.scale ?? 1));
  const width = Math.round(displayH * (club.w / club.h));
  const common = {
    width: club.w,
    height: club.h,
    style: { height: displayH, width },
  };
  if (!club.logoDark) {
    return (
      <Image
        src={club.logo}
        alt={club.name}
        {...common}
        className="object-contain"
      />
    );
  }
  return (
    <>
      <Image
        src={club.logo}
        alt={club.name}
        {...common}
        className="block object-contain dark:hidden"
      />
      <Image
        src={club.logoDark}
        alt={club.name}
        {...common}
        className="hidden object-contain dark:block"
      />
    </>
  );
}

export function TrustedBy() {
  const t = useTranslations("landing.trustedBy");
  const messages = useMessages() as {
    landing: { trustedBy: { clubs: Club[] } };
  };
  const clubs = messages.landing.trustedBy.clubs;

  // Repeat enough times so the marquee stays full even with few clubs,
  // then duplicate the whole strip for a seamless -50% loop.
  const base = Array.from({ length: 4 }, () => clubs).flat();
  const strip = [...base, ...base];

  return (
    <section id="confiance" className="relative overflow-hidden py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6 text-center lg:px-10">
        <Reveal>
          <div className="eyebrow-mono">{t("eyebrow")}</div>
          <h2 className="h-display mx-auto mt-4 max-w-2xl text-[clamp(1.4rem,4.5vw,2.4rem)] font-semibold">
            {t("title")}
          </h2>
        </Reveal>
      </div>

      <Reveal delay={80}>
        <div
          className="group relative mt-12 flex overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
          }}
        >
          <ul className="marquee-track flex shrink-0 items-center">
            {strip.map((club, i) => (
              <li
                key={`${club.name}-${i}`}
                className="logo-item mr-20 flex shrink-0 items-center"
              >
                <ClubLogo club={club} />
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <style>{`
        @keyframes trustedby-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .marquee-track {
          animation: trustedby-marquee 28s linear infinite;
        }
        .group:hover .marquee-track {
          animation-play-state: paused;
        }
        .logo-item {
          opacity: 0.75;
          transition: opacity 0.3s ease;
        }
        .logo-item:hover {
          opacity: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none; }
        }
      `}</style>
    </section>
  );
}
