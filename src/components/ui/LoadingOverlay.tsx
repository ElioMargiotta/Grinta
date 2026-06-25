import type { CSSProperties } from "react";
import { Spinner } from "@/components/ui/Spinner";

// Inside a club-themed subtree, the loading visual (spinner, grid, accent dot)
// adopts the club's primary colour; outside one (auth/root), --club-primary is
// unset and it falls back to the default Grinta accent.
const accentStyle = {
  "--accent": "var(--club-primary, oklch(53.576% 0.19004 33.59))",
} as CSSProperties & Record<`--${string}`, string>;

export interface LoadingOverlayProps {
  label?: string;
  message?: string;
  fullscreen?: boolean;
  variant?: "blocking" | "subtle";
}

export function LoadingOverlay({
  label = "Loading",
  message,
  fullscreen = true,
  variant = "blocking",
}: LoadingOverlayProps) {
  const positioning = fullscreen
    ? "fixed inset-0 z-[100]"
    : "absolute inset-0 z-10";

  const backdrop =
    variant === "blocking"
      ? "bg-[color-mix(in_oklch,var(--bg,#fafaf7)_82%,transparent)] backdrop-blur-[2px]"
      : "bg-[color-mix(in_oklch,var(--bg,#fafaf7)_55%,transparent)]";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={accentStyle}
      className={`${positioning} flex items-center justify-center ${backdrop}`}
    >
      <div className="grinta-grid absolute inset-0 opacity-60 pointer-events-none" />
      <div className="relative flex flex-col items-center gap-5 rounded-2xl border border-[var(--line,#e7e5e0)] bg-[var(--paper,#fff)] px-8 py-7 shadow-[0_1px_0_rgba(24,24,27,0.04),0_24px_48px_-20px_rgba(24,24,27,0.18)]">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-[var(--line-2,#d4d4d0)]" />
          <span className="dot-accent absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full" />
          <Spinner size="lg" tone="accent" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="eyebrow-mono">{label}</span>
          {message ? (
            <p className="max-w-xs text-center text-sm text-[var(--ink-2,#3f3f46)]">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
