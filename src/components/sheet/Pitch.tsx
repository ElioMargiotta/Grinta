type PitchProps = { className?: string };

const STROKE = "currentColor";
const STROKE_WIDTH = 0.4;

function GoalAndPenaltyTop() {
  return (
    <g fill="none" stroke={STROKE} strokeWidth={STROKE_WIDTH}>
      {/* Goal */}
      <rect x={31.34} y={-1.5} width={5.32} height={1.5} />
      {/* Goal area (5.5m × 18.32m) */}
      <rect x={24.84} y={0} width={18.32} height={5.5} />
      {/* Penalty area (16.5m × 40.32m) */}
      <rect x={13.84} y={0} width={40.32} height={16.5} />
      {/* Penalty arc */}
      <path d="M 27.4 16.5 A 9.15 9.15 0 0 0 40.6 16.5" />
      {/* Penalty spot */}
      <circle cx={34} cy={11} r={0.3} fill={STROKE} stroke="none" />
    </g>
  );
}

function GoalAndPenaltyBottom() {
  return (
    <g fill="none" stroke={STROKE} strokeWidth={STROKE_WIDTH}>
      <rect x={31.34} y={105} width={5.32} height={1.5} />
      <rect x={24.84} y={99.5} width={18.32} height={5.5} />
      <rect x={13.84} y={88.5} width={40.32} height={16.5} />
      <path d="M 27.4 88.5 A 9.15 9.15 0 0 1 40.6 88.5" />
      <circle cx={34} cy={94} r={0.3} fill={STROKE} stroke="none" />
    </g>
  );
}

export function HalfPitch({ className = "" }: PitchProps) {
  return (
    <svg
      viewBox="-2 -2 72 56.5"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-zinc-700 ${className}`}
      role="img"
      aria-label="Half pitch"
    >
      {/* Boundary */}
      <rect
        x={0}
        y={0}
        width={68}
        height={52.5}
        fill="none"
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
      />
      <GoalAndPenaltyTop />
      {/* Halfway: bottom edge with center mark and half-circle */}
      <g fill="none" stroke={STROKE} strokeWidth={STROKE_WIDTH}>
        <path d="M 34 52.5 m -9.15 0 a 9.15 9.15 0 0 1 18.3 0" />
        <circle cx={34} cy={52.5} r={0.3} fill={STROKE} stroke="none" />
      </g>
    </svg>
  );
}

export function FullPitch({ className = "" }: PitchProps) {
  return (
    <svg
      viewBox="-2 -2 72 109"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-zinc-700 ${className}`}
      role="img"
      aria-label="Full pitch"
    >
      <rect
        x={0}
        y={0}
        width={68}
        height={105}
        fill="none"
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
      />
      {/* Halfway line */}
      <line x1={0} y1={52.5} x2={68} y2={52.5} stroke={STROKE} strokeWidth={STROKE_WIDTH} />
      {/* Center circle */}
      <circle
        cx={34}
        cy={52.5}
        r={9.15}
        fill="none"
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
      />
      <circle cx={34} cy={52.5} r={0.3} fill={STROKE} />
      <GoalAndPenaltyTop />
      <GoalAndPenaltyBottom />
    </svg>
  );
}
