import { getTranslations, setRequestLocale } from "next-intl/server";
import { Section } from "@/components/ui/Section";
import { requirePersona } from "@/lib/auth/getUser";
import { getLinkedPlayers, resolveActivePlayer } from "@/lib/player/profiles";

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
  const activePlayer = await resolveActivePlayer(
    await getLinkedPlayers(),
    persona.activeProfile === "parent" ? "guardian" : "self",
  );

  if (!activePlayer) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <Section>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
        </Section>
      </div>
    );
  }

  const { data } = await supabase
    .from("player_team_assignments")
    .select(`team_id, season, teams!inner(id, name, club_id)`)
    .eq("player_id", activePlayer.playerId)
    .returns<AssignmentRow[]>();

  const assignments = (data ?? []).filter((a): a is AssignmentRow & { teams: NonNullable<AssignmentRow["teams"]> } => Boolean(a.teams));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {t("title")}
      </h1>

      {assignments.length === 0 ? (
        <Section>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
        </Section>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--club-line)] bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {assignments.map((a) => (
            <div
              key={`${a.team_id}-${a.season ?? "current"}`}
              className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-800"
            >
              <span className="h-9 w-1 rounded-full bg-[var(--club-primary)]" />
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {a.teams.name}
                </div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  {a.season ?? t("currentSeason")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
