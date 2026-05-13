import { setRequestLocale } from "next-intl/server";
import { PreparationSheet } from "@/components/sheet/PreparationSheet";
import type { LibraryExercise } from "@/components/sheet/ExerciseLibraryPicker";
import { mergePreparation, type PreparationData } from "@/components/sheet/types";
import { requireUser } from "@/lib/auth/getUser";

// Free-tier solo wizard. One session per user, team_id NULL.
// RLS (migration 0017): sessions row with team_id IS NULL AND trainer_id =
// auth.uid() is readable/writable by the owner only. Library exercises are
// the public seed (trainer_id NULL AND club_id NULL).
export default async function SoloWizardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireUser(locale);

  // Find or pre-create the user's solo session.
  const { data: existing } = await supabase
    .from("sessions")
    .select("id, date, theme, start_time, duration_minutes")
    .is("team_id", null)
    .eq("trainer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sessionId: string;
  let sessionRow: {
    id: string;
    date: string | null;
    theme: string | null;
    start_time: string | null;
    duration_minutes: number | null;
  };

  if (existing) {
    sessionId = existing.id;
    sessionRow = existing;
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const { data: inserted, error } = await supabase
      .from("sessions")
      .insert({
        team_id: null,
        trainer_id: user.id,
        date: today,
        start_time: null,
        duration_minutes: 90,
        theme: null,
        notes: null,
      })
      .select("id, date, theme, start_time, duration_minutes")
      .single();
    if (error || !inserted) {
      throw new Error(error?.message ?? "Impossible de créer la session.");
    }
    sessionId = inserted.id;
    sessionRow = inserted;
  }

  const [{ data: prep }, { data: library }] = await Promise.all([
    supabase
      .from("session_preparations")
      .select("data")
      .eq("session_id", sessionId)
      .maybeSingle(),
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

  const initial = mergePreparation(
    prep?.data as Partial<PreparationData> | null,
  );
  if (!initial.date && sessionRow.date) initial.date = sessionRow.date;

  return (
    <PreparationSheet
      teamId={null}
      sessionId={sessionId}
      initial={initial}
      libraryExercises={(library ?? []) as LibraryExercise[]}
      sessionMeta={{
        title: sessionRow.theme ?? "",
        startTime: (sessionRow.start_time ?? "")?.slice(0, 5) ?? "",
        durationMinutes: sessionRow.duration_minutes ?? null,
      }}
      weekTheme={null}
    />
  );
}
