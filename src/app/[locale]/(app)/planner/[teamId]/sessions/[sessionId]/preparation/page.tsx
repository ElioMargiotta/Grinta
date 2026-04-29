import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PreparationSheet } from "@/components/sheet/PreparationSheet";
import { mergePreparation, type PreparationData } from "@/components/sheet/types";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";

export default async function PreparationPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string; sessionId: string }>;
}) {
  const { locale, teamId, sessionId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);

  const [{ data: session }, { data: prep }, { data: team }] = await Promise.all([
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
  ]);

  if (!session || !team) notFound();

  const initial = mergePreparation(
    prep?.data as Partial<PreparationData> | null,
  );

  // Pre-fill from session metadata if the sheet is empty.
  if (!initial.date && session.date) initial.date = session.date;
  if (!initial.team) initial.team = team.name;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <Link
            href={`/planner/${teamId}/sessions/${sessionId}`}
            className="text-sm text-zinc-600 underline"
          >
            ← Back to session
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
            Training preparation
          </h1>
        </div>
      </div>
        <PreparationSheet
      teamId={teamId}
      sessionId={sessionId}
      initial={initial}
      />
    </div>
  );
}
