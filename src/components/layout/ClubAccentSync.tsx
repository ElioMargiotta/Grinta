"use client";

import { useEffect } from "react";

/**
 * Mirrors the current club's primary colour onto :root as --club-primary so it
 * is inherited even by overlays rendered outside the club-themed layout subtree
 * (notably the global LoadingProvider overlay, mounted at the locale root). The
 * club-themed wrapper still sets --club-primary locally; this just widens its
 * reach. Cleared on unmount so auth/no-club screens keep the default accent.
 */
export function ClubAccentSync({ color }: { color: string | null }) {
  useEffect(() => {
    const root = document.documentElement;
    if (!color) {
      root.style.removeProperty("--club-primary");
      return;
    }
    root.style.setProperty("--club-primary", color);
    return () => {
      root.style.removeProperty("--club-primary");
    };
  }, [color]);

  return null;
}
