import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  currentSeasonLabel,
  seasonLabelFromYear,
  seasonStartYear,
} from "@/lib/planner/seasons";

/**
 * Contexte « saison active » du club — calqué sur le contexte club
 * (cookie + resolve). Une saison est un millésime `YYYY/YY`. La saison choisie
 * dans la Topbar pilote toutes les vues (équipes, contingent, planif) pour
 * offrir une vue d'ensemble du club PAR saison.
 */

const CURRENT_SEASON_COOKIE = "grinta_current_season";
const COOKIE_MAX_AGE_DAYS = 365;
const SEASON_RE = /^\d{4}\/\d{2}$/;

export async function getCurrentSeasonCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(CURRENT_SEASON_COOKIE)?.value ?? null;
}

export async function setCurrentSeason(label: string): Promise<void> {
  const store = await cookies();
  try {
    store.set(CURRENT_SEASON_COOKIE, label, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * COOKIE_MAX_AGE_DAYS,
    });
  } catch {
    // Appelé pendant le rendu d'un Server Component : écriture cookie illégale.
    // Best-effort — le fallback reste la saison courante ; les Server Actions
    // (switch saison) persistent bien le cookie.
  }
}

/** Saison active de la requête : cookie valide, sinon millésime courant. */
export async function resolveCurrentSeasonLabel(): Promise<string> {
  const fromCookie = await getCurrentSeasonCookie();
  return fromCookie && SEASON_RE.test(fromCookie) ? fromCookie : currentSeasonLabel();
}

/**
 * Liste des saisons connues du club pour le sélecteur : union des millésimes
 * d'appartenance des équipes (team_seasons) et des plans de saison, + la saison
 * courante et la saison suivante (pour préparer la prochaine saison à l'avance).
 * Triée du plus récent au plus ancien.
 */
export async function listClubSeasons(
  supabase: SupabaseClient,
  clubId: string,
): Promise<string[]> {
  const [teamSeasonsRes, plansRes] = await Promise.all([
    supabase.from("team_seasons").select("season").eq("club_id", clubId),
    supabase.from("season_plans").select("season_label").eq("club_id", clubId),
  ]);

  const current = currentSeasonLabel();
  const next = seasonLabelFromYear(seasonStartYear(current) + 1);
  const labels = new Set<string>([current, next]);
  for (const r of teamSeasonsRes.data ?? []) {
    const s = (r as { season: string | null }).season;
    if (s && SEASON_RE.test(s)) labels.add(s);
  }
  for (const r of plansRes.data ?? []) {
    const s = (r as { season_label: string | null }).season_label;
    if (s && SEASON_RE.test(s)) labels.add(s);
  }
  return [...labels].sort((a, b) => b.localeCompare(a));
}
