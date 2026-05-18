"use client";

import { useEffect, useRef, useState } from "react";
import { useMessages, useTranslations } from "next-intl";

type Step = {
  kicker: string;
  title: string;
  body: string;
  badge?: string;
};

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
      <path
        className="snake-line"
        d={SNAKE_D}
        stroke="color-mix(in oklch, var(--ink-3) 55%, transparent)"
        strokeWidth={1.25}
        strokeLinecap="round"
      />
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
  const t = useTranslations("landing.flow");
  const messages = useMessages() as { landing: { flow: { steps: Step[] } } };
  const steps = messages.landing.flow.steps;

  return (
    <section id="flow" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow-mono">{t("eyebrow")}</div>
          <h2
            className="h-display mt-4 text-4xl sm:text-5xl font-semibold tracking-tight"
            style={{ textWrap: "balance" }}
          >
            {t("titlePrefix")}{" "}
            <span className="text-accent-ink italic">{t("titleAccent")}</span>
            {t("titleSuffix")}
          </h2>
        </div>

        <div className="hidden md:block relative mx-auto mt-24 w-full max-w-3xl aspect-[1000/1100]">
          <Snake />
          {ANCHORS.map((a, i) => {
            const xPct = (a.x / 1000) * 100;
            const yPct = (a.y / 1100) * 100;
            const side = a.side;
            return (
              <div
                key={steps[i].kicker}
                className="absolute"
                style={{
                  top: `${yPct}%`,
                  left: side === "left" ? "0%" : `${xPct + 3}%`,
                  right: side === "left" ? `${100 - xPct + 3}%` : "0%",
                  transform: "translateY(-50%)",
                }}
              >
                <FlowText step={steps[i]} side={side} />
              </div>
            );
          })}
        </div>

        <div className="md:hidden relative mx-auto mt-16 max-w-md pl-8">
          <div
            aria-hidden
            className="absolute left-2 top-3 bottom-3 w-px"
            style={{ background: "color-mix(in oklch, var(--ink-3) 35%, transparent)" }}
          />
          <ol className="flex flex-col gap-12">
            {steps.map((step) => (
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
