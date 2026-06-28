import type { SVGProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const spinnerVariants = cva("animate-spin", {
  variants: {
    size: {
      xs: "h-3 w-3",
      sm: "h-4 w-4",
      md: "h-6 w-6",
      lg: "h-10 w-10",
    },
    tone: {
      accent: "text-[var(--accent,oklch(53.576%_0.19004_33.59))]",
      ink: "text-[var(--ink,#18181b)]",
      current: "text-current",
      inverse: "text-white",
    },
  },
  defaultVariants: { size: "sm", tone: "current" },
});

export interface SpinnerProps
  extends Omit<SVGProps<SVGSVGElement>, "size">,
    VariantProps<typeof spinnerVariants> {
  label?: string;
}

export function Spinner({
  size,
  tone,
  label,
  className,
  ...props
}: SpinnerProps) {
  return (
    <svg
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      viewBox="0 0 24 24"
      fill="none"
      className={cn(spinnerVariants({ size, tone }), className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
