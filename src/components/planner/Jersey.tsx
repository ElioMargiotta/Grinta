"use client";

/**
 * Maillot stylisé (SVG) pour représenter un joueur sur le terrain — plus parlant
 * qu'une simple pastille ronde. Le numéro est centré sur le maillot.
 */
export function Jersey({
  number,
  tone = "default",
  className,
}: {
  number: number | string;
  /** `danger` (rouge) pour un joueur indisponible (blessé / suspendu / malade). */
  tone?: "default" | "danger";
  className?: string;
}) {
  const fill = tone === "danger" ? "#dc2626" : "var(--club-primary)";
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-hidden="true"
    >
      <path
        d="M13 4 L6 8 L3 15 L8 18 L11 16 L11 36 L29 36 L29 16 L32 18 L37 15 L34 8 L27 4 C27 9 13 9 13 4 Z"
        fill={fill}
        stroke="white"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <text
        x="20"
        y="29"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill="white"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {number}
      </text>
    </svg>
  );
}
