import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";
import { DeleteExerciseButton } from "@/components/exercises/DeleteExerciseButton";
import { requireUser } from "@/lib/auth/getUser";

export default async function ExerciseEditPage({
  params,
}: {
  params: Promise<{ locale: string; exerciseId: string }>;
}) {
  const { locale, exerciseId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("exercises");

  const { data: exercise } = await supabase
    .from("exercises")
    .select("id, name, description, category, duration_minutes, intensity, equipment")
    .eq("id", exerciseId)
    .single();
  if (!exercise) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <DeleteExerciseButton id={exercise.id} />
      </div>
      <Card>
        <ExerciseForm initial={exercise} />
      </Card>
    </div>
  );
}
