import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Pastille pleinement arrondie (`rounded-full`) pour filtres, tags et
 * sélecteurs segmentés. Rendue en `<button>` : supporte l'état `active`.
 * Pour un simple libellé de statut non interactif, préférer Badge.
 */
export const pillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      active: {
        true: "border-primary bg-primary text-primary-foreground",
        false: "border-border bg-card text-muted-foreground hover:bg-accent",
      },
    },
    defaultVariants: { active: false },
  },
);

export interface PillProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof pillVariants> {}

export function Pill({ className, active, type, ...props }: PillProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(pillVariants({ active }), className)}
      {...props}
    />
  );
}
