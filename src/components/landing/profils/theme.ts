import type { CSSProperties } from "react";

/**
 * The three audience "profils" of Grinta, mirroring the real persona model in
 * `src/lib/club/persona.ts` (staff | player | parent). Each profil recolors the
 * whole landing accent by overriding the brand CSS variables on a container —
 * the entire `.btn-accent` / `.dot-accent` / `.blob-*` / `.pitch-stripes`
 * family derives from these (see `src/app/globals.css`).
 */
export const PERSONAS = ["staff", "player", "parent"] as const;
export type ProfilePersona = (typeof PERSONAS)[number];

export function isProfilePersona(value: string): value is ProfilePersona {
  return (PERSONAS as readonly string[]).includes(value);
}

type BrandTriple = { brand: string; brandSoft: string; brandInk: string };

// Same lightness/chroma envelope as the marketing brand, hue rotated per profil:
// staff ≈ violet, player ≈ blue, parent ≈ green. The marketing brand itself stays
// red (globals `--brand`), so the intro reads red and cuts to violet on Entraîneur.
export const PROFILE_THEME: Record<ProfilePersona, BrandTriple> = {
  staff: {
    brand: "oklch(0.557 0.17 300)",
    brandSoft: "oklch(0.96 0.03 300)",
    brandInk: "oklch(0.42 0.12 300)",
  },
  player: {
    brand: "oklch(0.557 0.17 255)",
    brandSoft: "oklch(0.96 0.03 255)",
    brandInk: "oklch(0.42 0.12 262)",
  },
  parent: {
    brand: "oklch(0.60 0.15 150)",
    brandSoft: "oklch(0.96 0.04 150)",
    brandInk: "oklch(0.40 0.10 150)",
  },
};

type BrandStyle = CSSProperties & Record<`--${string}`, string>;

/** Inline style overriding the brand trio for a persona's themed subtree. */
export function profileThemeStyle(persona: ProfilePersona): BrandStyle {
  const t = PROFILE_THEME[persona];
  return {
    "--brand": t.brand,
    "--brand-soft": t.brandSoft,
    "--brand-ink": t.brandInk,
  };
}
