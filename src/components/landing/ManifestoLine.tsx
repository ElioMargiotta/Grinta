"use client";

import { useEffect, useRef, useState } from "react";

const DOT_X = [154, 500, 846];

export function ManifestoLine() {
  const ref = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [pathLen, setPathLen] = useState(940);

  useEffect(() => {
    const path = ref.current?.querySelector("path.mani-line") as
      | SVGPathElement
      | null;
    if (path) setPathLen(Math.ceil(path.getTotalLength()));
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
      { rootMargin: "0px 0px -10% 0px", threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      aria-hidden
      className={"mani-line-svg block w-full h-auto" + (drawn ? " is-drawn" : "")}
      viewBox="0 0 1000 60"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      style={{ ["--len" as string]: String(pathLen) }}
    >
      {DOT_X.map((x, i) => (
        <circle
          key={i}
          cx={x}
          cy={30}
          r={5}
          fill="var(--accent)"
          className="mani-dot"
          style={{ ["--dot-i" as string]: String(i) }}
        />
      ))}
      <path
        className="mani-line"
        d="M 30 30 L 970 30"
        stroke="color-mix(in oklch, var(--ink-3) 55%, transparent)"
        strokeWidth={1.25}
        strokeLinecap="round"
      />
      <g className="mani-head" transform="translate(970 30)">
        <path
          d="M -10 -7 L 0 0 L -10 7"
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
