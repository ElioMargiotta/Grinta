import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { requirePersona } from "@/lib/auth/getUser";

type AssignmentRow = {
  team_id: string;
  season: string | null;
  teams: { id: string; name: string; club_id: string } | null;
};

export default async function PlayerTeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, persona } = await requirePersona(locale, "player");
  const t = await getTranslations("playerTeam");

  if (!persona.playerId) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
        </Card>
      </div>
    );
  }

  const { data } = await supabase
    .from("player_team_assignments")
    .select(`team_id, season, teams!inner(id, name, club_id)`)
    .eq("player_id", persona.playerId)
    .returns<AssignmentRow[]>();

  const assignments = (data ?? []).filter((a): a is AssignmentRow & { teams: NonNullable<AssignmentRow["teams"]> } => Boolean(a.teams));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {t("title")}
      </h1>

      {assignments.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {assignments.map((a) => (
            <Card key={`${a.team_id}-${a.season ?? "current"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {a.teams.name}
                  </div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    {a.season ?? t("currentSeason")}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
