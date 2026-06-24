import type { CSSProperties } from "react";
import type { ClubIdentity } from "./types";

type ClubThemeStyle = CSSProperties & Record<`--${string}`, string>;

const FALLBACK: ClubIdentity = {
  logo_url: null,
  theme_mode: "day",
  theme_primary_color: "#18181b",
  theme_secondary_color: "#f4f4f5",
  theme_night_primary_color: "#f4f4f5",
  theme_night_secondary_color: "#18181b",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#18181b";
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function foregroundFor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? "#18181b" : "#ffffff";
}

export function clubThemeStyle(identity: Partial<ClubIdentity> | null): ClubThemeStyle {
  const theme = { ...FALLBACK, ...identity };
  const primary = theme.theme_primary_color;

  return {
    "--club-primary": primary,
    "--club-primary-foreground": foregroundFor(primary),
    "--club-primary-soft": `color-mix(in oklch, ${primary} 11%, white)`,
    "--club-primary-muted": `color-mix(in oklch, ${primary} 68%, #71717a)`,
    "--club-line": `color-mix(in oklch, ${primary} 22%, #e4e4e7)`,
    "--club-page-bg-light": "#ffffff",
    "--club-page-bg-dark": "#000000",
  };
}
