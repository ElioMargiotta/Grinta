import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { SessionForm } from "@/components/planner/SessionForm";
import { requireUser } from "@/lib/auth/getUser";

export default async function NewSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; teamId: string }>;
  searchParams: Promise<{ date?: string; startTime?: string }>;
}) {
  const { locale, teamId } = await params;
  const { date, startTime } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("planner.session");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .single();
  if (!team) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {team.name} — {t("newTitle")}
      </h1>
      <Card>
        <SessionForm
          teamId={teamId}
          defaultDate={date}
          defaultStartTime={startTime}
        />
      </Card>
    </div>
  );
}
