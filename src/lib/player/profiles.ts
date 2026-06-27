import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Profils liés au compte courant (Lot E) : self (players.user_id) ∪ guardian
// (player_guardians), tous clubs. Alimente le sélecteur de profil du portail
// joueur/parent : double passeport (même compte, 2 clubs) et fratrie (un parent,
// plusieurs enfants).

export type LinkedPlayer = {
  playerId: string;
  clubId: string;
  clubName: string;
  firstName: string;
  lastName: string;
  relation: "self" | "guardian";
  status: "active" | "inactive" | "left" | "archived";
};

const ACTIVE_PLAYER_COOKIE = "grinta_active_player";

export async function getLinkedPlayers(): Promise<LinkedPlayer[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_linked_players");
  const rows = (data as
    | {
        player_id: string;
        club_id: string;
        club_name: string | null;
        first_name: string | null;
        last_name: string | null;
        relation: string;
        status: string | null;
      }[]
    | null) ?? [];
  return rows.map((r) => ({
    playerId: r.player_id,
    clubId: r.club_id,
    clubName: r.club_name ?? "—",
    firstName: r.first_name ?? "",
    lastName: r.last_name ?? "",
    relation: r.relation === "guardian" ? "guardian" : "self",
    status: (["active", "inactive", "left", "archived"].includes(r.status ?? "")
      ? r.status
      : "active") as LinkedPlayer["status"],
  }));
}

/**
 * Profil actif du portail : cookie validé contre la liste des profils liés.
 * Défaut = première fiche "self" active, sinon la première fiche disponible.
 */
export async function resolveActivePlayer(
  linked: LinkedPlayer[],
): Promise<LinkedPlayer | null> {
  if (linked.length === 0) return null;
  const store = await cookies();
  const cookieId = store.get(ACTIVE_PLAYER_COOKIE)?.value;
  const fromCookie = cookieId
    ? linked.find((p) => p.playerId === cookieId)
    : undefined;
  if (fromCookie) return fromCookie;
  return (
    linked.find((p) => p.relation === "self" && p.status === "active") ??
    linked.find((p) => p.status === "active") ??
    linked[0]
  );
}

export async function setActivePlayerCookie(playerId: string): Promise<void> {
  const store = await cookies();
  try {
    store.set(ACTIVE_PLAYER_COOKIE, playerId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch {
    // Écriture cookie illégale hors Server Action / Route Handler — ignoré.
  }
}
