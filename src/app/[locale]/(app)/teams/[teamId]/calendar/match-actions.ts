"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";
import { isStructuringKind } from "@/lib/planner/season";
import { parseBoard } from "@/lib/planner/tacticalSystems";

type ActionResult = {
  ok?: true;
  error?:
    | "unauthenticated"
    | "team_not_found"
    | "forbidden"
    | "match_not_found"
    | "invalid_date"
    | "invalid_input"
    | "not_manual"
    | "db_error";
  deleted?: number;
};

const KINDS = ["league", "cup", "friendly", "tournament", "break"] as const;
const HOME_AWAY = ["home", "away"] as const;
const SCHEMES = ["standard", "congested", "custom"] as const;

type Kind = (typeof KINDS)[number];
type HomeAway = (typeof HOME_AWAY)[number];
type Scheme = (typeof SCHEMES)[number];

async function loadTeamAccess(teamId: string): Promise<
  | {
      ok: true;
      clubId: string;
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
    .select("id, club_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { ok: false, error: "team_not_found" };

  return { ok: true, clubId: team.club_id as string, supabase };
}

/**
 * Convertit une date+heure locale (Europe/Zurich par défaut) en instant UTC.
 * Même principe que le parseur ICS : on traite le couple comme de l'UTC, on
 * demande à Intl ce que cet instant affiche dans la TZ cible et on déduit
 * l'offset (gère l'heure d'été).
 */
function zurichLocalToUtc(
  dateYmd: string,
  timeHm: string,
  tz = "Europe/Zurich",
): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd);
  if (!dm) return null;
  const tm = /^(\d{2}):(\d{2})$/.exec(timeHm || "12:00");
  if (!tm) return null;
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const [h, mi] = [Number(tm[1]), Number(tm[2])];
  const naive = Date.UTC(y, mo - 1, d, h, mi, 0);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(naive));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  let tzHour = get("hour");
  if (tzHour === 24) tzHour = 0;
  const tzMoment = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    tzHour,
    get("minute"),
    get("second"),
  );
  return new Date(naive - (tzMoment - naive));
}

function asKind(v: FormDataEntryValue | null): Kind {
  const s = String(v ?? "");
  return (KINDS as readonly string[]).includes(s) ? (s as Kind) : "league";
}

function asHomeAway(v: FormDataEntryValue | null): HomeAway | null {
  const s = String(v ?? "");
  return (HOME_AWAY as readonly string[]).includes(s) ? (s as HomeAway) : null;
}

function trimOrNull(v: FormDataEntryValue | null, max = 200): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
}

/** Crée un match saisi à la main (source = 'manual'). */
export async function createManualMatchAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const startsAt = zurichLocalToUtc(date, time);
  if (!startsAt) return { error: "invalid_date" };

  const opponent = trimOrNull(formData.get("opponent"));
  const homeAway = asHomeAway(formData.get("home_away"));
  const kind = asKind(formData.get("kind"));
  // Le summary affiché dérive de l'adversaire si non fourni.
  const summary =
    trimOrNull(formData.get("summary"), 500) ??
    (opponent ? opponent : null);

  const { error } = await access.supabase.from("team_matches").insert({
    team_id: teamId,
    club_id: access.clubId,
    ics_uid: `manual-${crypto.randomUUID()}`,
    starts_at: startsAt.toISOString(),
    summary,
    location: trimOrNull(formData.get("location"), 500),
    kind,
    home_away: homeAway,
    opponent,
    competition: trimOrNull(formData.get("competition")),
    // « Structurant » dérivé du type (compétition) — plus de saisie manuelle.
    is_anchor: isStructuringKind(kind),
    source: "manual",
  });
  if (error) return { error: "db_error" };

  revalidatePath(`/[locale]/planner/${teamId}`, "page");
  return { ok: true };
}

/**
 * Met à jour un match. Les matchs ICS (source ≠ 'manual') restent la vérité du
 * flux : seul le type reste modifiable ici (et détermine automatiquement si le
 * match structure la saison). Les matchs manuels sont entièrement éditables.
 */
export async function updateMatchAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  if (!matchId) return { error: "invalid_input" };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { data: match } = await access.supabase
    .from("team_matches")
    .select("id, source")
    .eq("id", matchId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!match) return { error: "match_not_found" };

  const kind = asKind(formData.get("kind"));
  const patch: Record<string, unknown> = {
    kind,
    home_away: asHomeAway(formData.get("home_away")),
    // « Structurant » dérivé du type (compétition) — plus de saisie manuelle.
    is_anchor: isStructuringKind(kind),
  };

  if (match.source === "manual") {
    const date = String(formData.get("date") ?? "");
    const time = String(formData.get("time") ?? "");
    if (date) {
      const startsAt = zurichLocalToUtc(date, time);
      if (!startsAt) return { error: "invalid_date" };
      patch.starts_at = startsAt.toISOString();
    }
    const opponent = trimOrNull(formData.get("opponent"));
    patch.opponent = opponent;
    patch.competition = trimOrNull(formData.get("competition"));
    patch.location = trimOrNull(formData.get("location"), 500);
    patch.summary = trimOrNull(formData.get("summary"), 500) ?? opponent;
  }

  const { error } = await access.supabase
    .from("team_matches")
    .update(patch)
    .eq("id", matchId)
    .eq("team_id", teamId);
  if (error) return { error: "db_error" };

  revalidatePath(`/[locale]/planner/${teamId}`, "page");
  return { ok: true };
}

/** Supprime un match manuel. Les matchs ICS reviennent à la synchro → non supprimables ici. */
export async function deleteMatchAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  if (!matchId) return { error: "invalid_input" };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { data: match } = await access.supabase
    .from("team_matches")
    .select("id, source, archived")
    .eq("id", matchId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!match) return { error: "match_not_found" };
  // Suppressible si saisi à la main OU déjà archivé (détaché de l'ICS : la
  // synchro l'ignore, il ne reviendra pas). Un match ICS actif reste la
  // vérité du flux → non supprimable ici.
  if (match.source !== "manual" && !match.archived) return { error: "not_manual" };

  const { error } = await access.supabase
    .from("team_matches")
    .delete()
    .eq("id", matchId)
    .eq("team_id", teamId);
  if (error) return { error: "db_error" };

  revalidatePath(`/[locale]/planner/${teamId}`, "page");
  return { ok: true };
}

/** Supprime des matchs importés hors cadre après confirmation utilisateur. */
export async function deleteImportedMatchesAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const rawIds = String(formData.get("matchIds") ?? "[]");
  let matchIds: string[];
  try {
    const parsed = JSON.parse(rawIds);
    matchIds = Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return { error: "invalid_input" };
  }
  if (matchIds.length === 0) return { ok: true, deleted: 0 };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { error, count } = await access.supabase
    .from("team_matches")
    .delete({ count: "exact" })
    .eq("team_id", teamId)
    .in("id", matchIds)
    .neq("source", "manual");
  if (error) return { error: "db_error" };

  revalidatePath(`/[locale]/planner/${teamId}`, "page");
  return { ok: true, deleted: count ?? 0 };
}

/**
 * Enregistre le résultat d'un match : score domicile/extérieur + note. Valable
 * pour tout match (ICS ou manuel, actif ou archivé). Le score étant objectif
 * (domicile/extérieur), le sens V/N/D se dérive de `home_away` à l'affichage.
 */
export async function setMatchResultAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  if (!matchId) return { error: "invalid_input" };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { data: match } = await access.supabase
    .from("team_matches")
    .select("id")
    .eq("id", matchId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!match) return { error: "match_not_found" };

  const parseScore = (v: FormDataEntryValue | null): number | null => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isInteger(n) || n < 0 || n > 99) return null;
    return n;
  };

  const rawHome = String(formData.get("home_score") ?? "").trim();
  const rawAway = String(formData.get("away_score") ?? "").trim();
  const homeScore = parseScore(formData.get("home_score"));
  const awayScore = parseScore(formData.get("away_score"));
  // Un champ rempli mais invalide (non entier 0-99) = erreur explicite.
  if ((rawHome && homeScore === null) || (rawAway && awayScore === null)) {
    return { error: "invalid_input" };
  }

  const { error } = await access.supabase
    .from("team_matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      result_note: trimOrNull(formData.get("result_note"), 2000),
    })
    .eq("id", matchId)
    .eq("team_id", teamId);
  if (error) return { error: "db_error" };

  revalidatePath(`/[locale]/planner/${teamId}`, "page");
  revalidatePath(`/[locale]/planner/${teamId}/match/${matchId}`, "page");
  return { ok: true };
}

const PARTICIPATION_STATUS = [
  "starter",
  "substitute",
  "unused",
  "unavailable",
] as const;
type ParticipationStatus = (typeof PARTICIPATION_STATUS)[number];

type ParticipationInput = {
  playerId: string;
  status: ParticipationStatus;
  minutes: number | null;
  goals: number;
  assists: number;
  yellowCards: number;
  redCard: boolean;
};

/** Borne un entier optionnel dans [min,max] ; null si vide/invalide. */
function clampIntOrNull(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

/**
 * Enregistre la feuille de match : la liste complète des participations
 * (titulaire / remplaçant / non utilisé / indisponible) + stats par joueur.
 * Remplace l'état existant — les joueurs absents de la liste sont retirés.
 */
export async function setMatchParticipationsAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  if (!matchId) return { error: "invalid_input" };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { data: match } = await access.supabase
    .from("team_matches")
    .select("id")
    .eq("id", matchId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!match) return { error: "match_not_found" };

  // Effectif autorisé : joueurs réellement affectés à l'équipe (toutes saisons
  // confondues — la feuille porte sur un match précis). Garde-fou anti-injection
  // de player_id arbitraires.
  const { data: assignmentRows } = await access.supabase
    .from("player_team_assignments")
    .select("player_id")
    .eq("team_id", teamId);
  const allowed = new Set(
    (assignmentRows ?? []).map((r) => r.player_id as string),
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("participations") ?? "[]"));
  } catch {
    return { error: "invalid_input" };
  }
  if (!Array.isArray(parsed)) return { error: "invalid_input" };

  const seen = new Set<string>();
  const rows: ParticipationInput[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const playerId = String(r.playerId ?? "");
    if (!allowed.has(playerId) || seen.has(playerId)) continue;
    const status = String(r.status ?? "");
    if (!(PARTICIPATION_STATUS as readonly string[]).includes(status)) continue;
    seen.add(playerId);
    rows.push({
      playerId,
      status: status as ParticipationStatus,
      minutes: clampIntOrNull(r.minutes, 0, 200),
      goals: clampIntOrNull(r.goals, 0, 50) ?? 0,
      assists: clampIntOrNull(r.assists, 0, 50) ?? 0,
      yellowCards: clampIntOrNull(r.yellowCards, 0, 2) ?? 0,
      redCard: Boolean(r.redCard),
    });
  }

  // Retire les participations désélectionnées (joueurs hors de la liste).
  const keepIds = [...seen];
  let del = access.supabase
    .from("match_participations")
    .delete()
    .eq("match_id", matchId);
  if (keepIds.length > 0) {
    del = del.not("player_id", "in", `(${keepIds.join(",")})`);
  }
  const { error: delError } = await del;
  if (delError) return { error: "db_error" };

  if (rows.length > 0) {
    const { error: upError } = await access.supabase
      .from("match_participations")
      .upsert(
        rows.map((r) => ({
          match_id: matchId,
          player_id: r.playerId,
          club_id: access.clubId,
          status: r.status,
          minutes: r.minutes,
          goals: r.goals,
          assists: r.assists,
          yellow_cards: r.yellowCards,
          red_card: r.redCard,
        })),
        { onConflict: "match_id,player_id" },
      );
    if (upError) return { error: "db_error" };
  }

  revalidatePath(`/[locale]/planner/${teamId}/match/${matchId}`, "page");
  return { ok: true };
}

/** Charge l'ensemble des player_id réellement affectés à l'équipe (garde-fou). */
async function loadAllowedPlayers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teamId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("player_team_assignments")
    .select("player_id")
    .eq("team_id", teamId);
  return new Set((data ?? []).map((r) => r.player_id as string));
}

const SQUAD_STATUS = ["starter", "substitute", "unused", "unavailable"] as const;

/**
 * Enregistre l'onglet « Avant-match » : formation + consignes tactiques + la
 * compo visuelle (statut + position terrain par joueur convoqué). Le placement
 * sur le terrain implique la convocation (called_up = true).
 */
export async function setMatchFormationAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  if (!matchId) return { error: "invalid_input" };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { data: match } = await access.supabase
    .from("team_matches")
    .select("id")
    .eq("id", matchId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!match) return { error: "match_not_found" };

  const formation = trimOrNull(formData.get("formation"), 20);

  // Consignes tactiques : champs texte libres bornés, rétrocompatibles avec
  // l'ancien format (general / transition).
  const tactics: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(formData.get("tactics") ?? "{}"));
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      for (const key of [
        "coaches",
        "matchContext",
        "structures",
        "objective",
        "general",
        "possession",
        "defense",
        "loss",
        "regain",
        "transition",
      ]) {
        const v = obj[key];
        if (typeof v === "string" && v.trim()) {
          tactics[key] = v.slice(0, 2000);
        }
      }
      if (tactics.objective && !tactics.general) tactics.general = tactics.objective;
      if (tactics.loss && !tactics.transition) tactics.transition = tactics.loss;
      const rawBoards = obj.boards as Record<string, unknown> | undefined;
      tactics.boards = {
        possession: parseBoard(rawBoards?.possession),
        defense: parseBoard(rawBoards?.defense),
        loss: parseBoard(rawBoards?.loss),
        regain: parseBoard(rawBoards?.regain),
      };
    }
  } catch {
    return { error: "invalid_input" };
  }

  const { error: matchError } = await access.supabase
    .from("team_matches")
    .update({ formation, tactics })
    .eq("id", matchId)
    .eq("team_id", teamId);
  if (matchError) return { error: "db_error" };

  // Compo : statut + position par joueur convoqué.
  const allowed = await loadAllowedPlayers(access.supabase, teamId);
  let squad: unknown;
  try {
    squad = JSON.parse(String(formData.get("squad") ?? "[]"));
  } catch {
    return { error: "invalid_input" };
  }
  if (!Array.isArray(squad)) return { error: "invalid_input" };

  const seen = new Set<string>();
  const rows = [];
  for (const raw of squad) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const playerId = String(r.playerId ?? "");
    if (!allowed.has(playerId) || seen.has(playerId)) continue;
    const status = String(r.status ?? "");
    if (!(SQUAD_STATUS as readonly string[]).includes(status)) continue;
    seen.add(playerId);
    const isStarter = status === "starter";
    rows.push({
      match_id: matchId,
      player_id: playerId,
      club_id: access.clubId,
      status,
      called_up: true,
      pitch_x: isStarter ? clampIntOrNull(r.pitchX, 0, 100) : null,
      pitch_y: isStarter ? clampIntOrNull(r.pitchY, 0, 100) : null,
      slot_role:
        isStarter && typeof r.slotRole === "string"
          ? r.slotRole.slice(0, 20)
          : null,
    });
  }

  if (rows.length > 0) {
    const { error: upError } = await access.supabase
      .from("match_participations")
      .upsert(rows, { onConflict: "match_id,player_id" });
    if (upError) return { error: "db_error" };
  }

  // Convocation = compo : tout joueur hors squad repasse non convoqué (et sa
  // réponse/position sont effacées). C'est ce qui matérialise les « non convoqués ».
  const keepIds = [...seen];
  let reset = access.supabase
    .from("match_participations")
    .update({
      called_up: false,
      availability: null,
      availability_reason: null,
      availability_at: null,
      status: "unused",
      pitch_x: null,
      pitch_y: null,
      slot_role: null,
    })
    .eq("match_id", matchId);
  if (keepIds.length > 0) {
    reset = reset.not("player_id", "in", `(${keepIds.join(",")})`);
  }
  const { error: resetError } = await reset;
  if (resetError) return { error: "db_error" };

  revalidatePath(`/[locale]/planner/${teamId}/match/${matchId}`, "page");
  return { ok: true };
}

/**
 * Convocation : la liste des joueurs convoqués par le coach. Les joueurs retirés
 * de la liste repassent `called_up=false` (et leur réponse/position sont effacées).
 */
export async function setMatchCallupAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  if (!matchId) return { error: "invalid_input" };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { data: match } = await access.supabase
    .from("team_matches")
    .select("id")
    .eq("id", matchId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!match) return { error: "match_not_found" };

  const allowed = await loadAllowedPlayers(access.supabase, teamId);
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("callups") ?? "[]"));
  } catch {
    return { error: "invalid_input" };
  }
  if (!Array.isArray(parsed)) return { error: "invalid_input" };

  const callups = [
    ...new Set(
      parsed
        .map((v) => String(v))
        .filter((id) => allowed.has(id)),
    ),
  ];

  // Convoqués → upsert called_up=true.
  if (callups.length > 0) {
    const { error: upError } = await access.supabase
      .from("match_participations")
      .upsert(
        callups.map((playerId) => ({
          match_id: matchId,
          player_id: playerId,
          club_id: access.clubId,
          called_up: true,
        })),
        { onConflict: "match_id,player_id" },
      );
    if (upError) return { error: "db_error" };
  }

  // Non-convoqués (anciennement convoqués) → called_up=false + reset réponse/position.
  let reset = access.supabase
    .from("match_participations")
    .update({
      called_up: false,
      availability: null,
      availability_reason: null,
      availability_at: null,
      pitch_x: null,
      pitch_y: null,
      slot_role: null,
    })
    .eq("match_id", matchId);
  if (callups.length > 0) {
    reset = reset.not("player_id", "in", `(${callups.join(",")})`);
  }
  const { error: resetError } = await reset;
  if (resetError) return { error: "db_error" };

  revalidatePath(`/[locale]/planner/${teamId}/match/${matchId}`, "page");
  return { ok: true };
}

/**
 * Envoie (ou annule l'envoi de) la convocation aux joueurs. Tant que
 * `convocation_sent_at` est NULL, les joueurs ne voient pas le match dans leur
 * agenda (player_match_callups filtre dessus) et ne peuvent pas y répondre.
 * C'est ce qui rend l'envoi explicite plutôt qu'automatique à l'enregistrement
 * de la compo : le coach construit la compo librement, puis décide d'envoyer.
 */
export async function setMatchConvocationSentAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  if (!matchId) return { error: "invalid_input" };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { data: match } = await access.supabase
    .from("team_matches")
    .select("id")
    .eq("id", matchId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!match) return { error: "match_not_found" };

  const send = String(formData.get("send") ?? "") === "true";

  const { error } = await access.supabase
    .from("team_matches")
    .update({ convocation_sent_at: send ? new Date().toISOString() : null })
    .eq("id", matchId)
    .eq("team_id", teamId);
  if (error) return { error: "db_error" };

  // Notification Hub : à l'envoi, on prévient chaque joueur convoqué disposant
  // d'un compte lié (idempotent par match/joueur). L'échec d'émission ne doit
  // pas faire échouer l'envoi de la convocation lui-même.
  if (send) {
    const { error: notifyError } = await access.supabase.rpc(
      "emit_match_convocation_notifications",
      { p_match_id: matchId },
    );
    if (notifyError) {
      console.error("emit_match_convocation_notifications", notifyError);
    }
  }

  revalidatePath(`/[locale]/planner/${teamId}/match/${matchId}`, "page");
  return { ok: true };
}

const EVENT_TYPES = [
  "goal",
  "own_goal",
  "yellow",
  "red",
  "substitution",
  "note",
] as const;

/**
 * Enregistre la timeline « Résultat » : remplace l'ensemble des événements du
 * match. Buteurs / passeurs / changements s'en dérivent à l'affichage.
 */
export async function setMatchEventsAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  if (!matchId) return { error: "invalid_input" };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { data: match } = await access.supabase
    .from("team_matches")
    .select("id")
    .eq("id", matchId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!match) return { error: "match_not_found" };

  const allowed = await loadAllowedPlayers(access.supabase, teamId);
  const asPlayer = (v: unknown): string | null => {
    const s = String(v ?? "");
    return allowed.has(s) ? s : null;
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("events") ?? "[]"));
  } catch {
    return { error: "invalid_input" };
  }
  if (!Array.isArray(parsed)) return { error: "invalid_input" };

  const rows = [];
  let order = 0;
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const type = String(r.type ?? "");
    if (!(EVENT_TYPES as readonly string[]).includes(type)) continue;
    rows.push({
      match_id: matchId,
      club_id: access.clubId,
      type,
      minute: clampIntOrNull(r.minute, 0, 130),
      player_id: asPlayer(r.playerId),
      related_player_id: asPlayer(r.relatedPlayerId),
      is_penalty: Boolean(r.isPenalty),
      note:
        typeof r.note === "string" && r.note.trim()
          ? r.note.slice(0, 500)
          : null,
      sort_order: order++,
    });
  }

  // Remplacement complet : on efface puis on réinsère.
  const { error: delError } = await access.supabase
    .from("match_events")
    .delete()
    .eq("match_id", matchId);
  if (delError) return { error: "db_error" };

  if (rows.length > 0) {
    const { error: insError } = await access.supabase
      .from("match_events")
      .insert(rows);
    if (insError) return { error: "db_error" };
  }

  revalidatePath(`/[locale]/planner/${teamId}/match/${matchId}`, "page");
  return { ok: true };
}

/**
 * Enregistre les phases arrêtées retenues pour un match. Les ids sont bornés aux
 * phases des systèmes de l'équipe (garde-fou anti-injection).
 */
export async function setMatchPhasesAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  if (!matchId) return { error: "invalid_input" };

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { data: match } = await access.supabase
    .from("team_matches")
    .select("id")
    .eq("id", matchId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!match) return { error: "match_not_found" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("phaseIds") ?? "[]"));
  } catch {
    return { error: "invalid_input" };
  }
  if (!Array.isArray(parsed)) return { error: "invalid_input" };

  const { data: systems } = await access.supabase
    .from("team_tactical_systems")
    .select("id")
    .eq("team_id", teamId);
  const sysIds = (systems ?? []).map((s) => s.id as string);
  let allowed = new Set<string>();
  if (sysIds.length > 0) {
    const { data: phases } = await access.supabase
      .from("team_tactical_phases")
      .select("id")
      .in("system_id", sysIds);
    allowed = new Set((phases ?? []).map((p) => p.id as string));
  }
  const selected = [
    ...new Set(parsed.map((v) => String(v)).filter((id) => allowed.has(id))),
  ];

  const { error } = await access.supabase
    .from("team_matches")
    .update({ selected_phase_ids: selected })
    .eq("id", matchId)
    .eq("team_id", teamId);
  if (error) return { error: "db_error" };

  revalidatePath(`/[locale]/planner/${teamId}/match/${matchId}`, "page");
  return { ok: true };
}

/** Crée/MAJ la config de rythme de périodisation de l'équipe. */
export async function setPeriodizationSettingsAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const weekdays = formData
    .getAll("training_weekdays")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  const uniqueSorted = [...new Set(weekdays)].sort((a, b) => a - b);
  if (uniqueSorted.length === 0) return { error: "invalid_input" };

  const schemeRaw = String(formData.get("md_scheme") ?? "standard");
  const md_scheme: Scheme = (SCHEMES as readonly string[]).includes(schemeRaw)
    ? (schemeRaw as Scheme)
    : "standard";

  // Périodisation scopée par saison (PK = team_id + season). Fallback saison
  // active si le formulaire n'a pas fourni de millésime valide.
  const seasonRaw = String(formData.get("season") ?? "");
  const season = /^\d{4}\/\d{2}$/.test(seasonRaw)
    ? seasonRaw
    : await resolveCurrentSeasonLabel();

  const { error } = await access.supabase
    .from("team_periodization_settings")
    .upsert(
      {
        team_id: teamId,
        club_id: access.clubId,
        season,
        training_weekdays: uniqueSorted,
        md_scheme,
      },
      { onConflict: "team_id,season" },
    );
  if (error) return { error: "db_error" };

  revalidatePath(`/[locale]/planner/${teamId}`, "page");
  return { ok: true };
}
