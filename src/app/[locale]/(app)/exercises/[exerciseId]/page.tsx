import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";
import { ExerciseLibraryView } from "@/components/exercises/ExerciseLibraryView";
import { DeleteExerciseButton } from "@/components/exercises/DeleteExerciseButton";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; exerciseId: string }>;
}) {
  const { locale, exerciseId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("exercises.page");
  const { supabase } = await requireUser(locale);

  const { data: exercise } = await supabase
    .from("exercises")
    .select(
      "id, trainer_id, code, name, titre, theme, niveau, track, level, duree, organisation, description, duration_minutes, intensity, equipment, category, forme_physique, tactique, mentalite, technique, main_image, variation_less_text, variation_more_text",
    )
    .eq("id", exerciseId)
    .single();
  if (!exercise) notFound();

  const isLibrary = !!exercise.code;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <Link
          href="/exercises"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("backToLibrary")}
        </Link>
        {!isLibrary && <DeleteExerciseButton id={exercise.id} />}
      </div>

      {isLibrary ? (
        <ExerciseLibraryView ex={exercise} />
      ) : (
        <Card>
          <ExerciseForm
            initial={{
              id: exercise.id,
              name: exercise.name,
              description: exercise.description,
              category: exercise.category,
              duration_minutes: exercise.duration_minutes,
              intensity: exercise.intensity,
              equipment: exercise.equipment,
            }}
          />
        </Card>
      )}
    </div>
  );
}
