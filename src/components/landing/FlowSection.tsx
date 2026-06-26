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

const MIRROR_ANCHORS = [
  { side: "right", x: 650, y: 110 },
  { side: "left", x: 350, y: 330 },
  { side: "right", x: 650, y: 550 },
  { side: "left", x: 350, y: 770 },
] as const;

const MIRROR_SNAKE_D =
  "M 650 110 C 650 220 350 220 350 330 C 350 440 650 440 650 550 C 650 660 350 660 350 770 L 350 830";
const MIRROR_SNAKE_END = { x: 350, y: 830 };

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
            style={{ color: "var(--brand-ink)" }}
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

function Snake({
  anchors,
  path,
  end,
  viewBox = "0 0 1000 1100",
}: {
  anchors: readonly { x: number; y: number }[];
  path: string;
  end: { x: number; y: number };
  viewBox?: string;
}) {
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
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      style={{ ["--len" as string]: String(pathLen) }}
    >
      {anchors.map((a, i) => (
        <circle
          key={i}
          cx={a.x}
          cy={a.y}
          r={5}
          fill="var(--brand)"
          className="snake-dot"
          style={{ ["--dot-i" as string]: String(i) }}
        />
      ))}
      <path
        className="snake-line"
        d={path}
        stroke="color-mix(in oklch, var(--ink-3) 55%, transparent)"
        strokeWidth={1.25}
        strokeLinecap="round"
      />
      <g
        className="snake-head"
        transform={`translate(${end.x} ${end.y})`}
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

function DesktopFlowTrack({
  anchors,
  steps,
  path,
  end,
  viewBox,
  yBase,
  aspect,
}: {
  anchors: readonly { side: "left" | "right"; x: number; y: number }[];
  steps: Step[];
  path: string;
  end: { x: number; y: number };
  viewBox: string;
  yBase: number;
  aspect: string;
}) {
  return (
    <div className={`relative w-full ${aspect}`}>
      <Snake anchors={anchors} path={path} end={end} viewBox={viewBox} />
      {anchors.map((a, i) => {
        const xPct = (a.x / 1000) * 100;
        const yPct = (a.y / yBase) * 100;
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
  );
}

function MobileFlowList({ steps }: { steps: Step[] }) {
  return (
    <div className="relative mx-auto max-w-md pl-8">
      <div
        aria-hidden
        className="absolute left-2 top-3 bottom-3 w-px"
        style={{
          background: "color-mix(in oklch, var(--ink-3) 35%, transparent)",
        }}
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
            className="h-display mt-4 text-[clamp(1.6rem,5.5vw,3rem)] font-semibold tracking-tight"
            style={{ textWrap: "balance" }}
          >
            {t("titlePrefix")}{" "}
            <span className="text-accent-ink italic">{t("titleAccent")}</span>
            {t("titleSuffix")}
          </h2>
        </div>

        <div className="hidden md:block relative mx-auto mt-24 w-full max-w-3xl aspect-[1000/1100]">
          <DesktopFlowTrack
            anchors={ANCHORS}
            steps={steps}
            path={SNAKE_D}
            end={SNAKE_END}
            viewBox="0 0 1000 1100"
            yBase={1100}
            aspect="aspect-[1000/1100]"
          />
        </div>

        <div className="md:hidden mt-16">
          <MobileFlowList steps={steps} />
        </div>
      </div>
    </section>
  );
}

export function PlayerFlowSection() {
  const t = useTranslations("landing.playerFlow");
  const messages = useMessages() as {
    landing: { playerFlow: { steps: Step[] } };
  };
  const steps = messages.landing.playerFlow.steps;

  return (
    <section className="relative py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow-mono">{t("eyebrow")}</div>
          <h2
            className="h-display mt-4 text-[clamp(1.6rem,5.5vw,3rem)] font-semibold tracking-tight"
            style={{ textWrap: "balance" }}
          >
            {t("titlePrefix")}{" "}
            <span className="text-accent-ink italic">{t("titleAccent")}</span>
            {t("titleSuffix")}
          </h2>
        </div>

        <div className="hidden md:block relative mx-auto mt-20 w-full max-w-3xl aspect-[1000/850]">
          <DesktopFlowTrack
            anchors={MIRROR_ANCHORS}
            steps={steps}
            path={MIRROR_SNAKE_D}
            end={MIRROR_SNAKE_END}
            viewBox="0 0 1000 850"
            yBase={850}
            aspect="aspect-[1000/850]"
          />
        </div>

        <div className="md:hidden mt-16">
          <MobileFlowList steps={steps} />
        </div>
      </div>
    </section>
  );
}
