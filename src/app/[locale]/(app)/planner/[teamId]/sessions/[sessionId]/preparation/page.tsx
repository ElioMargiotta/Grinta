import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PreparationSheet } from "@/components/sheet/PreparationSheet";
import type { LibraryExercise } from "@/components/sheet/ExerciseLibraryPicker";
import { mergePreparation, type PreparationData } from "@/components/sheet/types";
import { resolveMicrocycleId } from "@/app/[locale]/(app)/planner/actions";
import { requireUser } from "@/lib/auth/getUser";

export default async function PreparationPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string; sessionId: string }>;
}) {
  const { locale, teamId, sessionId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);

  const [{ data: session }, { data: prep }, { data: team }, { data: library }] =
    await Promise.all([
      supabase
        .from("sessions")
        .select(
          "id, date, theme, start_time, duration_minutes, team_id, microcycle_id, teams(name), microcycles(theme)",
        )
        .eq("id", sessionId)
        .single(),
      supabase
        .from("session_preparations")
        .select("data")
        .eq("session_id", sessionId)
        .maybeSingle(),
      supabase.from("teams").select("id, name").eq("id", teamId).single(),
      supabase
        .from("exercises")
        .select(
          "id, code, source, titre, name, theme, niveau, track, level, duree, description, organisation, forme_physique, tactique, mentalite, technique, variation_less_text, variation_more_text, main_image",
        )
        .not("code", "is", null)
        .order("theme", { ascending: true, nullsFirst: false })
        .order("track", { ascending: true, nullsFirst: false })
        .order("level", { ascending: true, nullsFirst: false }),
    ]);

  if (!session || !team) notFound();

  const initial = mergePreparation(
    prep?.data as Partial<PreparationData> | null,
  );

  // Pre-fill from session metadata if the sheet is empty.
  if (!initial.date && session.date) initial.date = session.date;
  if (!initial.team) initial.team = team.name;

  const microRel = (
    session as unknown as {
      microcycles?:
        | { theme: string | null }
        | { theme: string | null }[]
        | null;
    }
  ).microcycles;
  const microRow = Array.isArray(microRel) ? microRel[0] : microRel;
  let weekTheme = microRow?.theme ?? null;

  // Backfill microcycle_id + theme for legacy sessions without a join.
  if (!microRow && session.date) {
    const resolvedId = await resolveMicrocycleId(
      supabase,
      teamId,
      session.date as string,
    );
    if (resolvedId) {
      await supabase
        .from("sessions")
        .update({ microcycle_id: resolvedId })
        .eq("id", sessionId);
      const { data: micro } = await supabase
        .from("microcycles")
        .select("theme")
        .eq("id", resolvedId)
        .single();
      weekTheme = (micro?.theme as string | null) ?? null;
    }
  }

  return (
    <PreparationSheet
      teamId={teamId}
      sessionId={sessionId}
      initial={initial}
      libraryExercises={(library ?? []) as LibraryExercise[]}
      sessionMeta={{
        title: session.theme ?? "",
        startTime: (session.start_time as string | null)?.slice(0, 5) ?? "",
        durationMinutes: session.duration_minutes ?? null,
      }}
      weekTheme={weekTheme}
    />
  );
}
