import type { CSSProperties, ReactNode } from "react";
import { GrintaLogoIcon, GrintaLogoType } from "@/components/landing/BrandSeal";
import { Link } from "@/i18n/navigation";

export type AuthTone = "default" | "staff" | "player" | "parent";

// Chaque profil teinte le champ de blobs : on surcharge simplement `--brand`,
// que les classes .blob consomment déjà via color-mix.
const TONE_BRAND: Record<AuthTone, string> = {
  default: "oklch(53.576% 0.19004 33.59)",
  staff: "oklch(0.56 0.22 300)",
  player: "oklch(0.56 0.16 248)",
  parent: "oklch(0.62 0.14 156)",
};

/**
 * Écran d'authentification immersif : un seul fond continu (blobs recolorés par
 * `tone`) couvre tout l'écran ; par-dessus, deux colonnes flottent sans couture
 * — à gauche la marque + `aside`, à droite le formulaire (`children`) dans une
 * carte translucide. Présentationnel : `name`/`tagline` viennent de l'appelant.
 */
export function AuthSplit({
  tone = "default",
  name,
  tagline,
  aside,
  children,
}: {
  tone?: AuthTone;
  name: string;
  tagline: string;
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="relative isolate min-h-screen"
      style={
        {
          "--brand": TONE_BRAND[tone] ?? TONE_BRAND.default,
          backgroundColor: "var(--bg)",
          color: "var(--ink)",
        } as CSSProperties
      }
    >
      {/* Fond unique, continu sous les deux colonnes. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
        <span className="blob blob-d" />
        <span className="blob blob-e" />
        <span className="blob blob-f" />
        <span className="grain" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-6 py-12 lg:grid lg:grid-cols-[1fr_minmax(0,440px)] lg:items-center lg:gap-16 lg:px-10">
        {/* ── Colonne marque + contenu, à même le fond ──────────────────── */}
        <div className="flex flex-col gap-8 lg:gap-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 self-start transition-opacity hover:opacity-80"
          >
            <GrintaLogoIcon size={40} title={name} />
            <GrintaLogoType height={26} title={name} className="w-auto" />
          </Link>

          <div className="lg:max-w-md">{aside}</div>

          <p className="eyebrow-mono hidden lg:block">{tagline}</p>
        </div>

        {/* ── Carte formulaire translucide — le fond transparaît ────────── */}
        <div className="rounded-3xl border border-[color-mix(in_oklch,var(--ink)_8%,transparent)] bg-[color-mix(in_oklch,var(--paper)_78%,transparent)] p-6 shadow-[0_28px_80px_-28px_rgba(24,24,27,0.4)] backdrop-blur-2xl sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
