"use client";

import { useRef, useSyncExternalStore } from "react";
import { useMessages, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { gsap, useGSAP, prefersReducedMotion } from "./gsap/register";
import { Reveal } from "./Reveal";
import { PERSONAS, PROFILE_THEME, profileThemeStyle, type ProfilePersona } from "./profils/theme";

type ProfileMsg = { title: string; summary: string };
type SectionMsg = {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  tabs: Record<ProfilePersona, string>;
};

/** Wide screens without reduced motion get the pinned, scroll-driven version;
 *  SSR and everyone else get the stacked fallback. */
function usePinned(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const width = window.matchMedia("(min-width: 1024px)");
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      width.addEventListener("change", onChange);
      motion.addEventListener("change", onChange);
      return () => {
        width.removeEventListener("change", onChange);
        motion.removeEventListener("change", onChange);
      };
    },
    () =>
      window.matchMedia("(min-width: 1024px)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** One view: its label, headline, a short comment, and a link to its full page.
 *  Shared by the pinned (centered) and stacked (fallback) layouts. */
function ProfileContent({
  persona,
  label,
  title,
  comment,
  cta,
  center = false,
}: {
  persona: ProfilePersona;
  label: string;
  title: string;
  comment: string;
  cta: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "text-center" : ""}>
      <div className="eyebrow-mono" style={{ color: "var(--brand-ink)" }}>
        {label}
      </div>
      <h3
        className="h-display mt-4 text-[clamp(1.9rem,5vw,3.4rem)] font-semibold tracking-tight"
        style={{ textWrap: "balance" }}
      >
        {title}
      </h3>
      <p
        className={
          "mt-5 text-[clamp(1rem,1.6vw,1.2rem)] leading-relaxed " +
          (center ? "mx-auto max-w-xl" : "max-w-xl")
        }
        style={{ color: "var(--ink-2)", textWrap: "pretty" }}
      >
        {comment}
      </p>
      <Link
        href={`/profil/${persona}`}
        className="mt-7 inline-flex items-center gap-1.5 text-[14px] font-medium underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70"
        style={{ color: "var(--brand)" }}
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export function ProfilSerpentin() {
  const t = useTranslations("landing.profils.section");
  const messages = useMessages() as {
    landing: {
      profils: Record<ProfilePersona, ProfileMsg> & { section: SectionMsg };
    };
  };
  const section = messages.landing.profils.section;
  const data = messages.landing.profils;

  const pinned = usePinned();
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!pinned || prefersReducedMotion()) return;

      // Slides centered in the same spot: 0 = "how it works" intro, then one per
      // view. Scrolling crossfades through them; the intro is just the first one.
      const M = PERSONAS.length + 1;

      // Pacing (scroll-screen units): every slide — intro included — holds for
      // the same HOLD before crossfading. Kept short so the whole section is
      // quick to scroll through.
      const HOLD = 0.6;
      const TRANS = 0.45;
      const TAIL = 0;

      gsap.set("[data-profile]", { autoAlpha: 0 });
      gsap.set(".profile-0", { autoAlpha: 1 });

      // Ambient background (the page blobs): the intro stays on the default brand
      // (red); each view then floods its own hue — so Entraîneur (violet) is a
      // clean cut from the red intro. The blobs CSS-transition their colour, so
      // we just snap the variables on :root.
      const rootStyle = document.documentElement.style;
      const applyTheme = (persona: ProfilePersona) => {
        const tpl = PROFILE_THEME[persona];
        rootStyle.setProperty("--brand", tpl.brand);
        rootStyle.setProperty("--brand-soft", tpl.brandSoft);
        rootStyle.setProperty("--brand-ink", tpl.brandInk);
      };
      const clearTheme = () => {
        rootStyle.removeProperty("--brand");
        rootStyle.removeProperty("--brand-soft");
        rootStyle.removeProperty("--brand-ink");
      };
      // Slide 0 = intro (default red); slide s≥1 = view PERSONAS[s-1].
      const applySlide = (s: number) =>
        s === 0 ? clearTheme() : applyTheme(PERSONAS[s - 1]);

      // Lay out crossfade positions and the time each slide takes the background.
      const crossAt: number[] = [];
      const bgAt: number[] = [0];
      let pos = HOLD;
      for (let i = 1; i < M; i++) {
        crossAt[i] = pos;
        bgAt[i] = pos + TRANS / 2;
        pos += TRANS + HOLD;
      }
      const total = pos + TAIL;

      let bgIndex = -1;
      const syncBg = (progress: number) => {
        const time = progress * total;
        let s = 0;
        for (let k = 1; k < M; k++) if (time >= bgAt[k]) s = k;
        if (s !== bgIndex) {
          bgIndex = s;
          applySlide(s);
        }
      };

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: stage.current,
          start: "top top",
          end: () => "+=" + window.innerHeight * total,
          pin: stage.current,
          scrub: 0.6,
          invalidateOnRefresh: true,
          onEnter: (self) => syncBg(self.progress),
          onEnterBack: (self) => syncBg(self.progress),
          onUpdate: (self) => syncBg(self.progress),
          onLeave: () => {
            bgIndex = -1;
            clearTheme();
          },
          onLeaveBack: () => {
            bgIndex = -1;
            clearTheme();
          },
        },
      });

      for (let i = 1; i < M; i++) {
        const at = crossAt[i];
        tl.to(`.profile-${i - 1}`, { autoAlpha: 0, duration: TRANS }, at)
          .to(`.profile-${i - 1} [data-card]`, { y: -28, duration: TRANS, ease: "power2.in" }, at)
          .fromTo(`.profile-${i}`, { autoAlpha: 0 }, { autoAlpha: 1, duration: TRANS }, at)
          .fromTo(`.profile-${i} [data-card]`, { y: 28 }, { y: 0, duration: TRANS, ease: "power2.out" }, at);
      }

      // Keep the timeline open through the last view's HOLD + TAIL.
      tl.to({}, { duration: total }, 0);

      return () => clearTheme();
    },
    { scope: root, dependencies: [pinned] },
  );

  // The "how it works" intro, used as the first slide (pinned) and as the
  // header of the stacked fallback.
  const intro = (
    <div className="text-center">
      <div className="eyebrow-mono">{t("eyebrow")}</div>
      <h2
        className="h-display mt-4 text-[clamp(1.9rem,5vw,3.4rem)] font-semibold tracking-tight"
        style={{ textWrap: "balance" }}
      >
        {t("title")}
      </h2>
      <p
        className="mx-auto mt-5 max-w-xl text-[clamp(1rem,1.6vw,1.2rem)] leading-relaxed"
        style={{ color: "var(--ink-2)", textWrap: "pretty" }}
      >
        {t("body")}
      </p>
    </div>
  );

  // ── Pinned: the intro and the three views crossfade in the same spot ─────
  if (pinned) {
    return (
      <section id="profils" ref={root} className="relative">
        <div ref={stage} className="relative h-screen overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center px-6 pb-[6vh] lg:px-10">
            <div className="relative h-[280px] w-full max-w-3xl">
              {/* Slide 0 — intro. */}
              <div
                data-profile
                className="profile-0 absolute inset-0 flex items-center justify-center"
                style={{ opacity: 0 }}
              >
                <div data-card className="w-full">
                  {intro}
                </div>
              </div>

              {/* Slides 1…N — the views. */}
              {PERSONAS.map((p, idx) => (
                <div
                  key={p}
                  data-profile
                  aria-hidden
                  className={`profile-${idx + 1} absolute inset-0 flex items-center justify-center`}
                  style={{ ...profileThemeStyle(p), opacity: 0 }}
                >
                  <div data-card className="w-full">
                    <ProfileContent
                      persona={p}
                      label={section.tabs[p]}
                      title={data[p].title}
                      comment={data[p].summary}
                      cta={section.cta}
                      center
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── Fallback: stacked, no pinning (mobile / reduced motion) ──────────────
  return (
    <section id="profils" className="relative py-20 lg:py-24">
      <div className="mx-auto max-w-3xl px-6 lg:px-10">
        <Reveal>{intro}</Reveal>
      </div>

      <div className="mx-auto mt-16 flex max-w-3xl flex-col gap-20 px-6 lg:px-10">
        {PERSONAS.map((p) => (
          <Reveal key={p}>
            <div style={profileThemeStyle(p)}>
              <ProfileContent
                persona={p}
                label={section.tabs[p]}
                title={data[p].title}
                comment={data[p].summary}
                cta={section.cta}
              />
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
