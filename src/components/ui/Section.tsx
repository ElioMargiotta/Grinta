import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function Section({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`rounded-lg border border-[var(--club-line)] bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
      {...props}
    />
  );
}

export function SectionHeader({
  icon: Icon,
  iconClassName = "text-[var(--club-primary)]",
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
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {Icon ? <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} /> : null}
          <span className="truncate">{title}</span>
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
