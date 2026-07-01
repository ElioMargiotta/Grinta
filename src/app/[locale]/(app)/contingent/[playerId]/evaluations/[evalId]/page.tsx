import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { EvaluationSheet } from "@/components/evaluation/EvaluationSheet";
import {
  mergeEvaluation,
  type EvaluationData,
} from "@/components/evaluation/types";
import { requireMembership } from "@/lib/auth/getUser";

type EvaluationDbRow = {
  id: string;
  player_id: string;
  season: string | null;
  evaluation_date: string | null;
  data: Partial<EvaluationData> | null;
  shared_with_player?: boolean | null;
};

export default async function PlayerEvaluationPage({
  params,
}: {
  params: Promise<{ locale: string; playerId: string; evalId: string }>;
}) {
  const { locale, playerId, evalId } = await params;
  setRequestLocale(locale);
  const { supabase, membership } = await requireMembership(locale);

  const [
    { data: evaluationWithSharing, error: evaluationWithSharingError },
    { data: player },
  ] = await Promise.all([
    supabase
      .from("player_evaluations")
      .select("id, player_id, season, evaluation_date, data, shared_with_player")
      .eq("id", evalId)
      .eq("player_id", playerId)
      .maybeSingle<EvaluationDbRow>(),
    supabase
      .from("players")
      .select(
        "id, first_name, last_name, birth_date, position, team_id, teams(name)",
      )
      .eq("id", playerId)
      .single(),
  ]);

  let sharingAvailable = true;
  let evaluation = evaluationWithSharing;
  if (evaluationWithSharingError) {
    sharingAvailable = false;
    const { data: fallbackEvaluation } = await supabase
      .from("player_evaluations")
      .select("id, player_id, season, evaluation_date, data")
      .eq("id", evalId)
      .eq("player_id", playerId)
      .maybeSingle<EvaluationDbRow>();
    evaluation = fallbackEvaluation;
  }

  if (!evaluation || !player) notFound();

  const initial = mergeEvaluation(
    evaluation.data as Partial<EvaluationData> | null,
  );

  // Pre-fill identity fields from the player record the first time
  // the sheet is opened (no data saved yet). Editing later doesn't
  // overwrite the user's typed values.
  if (!initial.playerName) {
    initial.playerName = `${player.first_name} ${player.last_name}`.trim();
  }
  if (!initial.birthDate && player.birth_date) {
    initial.birthDate = player.birth_date as string;
  }
  if (!initial.position && player.position) {
    initial.position = player.position as string;
  }
  if (!initial.team) {
    const teamRel = (
      player as unknown as {
        teams?: { name: string | null } | { name: string | null }[] | null;
      }
    ).teams;
    const teamRow = Array.isArray(teamRel) ? teamRel[0] : teamRel;
    initial.team = teamRow?.name ?? "";
  }

  return (
    <EvaluationSheet
      playerId={playerId}
      evaluationId={evalId}
      locale={locale}
      initial={initial}
      backHref={`/${locale}/contingent/${playerId}`}
      teamLogos={membership.logos}
      sharedWithPlayer={Boolean(evaluation.shared_with_player)}
      sharingAvailable={sharingAvailable}
    />
  );
}
