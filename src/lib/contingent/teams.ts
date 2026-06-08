/**
 * Helpers pour lister les équipes d'un club, utilisés par tous les écrans
 * d'affectation joueur ↔ équipes (#39) : formulaire de création, fiche
 * joueur, wizard d'import et action en masse depuis la liste.
 */

import { createClient } from "@/lib/supabase/server";

export type ClubTeamOption = {
  id: string;
  name: string;
  age_group: string | null;
  season: string | null;
};

/**
 * Équipes actives du club pour une saison donnée (les archives ne servent pas à
 * affecter). Le scope saison passe par la table d'appartenance team_seasons :
 * une équipe n'est listée que si elle est présente dans la saison demandée.
 */
export async function listClubTeams(
  clubId: string,
  season: string,
): Promise<ClubTeamOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("id, name, age_group, season, team_seasons!inner(season)")
    .eq("club_id", clubId)
    .is("archived_at", null)
    .eq("team_seasons.season", season)
    .order("name", { ascending: true })
    .returns<ClubTeamOption[]>();
  return data ?? [];
}
