"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Panneau coulissant (drawer / sheet), base commune des panneaux latéraux.
 * Même primitive que Dialog mais ancré à un bord. Voir docs/ui-conventions.md.
 */
const sheetVariants = cva(
  "fixed z-50 flex flex-col gap-4 border-border bg-card p-6 text-card-foreground shadow-lg transition-transform",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full w-3/4 max-w-md border-l data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
        left: "inset-y-0 left-0 h-full w-3/4 max-w-md border-r data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full",
        bottom:
          "inset-x-0 bottom-0 max-h-[90vh] w-full rounded-t-xl border-t data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full",
      },
    },
    defaultVariants: { side: "right" },
  },
);

export const Sheet = BaseDialog.Root;
export const SheetTrigger = BaseDialog.Trigger;
export const SheetClose = BaseDialog.Close;

export function SheetContent({
  className,
  children,
  side,
  showClose = true,
  ...props
}: ComponentProps<typeof BaseDialog.Popup> &
  VariantProps<typeof sheetVariants> & { showClose?: boolean }) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <BaseDialog.Popup
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        {showClose && (
          <BaseDialog.Close
            aria-label="Fermer"
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export function SheetHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

export function SheetTitle({
  className,
  ...props
}: ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      className={cn("text-base font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
