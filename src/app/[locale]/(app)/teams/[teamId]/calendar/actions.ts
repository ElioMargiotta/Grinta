"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncTeamCalendar } from "@/lib/calendar/sync";

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
};

const URL_RE = /^(https?|webcal):\/\/[^\s]{4,1000}$/i;

async function loadTeamAccess(
  teamId: string,
): Promise<
  | { ok: true; clubId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: ActionResult["error"] }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: team } = await supabase
    .from("teams")
    .select("id, club_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { ok: false, error: "team_not_found" };

  return { ok: true, clubId: team.club_id as string, supabase };
}

/**
 * Enregistre / met à jour l'URL d'abonnement ICS d'une équipe, puis lance
 * tout de suite une première synchro. La row `team_calendar_subscriptions`
 * est créée via upsert sur `team_id` (PK) — RLS check passé par le calque
 * staff full/extended/team + club actif.
 */
export async function saveCalendarUrlAction(formData: FormData): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  if (!URL_RE.test(url)) return { error: "url_invalid" };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { supabase, clubId } = access;
  const { error: upsertErr } = await supabase
    .from("team_calendar_subscriptions")
    .upsert(
      {
        team_id: teamId,
        club_id: clubId,
        ics_url: url,
        last_status: "pending",
        last_error: null,
      },
      { onConflict: "team_id" },
    );
  if (upsertErr) {
    return upsertErr.message.toLowerCase().includes("permission") ||
      upsertErr.message.toLowerCase().includes("row-level")
      ? { error: "forbidden" }
      : { error: "db_error" };
  }

  const result = await syncTeamCalendar({
    supabase,
    teamId,
    clubId,
    source: "subscription",
    icsUrl: url,
  });

  revalidatePath(`/[locale]/teams/${teamId}`, "page");

  if (!result.ok) {
    return mapSyncError(result.errorCode);
  }
  return { ok: true, upserted: result.upserted };
}

/**
 * Re-synchronise une équipe déjà abonnée. Pas de modif de l'URL, on relit
 * celle déjà en base et on rejoue le pipeline. Sert au bouton "Synchroniser"
 * de la page équipe.
 */
export async function syncCalendarNowAction(formData: FormData): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { supabase, clubId } = access;
  const { data: sub } = await supabase
    .from("team_calendar_subscriptions")
    .select("ics_url")
    .eq("team_id", teamId)
    .maybeSingle();
  if (!sub?.ics_url) return { error: "url_invalid" };

  const result = await syncTeamCalendar({
    supabase,
    teamId,
    clubId,
    source: "subscription",
    icsUrl: sub.ics_url,
  });

  revalidatePath(`/[locale]/teams/${teamId}`, "page");

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
  const result = await syncTeamCalendar({
    supabase: access.supabase,
    teamId,
    clubId: access.clubId,
    source: "upload",
    icsText: text,
  });

  revalidatePath(`/[locale]/teams/${teamId}`, "page");

  if (!result.ok) return mapSyncError(result.errorCode);
  return { ok: true, upserted: result.upserted };
}

/**
 * Supprime l'abonnement (mais pas les matchs déjà importés — on les garde
 * pour préserver l'historique et les liens à venir). L'utilisateur peut
 * ensuite ré-abonner avec une autre URL ou tout purger via une future UI.
 */
export async function disconnectCalendarAction(formData: FormData): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { error } = await access.supabase
    .from("team_calendar_subscriptions")
    .delete()
    .eq("team_id", teamId);
  if (error) return { error: "db_error" };

  revalidatePath(`/[locale]/teams/${teamId}`, "page");
  return { ok: true };
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
