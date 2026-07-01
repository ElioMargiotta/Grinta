import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Affiche les logos d'un club-regroupement en série (côte à côte). Se substitue à
 * l'ancien `<img>` de logo unique partout où la marque du club apparaît.
 * - 0 logo → rend `fallback` (icône/initiales propres à l'appelant).
 * - 1 logo → comportement identique à l'ancien logo unique.
 * - N logos → rangée horizontale, cappée à `max`.
 */
export function ClubLogos({
  logos,
  alt = "",
  imgClassName,
  className,
  fallback = null,
  max = 4,
}: {
  logos: string[];
  alt?: string;
  imgClassName?: string;
  className?: string;
  fallback?: ReactNode;
  max?: number;
}) {
  if (!logos || logos.length === 0) return <>{fallback}</>;

  const shown = logos.slice(0, max);

  return (
    <span className={cn("flex shrink-0 items-center gap-1", className)}>
      {shown.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${url}-${i}`}
          src={url}
          alt={i === 0 ? alt : ""}
          className={cn("object-contain", imgClassName)}
        />
      ))}
    </span>
  );
}
