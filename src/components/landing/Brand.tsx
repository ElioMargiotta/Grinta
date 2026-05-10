export function GrintaMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="gMarkBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--ink)" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
      </defs>
      <rect x={2} y={2} width={96} height={96} rx={24} fill="url(#gMarkBg)" />
      <path
        d="M 70 30 a 24 24 0 1 0 0 40 V 50 H 52"
        fill="none"
        stroke="#fafaf7"
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 16 86 L 86 16"
        stroke="var(--accent)"
        strokeWidth={6}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GrintaWordmark({ height = 22 }: { height?: number }) {
  return (
    <svg height={height} viewBox="0 0 360 64" aria-label="Grinta">
      <g
        fontFamily="var(--font-sans), Geist, ui-sans-serif, system-ui, sans-serif"
        fontWeight={700}
        fontStyle="italic"
        fontSize={56}
        letterSpacing={-2}
        fill="var(--ink)"
      >
        <text x={0} y={48}>
          GRINTA
        </text>
      </g>
      <circle cx={170} cy={14} r={5} fill="var(--accent)" />
    </svg>
  );
}
