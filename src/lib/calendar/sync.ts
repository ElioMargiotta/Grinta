import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseIcs, type ParsedEvent } from "./ics";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — un ICS d'équipe fait quelques Ko
const FETCH_TIMEOUT_MS = 10_000;

export type SyncOutcome = {
  ok: boolean;
  upserted: number;
  totalEvents: number;
  /** Code d'erreur stable, jamais à afficher tel quel — utilisé pour i18n. */
  errorCode?:
    | "fetch_failed"
    | "fetch_timeout"
    | "fetch_too_large"
    | "parse_failed"
    | "no_events"
    | "db_error";
  /** Message verbeux pour les logs / debug (last_error en DB). */
  errorMessage?: string;
};

/**
 * Récupère un fichier ICS depuis une URL HTTP(S). On accepte aussi le schéma
 * `webcal://` qu'on traduit vers https — c'est ce que beaucoup de fournisseurs
 * (Apple, football.ch sur certains liens) renvoient.
 */
async function fetchIcs(url: string): Promise<string> {
  const normalized = url.replace(/^webcal:\/\//i, "https://");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(normalized, {
      signal: ctl.signal,
      redirect: "follow",
      headers: { Accept: "text/calendar, text/plain;q=0.5, */*;q=0.1" },
    });
    if (!res.ok) {
      throw new Error(`fetch_failed_${res.status}`);
    }
    // Limite la taille pour éviter qu'un mauvais URL n'avale toute la mémoire
    // de la fonction.
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Error("fetch_too_large");
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.byteLength;
    }
    return new TextDecoder("utf-8").decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

type SyncInput = {
  supabase: SupabaseClient;
  teamId: string;
  clubId: string;
  source: "subscription" | "upload";
  /** Texte ICS déjà téléchargé (upload fichier OU cron). */
  icsText?: string;
  /** URL à fetcher si pas de texte. */
  icsUrl?: string;
};

/**
 * Synchronise les `team_matches` d'une équipe depuis un payload ICS. Quand
 * source = "subscription" on met aussi à jour la row
 * `team_calendar_subscriptions` correspondante. Pour un upload one-shot
 * (source = "upload") on laisse la subscription tranquille.
 */
export async function syncTeamCalendar(input: SyncInput): Promise<SyncOutcome> {
  const { supabase, teamId, clubId, source } = input;

  let text = input.icsText ?? "";
  if (!text && input.icsUrl) {
    try {
      text = await fetchIcs(input.icsUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code: SyncOutcome["errorCode"] = msg === "fetch_too_large"
        ? "fetch_too_large"
        : msg.includes("aborted") || msg.includes("AbortError")
          ? "fetch_timeout"
          : "fetch_failed";
      if (source === "subscription") {
        await markSubscriptionResult(supabase, teamId, code, msg, 0);
      }
      return { ok: false, upserted: 0, totalEvents: 0, errorCode: code, errorMessage: msg };
    }
  }

  let events: ParsedEvent[] = [];
  try {
    events = parseIcs(text).events;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (source === "subscription") {
      await markSubscriptionResult(supabase, teamId, "parse_failed", msg, 0);
    }
    return { ok: false, upserted: 0, totalEvents: 0, errorCode: "parse_failed", errorMessage: msg };
  }

  if (events.length === 0) {
    if (source === "subscription") {
      await markSubscriptionResult(supabase, teamId, "no_events", null, 0);
    }
    return { ok: false, upserted: 0, totalEvents: 0, errorCode: "no_events" };
  }

  const rows = events.map((e) => ({
    team_id: teamId,
    club_id: clubId,
    ics_uid: e.uid,
    starts_at: e.startsAt.toISOString(),
    ends_at: e.endsAt ? e.endsAt.toISOString() : null,
    summary: e.summary,
    location: e.location,
    description: e.description,
    match_url: e.matchUrl,
    source,
  }));

  const { error } = await supabase
    .from("team_matches")
    .upsert(rows, { onConflict: "team_id,ics_uid" });

  if (error) {
    if (source === "subscription") {
      await markSubscriptionResult(supabase, teamId, "db_error", error.message, 0);
    }
    return {
      ok: false,
      upserted: 0,
      totalEvents: events.length,
      errorCode: "db_error",
      errorMessage: error.message,
    };
  }

  if (source === "subscription") {
    await markSubscriptionResult(supabase, teamId, "ok", null, events.length);
  }

  return { ok: true, upserted: events.length, totalEvents: events.length };
}

async function markSubscriptionResult(
  supabase: SupabaseClient,
  teamId: string,
  status: SyncOutcome["errorCode"] | "ok",
  error: string | null,
  eventCount: number,
): Promise<void> {
  await supabase
    .from("team_calendar_subscriptions")
    .update({
      last_synced_at: new Date().toISOString(),
      last_status: status === "ok" ? "ok" : "error",
      last_error: error ?? (status === "ok" ? null : status ?? null),
      event_count: eventCount,
    })
    .eq("team_id", teamId);
}
