import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Section({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card p-6 text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeader({
  icon: Icon,
  iconClassName = "text-primary",
  title,
  description,
  action,
  className = "",
}: {
  icon?: LucideIcon;
  iconClassName?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          {Icon ? <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} /> : null}
          <span className="truncate">{title}</span>
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
