import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PreparationSheet } from "@/components/sheet/PreparationSheet";
import type { LibraryExercise } from "@/components/sheet/ExerciseLibraryPicker";
import { mergePreparation, type PreparationData } from "@/components/sheet/types";
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
        .select("id, date, theme, team_id, teams(name)")
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
          "id, code, titre, name, theme, niveau, track, level, duree, description, organisation, forme_physique, tactique, mentalite, technique, variation_less_text, variation_more_text, main_image",
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

  return (
    <PreparationSheet
      teamId={teamId}
      sessionId={sessionId}
      initial={initial}
      libraryExercises={(library ?? []) as LibraryExercise[]}
    />
  );
}
