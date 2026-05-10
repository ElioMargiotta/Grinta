"use client";

import { useEffect, useRef, useState } from "react";

type Step = {
  kicker: string;
  title: string;
  body: string;
  badge?: string;
};

const STEPS: Step[] = [
  {
    kicker: "01",
    title: "L'identité du club",
    body: "Principes de jeu, formation, attendus. Une seule philosophie partagée par tout le staff.",
    badge: "Identité",
  },
  {
    kicker: "02",
    title: "La saison, en 90 secondes",
    body: "Trois dates suffisent. Grinta ancre le macrocycle et numérote les semaines (-3, -2, -1, +1…) automatiquement.",
    badge: "Saison",
  },
  {
    kicker: "03",
    title: "Les microcycles",
    body: "Thème de la semaine, format, charge. Chaque mésocycle prend la couleur que tu veux.",
    badge: "Microcycle",
  },
  {
    kicker: "04",
    title: "Les séances",
    body: "Importe un exercice depuis ta bibliothèque ou crée-le directement sur schéma. Les blocs s'empilent.",
    badge: "Séance",
  },
  {
    kicker: "05",
    title: "La fiche, prête pour le terrain",
    body: "Un PDF A4 propre, lisible pour le staff, exploitable sur le terrain. Voilà.",
    badge: "PDF",
  },
];

/* Anchors on a 1000×1100 viewBox. The path is a regular sine-style
 * serpentine: every segment uses the same vertical tangent length so the
 * curvature is even from top to bottom. */
const ANCHORS = [
  { side: "left", x: 350, y: 110 },
  { side: "right", x: 650, y: 330 },
  { side: "left", x: 350, y: 550 },
  { side: "right", x: 650, y: 770 },
  { side: "left", x: 350, y: 990 },
] as const;

const SNAKE_D =
  "M 350 110 C 350 220 650 220 650 330 C 650 440 350 440 350 550 C 350 660 650 660 650 770 C 650 880 350 880 350 990 L 350 1050";
const SNAKE_END = { x: 350, y: 1050 };

function FlowText({ step, side }: { step: Step; side: "left" | "right" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={"max-w-[260px] " + (side === "left" ? "text-right ml-auto" : "text-left")}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 700ms cubic-bezier(.2,.7,.2,1), transform 700ms cubic-bezier(.2,.7,.2,1)",
      }}
    >
      <div
        className={
          "flex items-baseline gap-2 " + (side === "left" ? "justify-end" : "justify-start")
        }
      >
        <span
          className="font-mono text-[11px] tracking-widest"
          style={{ color: "var(--ink-3)" }}
        >
          {step.kicker}
        </span>
        {step.badge && (
          <span
            className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "var(--accent-ink)" }}
          >
            {step.badge}
          </span>
        )}
      </div>
      <h3
        className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight"
        style={{ letterSpacing: "-0.02em" }}
      >
        {step.title}
      </h3>
      <p
        className="mt-2 text-[13.5px] leading-relaxed"
        style={{ color: "var(--ink-2)", textWrap: "pretty" }}
      >
        {step.body}
      </p>
    </div>
  );
}

function Snake() {
  const ref = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [pathLen, setPathLen] = useState(2400);

  useEffect(() => {
    const path = ref.current?.querySelector("path.snake-line") as
      | SVGPathElement
      | null;
    if (path) {
      setPathLen(Math.ceil(path.getTotalLength()));
    }
  }, []);

  useEffect(() => {
    if (
      typeof CSS !== "undefined" &&
      CSS.supports("animation-timeline: view()")
    ) {
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setDrawn(true);
            io.disconnect();
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      aria-hidden
      className={"flow-snake absolute inset-0 h-full w-full" + (drawn ? " is-drawn" : "")}
      viewBox="0 0 1000 1100"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      style={{ ["--len" as string]: String(pathLen) }}
    >
      {/* Dots at each anchor */}
      {ANCHORS.map((a, i) => (
        <circle
          key={i}
          cx={a.x}
          cy={a.y}
          r={5}
          fill="var(--accent)"
          className="snake-dot"
          style={{ ["--dot-i" as string]: String(i) }}
        />
      ))}
      {/* The serpentine line */}
      <path
        className="snake-line"
        d={SNAKE_D}
        stroke="color-mix(in oklch, var(--ink-3) 55%, transparent)"
        strokeWidth={1.25}
        strokeLinecap="round"
      />
      {/* Single arrowhead at the very end, pointing down */}
      <g
        className="snake-head"
        transform={`translate(${SNAKE_END.x} ${SNAKE_END.y})`}
      >
        <path
          d="M -7 -10 L 0 0 L 7 -10"
          stroke="color-mix(in oklch, var(--ink-3) 75%, transparent)"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

export function FlowSection() {
  return (
    <section id="flow" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow-mono">Comment ça marche</div>
          <h2
            className="h-display mt-4 text-4xl sm:text-5xl font-semibold tracking-tight"
            style={{ textWrap: "balance" }}
          >
            De l&apos;identité du club à la fiche du{" "}
            <span className="text-accent-ink italic">mardi soir</span>.
          </h2>
        </div>

        {/* Desktop / tablet: smooth serpentine with floating text */}
        <div className="hidden md:block relative mx-auto mt-24 w-full max-w-3xl aspect-[1000/1100]">
          <Snake />
          {ANCHORS.map((a, i) => {
            const xPct = (a.x / 1000) * 100;
            const yPct = (a.y / 1100) * 100;
            const side = a.side;
            return (
              <div
                key={STEPS[i].kicker}
                className="absolute"
                style={{
                  top: `${yPct}%`,
                  left: side === "left" ? "0%" : `${xPct + 3}%`,
                  right: side === "left" ? `${100 - xPct + 3}%` : "0%",
                  transform: "translateY(-50%)",
                }}
              >
                <FlowText step={STEPS[i]} side={side} />
              </div>
            );
          })}
        </div>

        {/* Mobile: vertical thin line with anchor dots, no boxes */}
        <div className="md:hidden relative mx-auto mt-16 max-w-md pl-8">
          <div
            aria-hidden
            className="absolute left-2 top-3 bottom-3 w-px"
            style={{ background: "color-mix(in oklch, var(--ink-3) 35%, transparent)" }}
          />
          <ol className="flex flex-col gap-12">
            {STEPS.map((step) => (
              <li key={step.kicker} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[26px] top-1.5 w-2.5 h-2.5 rounded-full dot-accent"
                />
                <FlowText step={step} side="right" />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
