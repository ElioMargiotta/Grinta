import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SessionForm } from "@/components/planner/SessionForm";
import { SessionExercises } from "@/components/planner/SessionExercises";
import { DeleteSessionButton } from "@/components/planner/DeleteSessionButton";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string; sessionId: string }>;
}) {
  const { locale, teamId, sessionId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("planner.session");

  const [{ data: team }, { data: session }, { data: attached }, { data: library }] =
    await Promise.all([
      supabase.from("teams").select("id, name").eq("id", teamId).single(),
      supabase
        .from("sessions")
        .select("id, date, start_time, duration_minutes, theme, notes")
        .eq("id", sessionId)
        .single(),
      supabase
        .from("session_exercises")
        .select(
          "id, order_index, exercise:exercises(id, name, duration_minutes, category)",
        )
        .eq("session_id", sessionId),
      supabase.from("exercises").select("id, name").order("name"),
    ]);

  if (!team || !session) notFound();

  type AttachedRow = {
    id: string;
    order_index: number;
    exercise: {
      id: string;
      name: string;
      duration_minutes: number | null;
      category: string | null;
    };
  };

  const attachedNormalized = ((attached ?? []) as unknown as AttachedRow[]).filter(
    (row) => row.exercise,
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {team.name} — {t("editTitle")}
        </h1>
        <DeleteSessionButton id={session.id} teamId={teamId} />
      </div>

      <Link href={`/planner/${teamId}/sessions/${sessionId}/preparation`}>
        <Button variant="secondary" className="w-full justify-start">
          <ClipboardList className="h-4 w-4" />
          Open training preparation sheet
        </Button>
      </Link>

      <Card>
        <SessionForm teamId={teamId} initial={session} />
      </Card>

      <Card>
        <SessionExercises
          sessionId={session.id}
          teamId={teamId}
          attached={attachedNormalized}
          library={library ?? []}
        />
      </Card>
    </div>
  );
}
