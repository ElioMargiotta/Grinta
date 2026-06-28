import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { fieldVariants } from "@/components/ui/field";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, id, className, children, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={cn(fieldVariants(), "h-10 px-3", className)}
        {...props}
      >
        {children}
      </select>
    </div>
  ),
);
Select.displayName = "Select";
