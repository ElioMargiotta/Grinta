import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

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
        className={cn(
          "h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  ),
);
Select.displayName = "Select";
