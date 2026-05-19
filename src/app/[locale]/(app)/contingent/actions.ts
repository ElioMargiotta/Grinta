"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentMembership } from "@/lib/club/context";
import {
  parseClubCornerCsv,
  type ClubCornerPlayer,
} from "@/lib/contingent/clubcorner-csv";

type PlayerInput = {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  position: string | null;
  jerseyNumber: number | null;
  notes: string | null;
  strongFoot: "left" | "right" | "both" | null;
  licenseNumber: string | null;
  jsNumber: string | null;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  canton: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  guardian2Name: string | null;
  guardian2Email: string | null;
  guardian2Phone: string | null;
};

function str(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v.length > 0 ? v : null;
}

function readPlayer(formData: FormData): PlayerInput {
  const jerseyRaw = String(formData.get("jerseyNumber") ?? "").trim();
  const foot = str(formData, "strongFoot");
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    birthDate: String(formData.get("birthDate") ?? "") || null,
    position: str(formData, "position"),
    jerseyNumber: jerseyRaw ? Number(jerseyRaw) : null,
    notes: str(formData, "notes"),
    strongFoot:
      foot === "left" || foot === "right" || foot === "both" ? foot : null,
    licenseNumber: str(formData, "licenseNumber"),
    jsNumber: str(formData, "jsNumber"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    nationality: str(formData, "nationality"),
    address: str(formData, "address"),
    postalCode: str(formData, "postalCode"),
    city: str(formData, "city"),
    canton: str(formData, "canton"),
    guardianName: str(formData, "guardianName"),
    guardianEmail: str(formData, "guardianEmail"),
    guardianPhone: str(formData, "guardianPhone"),
    guardian2Name: str(formData, "guardian2Name"),
    guardian2Email: str(formData, "guardian2Email"),
    guardian2Phone: str(formData, "guardian2Phone"),
  };
}

function playerPayload(input: PlayerInput) {
  return {
    first_name: input.firstName,
    last_name: input.lastName,
    birth_date: input.birthDate,
    position: input.position,
    jersey_number: input.jerseyNumber,
    notes: input.notes,
    strong_foot: input.strongFoot,
    license_number: input.licenseNumber,
    js_number: input.jsNumber,
    email: input.email,
    phone: input.phone,
    nationality: input.nationality,
    address: input.address,
    postal_code: input.postalCode,
    city: input.city,
    canton: input.canton,
    guardian_name: input.guardianName,
    guardian_email: input.guardianEmail,
    guardian_phone: input.guardianPhone,
    guardian2_name: input.guardian2Name,
    guardian2_email: input.guardian2Email,
    guardian2_phone: input.guardian2Phone,
  };
}

/** Lit les `teamIds[]` (multi-select form data) en filtrant les vides. */
function readTeamIds(formData: FormData): string[] {
  return formData
    .getAll("teamIds")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
}

/**
 * Club-level player creation — no team required (#38). The player is attached
 * to the currently selected club; team affectations sont gérées via
 * `player_team_assignments` (#39). Si le formulaire fournit `teamIds[]`, on
 * insère les rattachements immédiatement (saison NULL = "actuelle").
 */
export async function createClubPlayerAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "fr");
  const input = readPlayer(formData);
  if (!input.firstName || !input.lastName) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const membership = await resolveCurrentMembership();
  if (!membership) redirect(`/${locale}/onboarding/club`);

  const { data: created, error } = await supabase
    .from("players")
    .insert({
      club_id: membership.club_id,
      ...playerPayload(input),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const teamIds = readTeamIds(formData);
  if (created && teamIds.length > 0) {
    const { error: aErr } = await supabase
      .from("player_team_assignments")
      .insert(teamIds.map((team_id) => ({ player_id: created.id, team_id })));
    // L'insert principal a réussi : si l'affectation échoue on remonte le
    // message mais on n'annule pas la création (RLS, conflit unique, etc.).
    if (aErr) return { error: aErr.message };
  }

  revalidatePath(`/${locale}/contingent`);
}

/**
 * Replace-set des affectations équipes d'un joueur (#39). Tous les
 * assignments existants (saison NULL = "courante") sont remplacés par
 * l'ensemble `teamIds[]` fourni. Les assignments d'autres saisons ne sont
 * pas touchés.
 */
export async function setPlayerAssignmentsAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "fr");
  const playerId = String(formData.get("playerId") ?? "");
  const teamIds = readTeamIds(formData);
  if (!playerId) return { error: "Missing player" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: existing, error: readErr } = await supabase
    .from("player_team_assignments")
    .select("id, team_id")
    .eq("player_id", playerId)
    .is("season", null);
  if (readErr) return { error: readErr.message };

  const currentByTeam = new Map(
    (existing ?? []).map((r) => [r.team_id as string, r.id as string]),
  );
  const desired = new Set(teamIds);

  const toRemoveIds: string[] = [];
  for (const [teamId, id] of currentByTeam) {
    if (!desired.has(teamId)) toRemoveIds.push(id);
  }
  const toAdd = teamIds.filter((t) => !currentByTeam.has(t));

  if (toRemoveIds.length > 0) {
    const { error } = await supabase
      .from("player_team_assignments")
      .delete()
      .in("id", toRemoveIds);
    if (error) return { error: error.message };
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("player_team_assignments")
      .insert(toAdd.map((team_id) => ({ player_id: playerId, team_id })));
    if (error) return { error: error.message };
  }

  revalidatePath(`/${locale}/contingent`);
  revalidatePath(`/${locale}/contingent/${playerId}`);
}

/**
 * Affecte en masse une liste de joueurs à une équipe (#39). Idempotent :
 * les joueurs déjà rattachés (saison NULL) sont ignorés silencieusement.
 */
export async function bulkAssignPlayersToTeamAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "fr");
  const teamId = String(formData.get("teamId") ?? "");
  const playerIds = formData
    .getAll("playerIds")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);

  if (!teamId || playerIds.length === 0) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // L'unique index porte sur (player_id, team_id, COALESCE(season, '')).
  // On déduplique côté app pour éviter les conflits côté DB.
  const { data: already, error: readErr } = await supabase
    .from("player_team_assignments")
    .select("player_id")
    .eq("team_id", teamId)
    .is("season", null)
    .in("player_id", playerIds);
  if (readErr) return { error: readErr.message };

  const skip = new Set((already ?? []).map((r) => r.player_id as string));
  const toInsert = playerIds.filter((pid) => !skip.has(pid));

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("player_team_assignments")
      .insert(toInsert.map((player_id) => ({ player_id, team_id: teamId })));
    if (error) return { error: error.message };
  }

  revalidatePath(`/${locale}/contingent`);
  return { assigned: toInsert.length, skipped: skip.size };
}

export async function updateClubPlayerAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "fr");
  const playerId = String(formData.get("playerId") ?? "");
  const input = readPlayer(formData);
  if (!playerId || !input.firstName || !input.lastName) {
    return { error: "Missing fields" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase
    .from("players")
    .update(playerPayload(input))
    .eq("id", playerId);

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/contingent`);
  revalidatePath(`/${locale}/contingent/${playerId}`);
}

export type ImportRowOutcome =
  | { row: number; status: "created"; name: string }
  | { row: number; status: "updated"; name: string }
  | { row: number; status: "skipped"; name: string; reason: string }
  | { row: number; status: "error"; name: string; reason: string };

export type ImportSummary = {
  fatalError?: string;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  outcomes: ImportRowOutcome[];
};

/**
 * Import des joueurs depuis un export CSV ClubCorner (#38).
 *
 * Déduplication : par `license_number` (Numéro de passeport ASF) en
 * priorité, sinon par triplette (first_name, last_name, birth_date).
 * Sur match → update partiel (les champs vides du CSV n'écrasent jamais
 * les valeurs existantes). Pas de match → insert avec `club_id` du club
 * actif.
 *
 * Si `targetTeamId` est fourni (#39), chaque joueur créé OU déjà existant
 * est rattaché à cette équipe (saison NULL). Idempotent grâce à l'index
 * unique `(player_id, team_id, COALESCE(season, ''))`.
 */
export async function importClubCornerCsvAction(
  formData: FormData,
): Promise<ImportSummary> {
  const locale = String(formData.get("locale") ?? "fr");
  const csvText = String(formData.get("csv") ?? "");
  const targetTeamId = String(formData.get("targetTeamId") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const membership = await resolveCurrentMembership();
  if (!membership) redirect(`/${locale}/onboarding/club`);

  const parsed = parseClubCornerCsv(csvText);
  if (parsed.fatalError) {
    return {
      fatalError: parsed.fatalError,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      outcomes: [],
    };
  }

  const outcomes: ImportRowOutcome[] = [];
  const importedPlayerIds: string[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const { rowIndex, player, errors: rowErrors } of parsed.rows) {
    const name = `${player.first_name} ${player.last_name}`.trim();
    if (rowErrors.length > 0) {
      skipped++;
      outcomes.push({
        row: rowIndex,
        status: "skipped",
        name: name || `row ${rowIndex}`,
        reason: rowErrors.join(", "),
      });
      continue;
    }

    // Lookup existing player in this club.
    let existingId: string | null = null;
    if (player.license_number) {
      const { data } = await supabase
        .from("players")
        .select("id")
        .eq("club_id", membership.club_id)
        .eq("license_number", player.license_number)
        .maybeSingle();
      existingId = data?.id ?? null;
    }
    if (!existingId && player.birth_date) {
      const { data } = await supabase
        .from("players")
        .select("id")
        .eq("club_id", membership.club_id)
        .eq("first_name", player.first_name)
        .eq("last_name", player.last_name)
        .eq("birth_date", player.birth_date)
        .maybeSingle();
      existingId = data?.id ?? null;
    }

    if (existingId) {
      const patch = nonNullPatch(player);
      // Identity fields are always present (validated above) — include them
      // too so a license-only match still gets the canonical spelling.
      patch.first_name = player.first_name;
      patch.last_name = player.last_name;
      const { error } = await supabase
        .from("players")
        .update(patch)
        .eq("id", existingId);
      if (error) {
        errors++;
        outcomes.push({
          row: rowIndex,
          status: "error",
          name,
          reason: error.message,
        });
      } else {
        updated++;
        importedPlayerIds.push(existingId);
        outcomes.push({ row: rowIndex, status: "updated", name });
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("players")
        .insert({
          club_id: membership.club_id,
          first_name: player.first_name,
          last_name: player.last_name,
          birth_date: player.birth_date,
          position: player.position,
          jersey_number: player.jersey_number,
          strong_foot: player.strong_foot,
          license_number: player.license_number,
          js_number: player.js_number,
          email: player.email,
          phone: player.phone,
          nationality: player.nationality,
          address: player.address,
          postal_code: player.postal_code,
          city: player.city,
          canton: player.canton,
          guardian_name: player.guardian_name,
          guardian_email: player.guardian_email,
          guardian_phone: player.guardian_phone,
          guardian2_name: player.guardian2_name,
          guardian2_email: player.guardian2_email,
          guardian2_phone: player.guardian2_phone,
        })
        .select("id")
        .single();
      if (error) {
        errors++;
        outcomes.push({
          row: rowIndex,
          status: "error",
          name,
          reason: error.message,
        });
      } else {
        created++;
        if (inserted?.id) importedPlayerIds.push(inserted.id);
        outcomes.push({ row: rowIndex, status: "created", name });
      }
    }
  }

  // Affectation à l'équipe cible (optionnelle) — #39. On déduplique vs les
  // assignments existants pour rester idempotent même si l'import est rejoué.
  if (targetTeamId && importedPlayerIds.length > 0) {
    const { data: already } = await supabase
      .from("player_team_assignments")
      .select("player_id")
      .eq("team_id", targetTeamId)
      .is("season", null)
      .in("player_id", importedPlayerIds);
    const skipSet = new Set((already ?? []).map((r) => r.player_id as string));
    const toInsert = importedPlayerIds.filter((pid) => !skipSet.has(pid));
    if (toInsert.length > 0) {
      await supabase
        .from("player_team_assignments")
        .insert(
          toInsert.map((player_id) => ({ player_id, team_id: targetTeamId })),
        );
    }
  }

  revalidatePath(`/${locale}/contingent`);
  return { created, updated, skipped, errors, outcomes };
}

/** Build a partial update where empty CSV fields don't clobber existing data. */
function nonNullPatch(p: ClubCornerPlayer): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== null && v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

export async function deleteClubPlayerAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "fr");
  const playerId = String(formData.get("playerId") ?? "");
  if (!playerId) return { error: "Missing player" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/contingent`);
  redirect(`/${locale}/contingent`);
}
