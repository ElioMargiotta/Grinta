import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingLabel?: string;
}

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:brightness-95",
  secondary:
    "bg-card text-foreground shadow-sm ring-1 ring-border hover:bg-accent",
  ghost:
    "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
  danger: "bg-destructive text-white shadow-sm hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      loadingLabel,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        aria-busy={loading || undefined}
        disabled={isDisabled}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? (
          <>
            <Spinner size={size === "sm" ? "xs" : "sm"} tone="current" />
            <span>{loadingLabel ?? children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
Button.displayName = "Button";
