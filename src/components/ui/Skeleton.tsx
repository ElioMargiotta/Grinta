import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Placeholder de chargement homogène. Composer avec des classes de
 * dimension/forme (`h-*`, `w-*`, `rounded-*`) selon le contenu attendu.
 */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
