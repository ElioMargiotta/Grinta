import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { fieldVariants } from "@/components/ui/field";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, id, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={cn(fieldVariants(), "min-h-[80px] px-3 py-2", className)}
        {...props}
      />
    </div>
  ),
);
Textarea.displayName = "Textarea";
