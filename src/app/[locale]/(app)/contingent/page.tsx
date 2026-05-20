import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ContingentList,
  type ContingentPlayer,
} from "@/components/contingent/ContingentList";
import { AddPlayerMenu } from "@/components/contingent/AddPlayerMenu";
import { requireMembership } from "@/lib/auth/getUser";
import { listClubTeams } from "@/lib/contingent/teams";

type AssignmentRow = {
  team_id: string;
  teams: { name: string | null; age_group: string | null } | null;
};

type PlayerRow = {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  jersey_number: number | null;
  birth_date: string | null;
  dual_licence_club: string | null;
  player_team_assignments: AssignmentRow[] | null;
};

export default async function ContingentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { locale } = await params;
  const { team: initialTeamFilter } = await searchParams;
  setRequestLocale(locale);
  const { supabase, membership } = await requireMembership(locale);
  const t = await getTranslations("contingent");

  const [{ data }, teams] = await Promise.all([
    supabase
      .from("players")
      .select(
        `id, first_name, last_name, position, jersey_number, birth_date,
       dual_licence_club,
       player_team_assignments ( team_id, teams ( name, age_group ) )`,
      )
      .eq("club_id", membership.club_id)
      .order("last_name", { ascending: true })
      .returns<PlayerRow[]>(),
    listClubTeams(membership.club_id),
  ]);

  const players: ContingentPlayer[] = (data ?? []).map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    position: p.position,
    jersey_number: p.jersey_number,
    birth_date: p.birth_date,
    has_dual_licence: Boolean(p.dual_licence_club),
    assignments: (p.player_team_assignments ?? []).map((a) => ({
      team_id: a.team_id,
      team_name: a.teams?.name ?? null,
      age_group: a.teams?.age_group ?? null,
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("subtitle", { club: membership.club_name })}
          </p>
        </div>
        <AddPlayerMenu />
      </div>

      <ContingentList
        players={players}
        teams={teams}
        initialTeamFilter={
          initialTeamFilter && teams.some((tm) => tm.id === initialTeamFilter)
            ? initialTeamFilter
            : undefined
        }
      />
    </div>
  );
}
