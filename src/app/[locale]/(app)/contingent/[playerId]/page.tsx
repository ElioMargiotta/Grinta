import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { requireMembership } from "@/lib/auth/getUser";
import {
  ClubPlayerForm,
  type EditablePlayer,
} from "@/components/contingent/ClubPlayerForm";
import { DeletePlayerSection } from "@/components/contingent/DeletePlayerSection";
import { DualLicenceBlock } from "@/components/contingent/DualLicenceBlock";
import { TeamAssignmentsBlock } from "@/components/contingent/TeamAssignmentsBlock";
import {
  InvitePlayerSection,
  type PlayerInvitation,
} from "@/components/contingent/InvitePlayerSection";
import {
  EvaluationsSection,
  type EvaluationRow,
} from "@/components/evaluation/EvaluationsSection";
import {
  overallAverage,
  mergeEvaluation,
  type EvaluationData,
} from "@/components/evaluation/types";
import { listClubTeams } from "@/lib/contingent/teams";

export default async function ContingentPlayerPage({
  params,
}: {
  params: Promise<{ locale: string; playerId: string }>;
}) {
  const { locale, playerId } = await params;
  setRequestLocale(locale);
  const { supabase, membership } = await requireMembership(locale);
  const t = await getTranslations("contingent");

  const { data: player } = await supabase
    .from("players")
    .select(
      `id, first_name, last_name, birth_date, position, jersey_number, notes,
       strong_foot, license_number, js_number, email, phone, nationality,
       address, postal_code, city, canton, user_id,
       guardian_name, guardian_email, guardian_phone,
       guardian2_name, guardian2_email, guardian2_phone,
       dual_licence_club, dual_licence_level, dual_licence_team`,
    )
    .eq("id", playerId)
    .single<EditablePlayer & { user_id: string | null }>();

  if (!player) notFound();

  // Affectations actuelles (saison NULL = "courante"), pour pré-cocher le
  // picker du bloc dédié (#39).
  const [
    { data: assignments },
    teams,
    { data: inviteRows },
    { data: evalRows },
  ] = await Promise.all([
    supabase
      .from("player_team_assignments")
      .select("team_id")
      .eq("player_id", playerId)
      .is("season", null),
    listClubTeams(membership.club_id),
    supabase
      .from("club_invitations")
      .select("id, email, status, team_id, expires_at, email_status, email_sent_at")
      .eq("player_id", playerId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("player_evaluations")
      .select("id, season, evaluation_date, data, created_at")
      .eq("player_id", playerId)
      .order("evaluation_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);
  const currentTeamIds = (assignments ?? []).map((a) => a.team_id as string);

  const evaluations: EvaluationRow[] = (evalRows ?? []).map((row) => {
    const merged = mergeEvaluation(row.data as Partial<EvaluationData> | null);
    return {
      id: row.id as string,
      evaluation_date: (row.evaluation_date as string | null) ?? null,
      season: (row.season as string | null) ?? null,
      appreciation: merged.appreciation,
      average: overallAverage(merged.tips),
    };
  });

  const pendingInvitations: PlayerInvitation[] = (inviteRows ?? []).map((r) => ({
    id: r.id as string,
    email: r.email as string,
    status: r.status as PlayerInvitation["status"],
    team_id: (r.team_id as string | null) ?? null,
    expires_at: r.expires_at as string,
    email_status: (r.email_status as PlayerInvitation["email_status"]) ?? "pending",
    email_sent_at: (r.email_sent_at as string | null) ?? null,
  }));

  const fullName = `${player.first_name} ${player.last_name}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/contingent"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("title")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {fullName}
        </h1>
      </div>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("editTitle")}
        </h2>
        <ClubPlayerForm player={player} />
      </Card>

      <TeamAssignmentsBlock
        playerId={player.id}
        teams={teams}
        currentTeamIds={currentTeamIds}
      />

      <InvitePlayerSection
        locale={locale}
        playerId={player.id}
        defaultEmail={player.email ?? ""}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        pendingInvitations={pendingInvitations}
        isLinkedToUser={Boolean(player.user_id)}
      />

      <DualLicenceBlock
        playerId={player.id}
        licence={{
          club: player.dual_licence_club,
          level: player.dual_licence_level,
          team: player.dual_licence_team,
        }}
      />

      <EvaluationsSection
        playerId={player.id}
        locale={locale}
        evaluations={evaluations}
      />

      <DeletePlayerSection playerId={player.id} playerName={fullName} />
    </div>
  );
}
