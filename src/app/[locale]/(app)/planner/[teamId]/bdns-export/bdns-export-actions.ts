"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildBdnsCsv,
  latin1Base64,
  JS_ALLOWED_DURATIONS,
  type BdnsRow,
} from "@/lib/contingent/bdns-csv";

export type BdnsExportResult = {
  error?: string;
  filename?: string;
  /** base64 du CSV encodé windows-1252. */
  contentBase64?: string;
  count?: number;
  /** Personnes présentes exclues faute de N° J+S. */
  missing?: { name: string; fonction: "participant" | "moniteur" }[];
  /** Durées rencontrées hors valeurs J+S admises. */
  durationWarnings?: number[];
};

const TZ = "Europe/Zurich";

function zurichDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function zurichTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export async function generateBdnsCsvAction(formData: FormData): Promise<BdnsExportResult> {
  const locale = String(formData.get("locale") ?? "fr");
  const teamId = String(formData.get("teamId") ?? "");
  const start = String(formData.get("start") ?? "").trim();
  const end = String(formData.get("end") ?? "").trim();
  const includeTrainings = formData.get("includeTrainings") === "1";
  const includeMatches = formData.get("includeMatches") === "1";
  const fallbackLocation = String(formData.get("fallbackLocation") ?? "").trim();

  if (!teamId) return { error: "missing_team" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return { error: "invalid_range" };
  }
  if (end < start) return { error: "invalid_range" };
  if (!includeTrainings && !includeMatches) return { error: "no_activity" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { error: "team_not_found" };

  const rows: BdnsRow[] = [];
  const missing: NonNullable<BdnsExportResult["missing"]> = [];
  const durationsSeen = new Set<number>();

  // ---- Encadrement (n° J+S + nom), réutilisé entraînements ----------------
  const { data: staffRowsRaw } = await supabase.rpc("list_team_staff", { p_team_id: teamId });
  const staffRows = (staffRowsRaw ?? []) as {
    membership_id: string;
    full_name: string | null;
    js_number: string | null;
  }[];
  const staffById = new Map(
    staffRows.map((s) => [
      s.membership_id,
      { name: (s.full_name ?? "").trim(), js: (s.js_number ?? "").trim() },
    ]),
  );

  // ---- Entraînements -------------------------------------------------------
  if (includeTrainings) {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, date, start_time, duration_minutes, location")
      .eq("team_id", teamId)
      .eq("kind", "training")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true });
    const sessionList = sessions ?? [];
    const sessionIds = sessionList.map((s) => s.id as string);

    if (sessionIds.length > 0) {
      const [{ data: playerAtt }, { data: staffAtt }] = await Promise.all([
        supabase
          .from("session_attendances")
          .select("session_id, player_id")
          .in("session_id", sessionIds)
          .eq("actual_status", "present"),
        supabase
          .from("session_staff_attendances")
          .select("session_id, membership_id")
          .in("session_id", sessionIds)
          .eq("actual_status", "present"),
      ]);

      const presentPlayerIds = [
        ...new Set((playerAtt ?? []).map((a) => a.player_id as string)),
      ];
      const playerById = await loadPlayers(supabase, presentPlayerIds);

      const presentBySession = new Map<string, string[]>();
      for (const a of playerAtt ?? []) {
        const arr = presentBySession.get(a.session_id as string) ?? [];
        arr.push(a.player_id as string);
        presentBySession.set(a.session_id as string, arr);
      }
      const staffBySession = new Map<string, string[]>();
      for (const a of staffAtt ?? []) {
        const arr = staffBySession.get(a.session_id as string) ?? [];
        arr.push(a.membership_id as string);
        staffBySession.set(a.session_id as string, arr);
      }

      for (const s of sessionList) {
        const dateIso = s.date as string;
        const heure = ((s.start_time as string | null) ?? "").slice(0, 5);
        const duree = (s.duration_minutes as number | null) ?? null;
        const lieu = ((s.location as string | null) ?? "").trim() || fallbackLocation;
        if (duree != null) durationsSeen.add(duree);

        for (const pid of presentBySession.get(s.id as string) ?? []) {
          const p = playerById.get(pid);
          if (!p) continue;
          if (!p.js) {
            missing.push({ name: p.name, fonction: "participant" });
            continue;
          }
          rows.push({
            personalNumber: p.js,
            fonction: "Participant/e",
            dateIso,
            type: "Entraînement",
            heure,
            duree,
            lieu,
          });
        }

        for (const mid of staffBySession.get(s.id as string) ?? []) {
          const st = staffById.get(mid);
          if (!st) continue;
          if (!st.js) {
            missing.push({ name: st.name, fonction: "moniteur" });
            continue;
          }
          rows.push({
            personalNumber: st.js,
            fonction: "moniteur/trice",
            dateIso,
            type: "Entraînement",
            heure,
            duree,
            lieu,
          });
        }
      }
    }
  }

  // ---- Compétitions (matchs, hors `break`) --------------------------------
  if (includeMatches) {
    const { data: matches } = await supabase
      .from("team_matches")
      .select("id, starts_at, ends_at, location, kind")
      .eq("team_id", teamId)
      .neq("kind", "break")
      .gte("starts_at", `${start}T00:00:00.000Z`)
      .lte("starts_at", `${end}T23:59:59.999Z`)
      .order("starts_at", { ascending: true });
    const matchList = matches ?? [];
    const matchIds = matchList.map((m) => m.id as string);

    if (matchIds.length > 0) {
      const { data: parts } = await supabase
        .from("match_participations")
        .select("match_id, player_id, status")
        .in("match_id", matchIds)
        .neq("status", "unavailable");

      const presentPlayerIds = [
        ...new Set((parts ?? []).map((p) => p.player_id as string)),
      ];
      const playerById = await loadPlayers(supabase, presentPlayerIds);

      const presentByMatch = new Map<string, string[]>();
      for (const p of parts ?? []) {
        const arr = presentByMatch.get(p.match_id as string) ?? [];
        arr.push(p.player_id as string);
        presentByMatch.set(p.match_id as string, arr);
      }

      for (const m of matchList) {
        const startsAt = m.starts_at as string;
        const endsAt = m.ends_at as string | null;
        const dateIso = zurichDate(startsAt);
        const heure = zurichTime(startsAt);
        const duree = endsAt
          ? Math.max(
              0,
              Math.round(
                (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000,
              ),
            )
          : null;
        const lieu = ((m.location as string | null) ?? "").trim();
        if (duree != null) durationsSeen.add(duree);

        for (const pid of presentByMatch.get(m.id as string) ?? []) {
          const p = playerById.get(pid);
          if (!p) continue;
          if (!p.js) {
            missing.push({ name: p.name, fonction: "participant" });
            continue;
          }
          rows.push({
            personalNumber: p.js,
            fonction: "Participant/e",
            dateIso,
            type: "compétition",
            heure,
            duree,
            lieu,
          });
        }
      }
    }
  }

  // Tri déterministe : date, fonction, n°.
  rows.sort(
    (a, b) =>
      a.dateIso.localeCompare(b.dateIso) ||
      a.fonction.localeCompare(b.fonction) ||
      a.personalNumber.localeCompare(b.personalNumber),
  );

  const durationWarnings = [...durationsSeen]
    .filter((d) => !JS_ALLOWED_DURATIONS.includes(d))
    .sort((a, b) => a - b);

  // Dédupe les « manquants » par nom + fonction.
  const missingDedup = Array.from(
    new Map(missing.map((m) => [`${m.fonction}|${m.name}`, m])).values(),
  );

  const csv = buildBdnsCsv(rows);
  const safeName = (team.name as string).replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 40);
  const filename = `controle_des_presences_${safeName}_${start}_${end}.csv`;

  return {
    filename,
    contentBase64: latin1Base64(csv),
    count: rows.length,
    missing: missingDedup,
    durationWarnings,
  };
}

async function loadPlayers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Map<string, { name: string; js: string }>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from("players")
    .select("id, first_name, last_name, js_number")
    .in("id", ids);
  return new Map(
    (data ?? []).map((p) => [
      p.id as string,
      {
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        js: ((p.js_number as string | null) ?? "").trim(),
      },
    ]),
  );
}
