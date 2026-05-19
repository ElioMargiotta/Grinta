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

/**
 * Club-level player creation — no team required (#38). The player is attached
 * to the currently selected club; team affectation is handled separately
 * through player_team_assignments (#39).
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

  const { error } = await supabase.from("players").insert({
    club_id: membership.club_id,
    ...playerPayload(input),
  });

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/contingent`);
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
 */
export async function importClubCornerCsvAction(
  formData: FormData,
): Promise<ImportSummary> {
  const locale = String(formData.get("locale") ?? "fr");
  const csvText = String(formData.get("csv") ?? "");

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
        outcomes.push({ row: rowIndex, status: "updated", name });
      }
    } else {
      const { error } = await supabase.from("players").insert({
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
      });
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
        outcomes.push({ row: rowIndex, status: "created", name });
      }
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
