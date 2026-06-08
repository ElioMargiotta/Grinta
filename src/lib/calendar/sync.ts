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

/**
 * Archive (= détache de l'ICS) les matchs déjà commencés. Un match dont l'heure
 * de coup d'envoi est passée bascule `archived = true` : il sort du calendrier
 * actif (rangé en Historique) et la synchro l'ignore désormais, donc il reste en
 * base même si la fédé le retire du flux. Idempotent : ne retouche jamais un
 * match déjà archivé. À appeler avant chaque synchro et à l'ouverture du planner.
 */
export async function archivePastMatches(
  supabase: SupabaseClient,
  teamId: string,
): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("team_matches")
    .update({ archived: true, archived_at: nowIso })
    .eq("team_id", teamId)
    .eq("archived", false)
    .lt("starts_at", nowIso)
    .select("id");
  return data?.length ?? 0;
}

export type SubscriptionSlot = "first_round" | "second_round" | "full";

function zurichYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Range un flux ICS dans un tour à partir des dates de ses matchs, sans rien
 * demander au coach. Modèle du foot suisse (ANF/ASF) : automne = 1er tour,
 * printemps = 2e tour. Règle déterministe sur le mois (heure de Zurich) :
 *   * juil → déc        → `first_round`
 *   * janv → juin       → `second_round`
 *   * à cheval (2 demis) → `full` (typiquement un flux saison complète)
 * Flux vide → `full` (défaut sûr).
 */
export function classifyEventsBySlot(events: ParsedEvent[]): SubscriptionSlot {
  let autumn = false; // juil → déc (1er tour)
  let spring = false; // janv → juin (2e tour)
  for (const e of events) {
    const month = Number(zurichYmd(e.startsAt).slice(5, 7));
    if (month >= 7) autumn = true;
    else spring = true;
  }
  if (autumn && spring) return "full";
  if (spring) return "second_round";
  if (autumn) return "first_round";
  return "full";
}

export type IcsProbe =
  | {
      ok: true;
      slot: SubscriptionSlot;
      eventCount: number;
      firstDate: string;
      lastDate: string;
      icsText: string;
    }
  | { ok: false; errorCode: SyncOutcome["errorCode"]; errorMessage?: string };

/**
 * Télécharge + parse un ICS pour en déduire le tour (slot) et la plage de dates,
 * AVANT toute écriture en base. Sert à l'auto-classement de
 * `saveCalendarUrlAction` : on colle un lien, on sait dans quel tour il va. Le
 * texte téléchargé est renvoyé pour éviter un second fetch à la synchro.
 */
export async function probeIcsUrl(url: string): Promise<IcsProbe> {
  let text: string;
  try {
    text = await fetchIcs(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code: SyncOutcome["errorCode"] =
      msg === "fetch_too_large"
        ? "fetch_too_large"
        : msg.includes("aborted") || msg.includes("AbortError")
          ? "fetch_timeout"
          : "fetch_failed";
    return { ok: false, errorCode: code, errorMessage: msg };
  }

  let events: ParsedEvent[];
  try {
    events = parseIcs(text).events;
  } catch (e) {
    return {
      ok: false,
      errorCode: "parse_failed",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }

  if (events.length === 0) return { ok: false, errorCode: "no_events" };

  const dates = events.map((e) => zurichYmd(e.startsAt)).sort();
  return {
    ok: true,
    slot: classifyEventsBySlot(events),
    eventCount: events.length,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    icsText: text,
  };
}

type SyncInput = {
  supabase: SupabaseClient;
  teamId: string;
  clubId: string;
  source: "subscription" | "upload";
  /** Slot d'abonnement visé (source = subscription). Défaut : full. */
  slot?: SubscriptionSlot;
  /** Abonnement source — rattache les matchs importés à ce lien. */
  subscriptionId?: string;
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
/**
 * Best-effort : déduit (adversaire, domicile/extérieur) depuis un SUMMARY
 * football.ch du type "FC Domicile - FC Visiteur". On compare chaque côté au nom
 * de l'équipe. Si rien ne matche franchement, on renvoie des nulls — on ne devine
 * pas. Pensé pour enrichir, jamais pour bloquer une synchro.
 */
function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function deriveMatchSides(
  summary: string | null,
  teamName: string | null,
): { opponent: string | null; homeAway: "home" | "away" | null } {
  if (!summary || !teamName) return { opponent: null, homeAway: null };
  const parts = summary.split(/\s+-\s+/);
  if (parts.length < 2) return { opponent: null, homeAway: null };

  // On garde les 2 premiers segments (le reste = catégorie / compétition).
  const home = parts[0].trim();
  const away = parts[1].trim();
  const team = normalizeName(teamName);
  const nHome = normalizeName(home);
  const nAway = normalizeName(away);

  const matchesHome = nHome.includes(team) || team.includes(nHome);
  const matchesAway = nAway.includes(team) || team.includes(nAway);

  if (matchesHome && !matchesAway) return { opponent: away, homeAway: "home" };
  if (matchesAway && !matchesHome) return { opponent: home, homeAway: "away" };
  return { opponent: null, homeAway: null };
}

export async function syncTeamCalendar(input: SyncInput): Promise<SyncOutcome> {
  const { supabase, teamId, clubId, source } = input;
  const icsUrl = input.icsUrl;

  // Statut de synchro porté par l'abonnement EXACT (clé = ics_url, unique par
  // équipe). On évite ainsi d'écraser le statut d'un autre flux du même tour.
  const mark = (
    status: SyncOutcome["errorCode"] | "ok",
    error: string | null,
    eventCount: number,
  ): Promise<void> =>
    source === "subscription" && icsUrl
      ? markSubscriptionResult(supabase, teamId, icsUrl, status, error, eventCount)
      : Promise.resolve();

  // Détache d'abord les matchs joués : ils ne doivent plus être touchés par le
  // flux (et restent en base / en Historique même si la fédé les a retirés).
  await archivePastMatches(supabase, teamId);

  let text = input.icsText ?? "";
  if (!text && icsUrl) {
    try {
      text = await fetchIcs(icsUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code: SyncOutcome["errorCode"] = msg === "fetch_too_large"
        ? "fetch_too_large"
        : msg.includes("aborted") || msg.includes("AbortError")
          ? "fetch_timeout"
          : "fetch_failed";
      await mark(code, msg, 0);
      return { ok: false, upserted: 0, totalEvents: 0, errorCode: code, errorMessage: msg };
    }
  }

  let events: ParsedEvent[] = [];
  try {
    events = parseIcs(text).events;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await mark("parse_failed", msg, 0);
    return { ok: false, upserted: 0, totalEvents: 0, errorCode: "parse_failed", errorMessage: msg };
  }

  if (events.length === 0) {
    await mark("no_events", null, 0);
    return { ok: false, upserted: 0, totalEvents: 0, errorCode: "no_events" };
  }

  // Nom de l'équipe pour déduire domicile/extérieur depuis le SUMMARY.
  // Best-effort : si la lecture échoue, on enrichit juste sans les côtés.
  const { data: teamRow } = await supabase
    .from("teams")
    .select("name")
    .eq("id", teamId)
    .maybeSingle();
  const teamName = (teamRow?.name as string | null) ?? null;

  // Matchs déjà archivés (détachés) : on ne les réimporte/écrase jamais, même
  // s'ils sont encore présents dans le flux.
  const { data: archivedRows } = await supabase
    .from("team_matches")
    .select("ics_uid")
    .eq("team_id", teamId)
    .eq("archived", true);
  const archivedUids = new Set(
    (archivedRows ?? []).map((r) => r.ics_uid as string),
  );

  const rows = events
    .filter((e) => !archivedUids.has(e.uid))
    .map((e) => {
    const { opponent, homeAway } = deriveMatchSides(e.summary, teamName);
    return {
      team_id: teamId,
      club_id: clubId,
      ics_uid: e.uid,
      starts_at: e.startsAt.toISOString(),
      ends_at: e.endsAt ? e.endsAt.toISOString() : null,
      summary: e.summary,
      location: e.location,
      description: e.description,
      match_url: e.matchUrl,
      opponent,
      home_away: homeAway,
      source,
      subscription_id: input.subscriptionId ?? null,
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from("team_matches")
      .upsert(rows, { onConflict: "team_id,ics_uid" });

    if (error) {
      await mark("db_error", error.message, 0);
      return {
        ok: false,
        upserted: 0,
        totalEvents: events.length,
        errorCode: "db_error",
        errorMessage: error.message,
      };
    }
  }

  await mark("ok", null, events.length);

  return { ok: true, upserted: rows.length, totalEvents: events.length };
}

async function markSubscriptionResult(
  supabase: SupabaseClient,
  teamId: string,
  icsUrl: string,
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
    .eq("team_id", teamId)
    .eq("ics_url", icsUrl);
}
