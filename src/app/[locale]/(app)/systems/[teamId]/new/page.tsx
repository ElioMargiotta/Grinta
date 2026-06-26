import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SystemEditor } from "@/components/planner/SystemEditor";
import type { LineupValue } from "@/components/planner/LineupBoard";
import {
  DEFAULT_FORMATION,
  FORMATIONS,
} from "@/components/planner/match/formations";
import { requireMembership } from "@/lib/auth/getUser";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";
import { loadTeamRoster } from "@/lib/planner/teamRoster";

export default async function NewSystemPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  setRequestLocale(locale);
  const { supabase, membership } = await requireMembership(locale);

  const { data: team } = await supabase
    .from("teams")
    .select("id, club_id")
    .eq("id", teamId)
    .single();
  if (!team || team.club_id !== membership.club_id) notFound();

  const season = await resolveCurrentSeasonLabel();
  const roster = await loadTeamRoster(supabase, teamId, season);

  const slotCount = (FORMATIONS[DEFAULT_FORMATION] ?? []).length || 11;
  const initialLineup: LineupValue = {
    formation: DEFAULT_FORMATION,
    slots: Array(slotCount).fill(null),
    coords: {},
    subs: [],
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <SystemEditor
        teamId={teamId}
        roster={roster}
        systemId={null}
        initialName=""
        initialLineup={initialLineup}
        initialTactics={{
          coaches: "",
          matchContext: "",
          structures: "",
          boards: {
            possession: { tokens: [], arrows: [] },
            defense: { tokens: [], arrows: [] },
            loss: { tokens: [], arrows: [] },
            regain: { tokens: [], arrows: [] },
          },
          objective: "",
          general: "",
          possession: "",
          defense: "",
          loss: "",
          regain: "",
          transition: "",
        }}
        initialPhases={[]}
        clubLogoUrl={membership.logo_url}
      />
    </div>
  );
}
