"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  deriveMatchSides,
  inspectCalendarTeam,
  probeIcsUrl,
  syncTeamCalendar,
} from "@/lib/calendar/sync";

type SlotValue = "first_round" | "second_round" | "full";

type ActionResult = {
  ok?: true;
  error?:
    | "unauthenticated"
    | "team_not_found"
    | "forbidden"
    | "url_invalid"
    | "ics_invalid"
    | "ics_empty"
    | "fetch_failed"
    | "fetch_timeout"
    | "fetch_too_large"
    | "db_error";
  upserted?: number;
  needsTeamSelection?: true;
  teamCandidates?: string[];
  updated?: number;
};

const URL_RE = /^(https?|webcal):\/\/[^\s]{4,1000}$/i;

async function loadTeamAccess(
  teamId: string,
): Promise<
  | {
      ok: true;
      clubId: string;
      calendarTeamName: string | null;
      supabase: Awaited<ReturnType<typeof createClient>>;
    }
  | { ok: false; error: ActionResult["error"] }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: team } = await supabase
    .from("teams")
    .select("id, club_id, calendar_team_name")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { ok: false, error: "team_not_found" };

  return {
    ok: true,
    clubId: team.club_id as string,
    calendarTeamName: (team.calendar_team_name as string | null) ?? null,
    supabase,
  };
}

/**
 * Enregistre l'identité calendrier puis recalcule en masse domicile/extérieur
 * pour les matchs importés, historique inclus.
 */
export async function setCalendarTeamIdentityAction(formData: FormData): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const calendarTeamName = String(formData.get("calendarTeamName") ?? "").trim();
  if (!calendarTeamName) return { error: "ics_invalid" };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };
  const { supabase, clubId } = access;
  const { data: club } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", clubId)
    .maybeSingle();
  const clubName = (club?.name as string | null) ?? null;

  const { error: identityError } = await supabase
    .from("teams")
    .update({ calendar_team_name: calendarTeamName })
    .eq("id", teamId);
  if (identityError) return { error: "db_error" };

  const { data: rows, error: rowsError } = await supabase
    .from("team_matches")
    .select("id, summary")
    .eq("team_id", teamId)
    .neq("source", "manual");
  if (rowsError) return { error: "db_error" };

  let updated = 0;
  for (const row of rows ?? []) {
    const sides = deriveMatchSides(row.summary as string | null, calendarTeamName, clubName);
    if (!sides.homeAway) continue;
    const { error } = await supabase
      .from("team_matches")
      .update({ home_away: sides.homeAway })
      .eq("id", row.id);
    if (error) return { error: "db_error" };
    updated++;
  }

  revalidatePath(`/[locale]/planner/${teamId}`, "page");
  return { ok: true, updated };
}

async function resolveCalendarTeamName(
  access: Extract<Awaited<ReturnType<typeof loadTeamAccess>>, { ok: true }>,
  teamId: string,
  icsText: string,
  selected: string,
): Promise<{ name?: string; result?: ActionResult }> {
  const inspection = inspectCalendarTeam(icsText);
  const name = selected || access.calendarTeamName || inspection.automatic;
  if (!name) {
    return {
      result: {
        needsTeamSelection: true,
        teamCandidates: inspection.candidates,
      },
    };
  }
  if (name !== access.calendarTeamName) {
    const { error } = await access.supabase
      .from("teams")
      .update({ calendar_team_name: name })
      .eq("id", teamId);
    if (error) return { result: { error: "db_error" } };
  }
  return { name };
}

/**
 * Ajoute un calendrier ICS (ou modifie l'URL d'un lien existant via
 * `subscriptionId`), puis lance une première synchro. Le tour (slot) est
 * auto-détecté depuis les dates du flux — aucune question posée. Plusieurs liens
 * par tour sont permis (ajout silencieux). Upsert sur `(team_id, ics_url)` ;
 * RLS = staff full/extended/team + club actif.
 */
export async function saveCalendarUrlAction(formData: FormData): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const selectedTeamName = String(formData.get("calendarTeamName") ?? "").trim();
  if (!URL_RE.test(url)) return { error: "url_invalid" };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { supabase, clubId } = access;

  // Auto-classement : on lit les dates du flux pour le ranger tout seul dans le
  // bon tour. Le texte est réutilisé pour la synchro (pas de second fetch).
  const probe = await probeIcsUrl(url);
  if (!probe.ok) return mapSyncError(probe.errorCode);
  const slot: SlotValue = probe.slot;
  const identity = await resolveCalendarTeamName(
    access,
    teamId,
    probe.icsText,
    selectedTeamName,
  );
  if (identity.result) return identity.result;

  // Modification d'un lien existant : on met à jour SA row (même id, donc ses
  // matchs restent rattachés). Sinon : nouvel abonnement (upsert sur l'URL).
  let id: string;
  if (subscriptionId) {
    const { data, error } = await supabase
      .from("team_calendar_subscriptions")
      .update({ ics_url: url, slot, last_status: "pending", last_error: null })
      .eq("team_id", teamId)
      .eq("id", subscriptionId)
      .select("id")
      .maybeSingle();
    if (error || !data) return mapWriteError(error?.message);
    id = data.id as string;
  } else {
    const { data, error } = await supabase
      .from("team_calendar_subscriptions")
      .upsert(
        {
          team_id: teamId,
          club_id: clubId,
          slot,
          ics_url: url,
          last_status: "pending",
          last_error: null,
        },
        { onConflict: "team_id,ics_url" },
      )
      .select("id")
      .single();
    if (error || !data) return mapWriteError(error?.message);
    id = data.id as string;
  }

  const result = await syncTeamCalendar({
    supabase,
    teamId,
    clubId,
    source: "subscription",
    slot,
    subscriptionId: id,
    icsUrl: url,
    icsText: probe.icsText,
    calendarTeamName: identity.name,
  });

  revalidatePath(`/[locale]/planner/${teamId}`, "page");

  if (!result.ok) {
    return mapSyncError(result.errorCode);
  }
  return { ok: true, upserted: result.upserted };
}

/**
 * Re-synchronise un abonnement précis (par `subscriptionId`). On relit l'URL en
 * base et on rejoue le pipeline. Sert au bouton « Synchroniser » d'une ligne de
 * calendrier connecté.
 */
export async function syncCalendarNowAction(formData: FormData): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { supabase, clubId } = access;
  const { data: sub } = await supabase
    .from("team_calendar_subscriptions")
    .select("ics_url, slot")
    .eq("team_id", teamId)
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub?.ics_url) return { error: "url_invalid" };

  const result = await syncTeamCalendar({
    supabase,
    teamId,
    clubId,
    source: "subscription",
    slot: sub.slot as SlotValue,
    subscriptionId,
    icsUrl: sub.ics_url as string,
  });

  revalidatePath(`/[locale]/planner/${teamId}`, "page");

  if (!result.ok) return mapSyncError(result.errorCode);
  return { ok: true, upserted: result.upserted };
}

/**
 * Import one-shot d'un fichier .ics uploadé. Pas d'abonnement = pas de
 * `team_calendar_subscriptions` créée ni mise à jour. Source = "upload"
 * sur les rows pour qu'on puisse différencier dans l'UI plus tard.
 */
export async function uploadCalendarFileAction(formData: FormData): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "ics_invalid" };
  if (file.size > 2 * 1024 * 1024) return { error: "fetch_too_large" };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const text = await file.text();
  const selectedTeamName = String(formData.get("calendarTeamName") ?? "").trim();
  const identity = await resolveCalendarTeamName(access, teamId, text, selectedTeamName);
  if (identity.result) return identity.result;
  const result = await syncTeamCalendar({
    supabase: access.supabase,
    teamId,
    clubId: access.clubId,
    source: "upload",
    icsText: text,
    calendarTeamName: identity.name,
  });

  revalidatePath(`/[locale]/planner/${teamId}`, "page");

  if (!result.ok) return mapSyncError(result.errorCode);
  return { ok: true, upserted: result.upserted };
}

/**
 * Supprime un lien ICS ET ses matchs À VENIR. On conserve : les matchs déjà
 * joués (archived = true, pour l'historique et les liens éval/présences) et les
 * matchs manuels. L'ordre compte : on retire d'abord les matchs (filtrés par
 * `subscription_id`), puis l'abonnement.
 */
export async function disconnectCalendarAction(formData: FormData): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { supabase } = access;

  // Matchs à venir de ce lien (jamais les joués/archivés ni le manuel).
  const { error: matchErr } = await supabase
    .from("team_matches")
    .delete()
    .eq("team_id", teamId)
    .eq("subscription_id", subscriptionId)
    .eq("archived", false)
    .neq("source", "manual");
  if (matchErr) return { error: "db_error" };

  const { error } = await supabase
    .from("team_calendar_subscriptions")
    .delete()
    .eq("team_id", teamId)
    .eq("id", subscriptionId);
  if (error) return { error: "db_error" };

  revalidatePath(`/[locale]/planner/${teamId}`, "page");
  return { ok: true };
}

/** Mappe une erreur d'écriture subscription : RLS → forbidden, sinon db_error. */
function mapWriteError(message: string | undefined): ActionResult {
  const m = (message ?? "").toLowerCase();
  return m.includes("permission") || m.includes("row-level")
    ? { error: "forbidden" }
    : { error: "db_error" };
}

function mapSyncError(code: string | undefined): ActionResult {
  switch (code) {
    case "fetch_failed":
    case "fetch_timeout":
    case "fetch_too_large":
      return { error: code };
    case "parse_failed":
      return { error: "ics_invalid" };
    case "no_events":
      return { error: "ics_empty" };
    case "db_error":
      return { error: "db_error" };
    default:
      return { error: "db_error" };
  }
}
