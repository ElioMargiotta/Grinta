import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";

const CATEGORIES = ["warmup", "technical", "tactical", "physical", "cooldown"] as const;

export default async function ExercisesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  const { category } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("exercises");

  let query = supabase
    .from("exercises")
    .select("id, name, description, category, duration_minutes, intensity")
    .order("created_at", { ascending: false });
  if (category) query = query.eq("category", category);

  const { data: exercises } = await query;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <Link href="/exercises/new">
          <Button>
            <Plus className="h-4 w-4" />
            {t("new")}
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/exercises"
          className={`rounded-full border px-3 py-1 text-sm ${
            !category
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {t("categoryAll")}
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={{ pathname: "/exercises", query: { category: c } }}
            className={`rounded-full border px-3 py-1 text-sm ${
              category === c
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {t(`categories.${c}`)}
          </Link>
        ))}
      </div>

      {!exercises || exercises.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exercises.map((ex) => (
            <Link key={ex.id} href={`/exercises/${ex.id}`}>
              <Card className="flex h-full flex-col gap-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {ex.name}
                  </div>
                  {ex.duration_minutes && (
                    <span className="text-xs text-zinc-500">
                      {ex.duration_minutes} min
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                  {ex.category && (
                    <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                      {t(`categories.${ex.category as (typeof CATEGORIES)[number]}`)}
                    </span>
                  )}
                  {ex.intensity && (
                    <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                      {t(`intensities.${ex.intensity as "low" | "medium" | "high"}`)}
                    </span>
                  )}
                </div>
                {ex.description && (
                  <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {ex.description}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
