import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SystemEditor } from "@/components/planner/SystemEditor";
import type { LineupValue } from "@/components/planner/LineupBoard";
import {
  FORMATIONS,
  normalizeFormation,
} from "@/components/planner/match/formations";
import { requireMembership } from "@/lib/auth/getUser";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";
import { loadTeamRoster } from "@/lib/planner/teamRoster";
import {
  PHASE_KINDS,
  parseBoard,
  parseLineup,
  parseTactics,
  type PhaseKind,
} from "@/lib/planner/tacticalSystems";

type PhaseRow = {
  id: string;
  kind: string;
  name: string | null;
  board: unknown;
  sort_order: number;
};

export default async function EditSystemPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string; systemId: string }>;
}) {
  const { locale, teamId, systemId } = await params;
  setRequestLocale(locale);
  const { supabase, membership } = await requireMembership(locale);

  const { data: team } = await supabase
    .from("teams")
    .select("id, club_id")
    .eq("id", teamId)
    .single();
  if (!team || team.club_id !== membership.club_id) notFound();

  const { data: system } = await supabase
    .from("team_tactical_systems")
    .select("id, name, formation, lineup, tactics")
    .eq("id", systemId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!system) notFound();

  const { data: phaseRows } = await supabase
    .from("team_tactical_phases")
    .select("id, kind, name, board, sort_order")
    .eq("system_id", systemId)
    .order("sort_order", { ascending: true });

  const season = await resolveCurrentSeasonLabel();
  const roster = await loadTeamRoster(supabase, teamId, season);

  const formation = normalizeFormation(system.formation as string | null);
  const slotCount = (FORMATIONS[formation] ?? []).length || 11;
  const parsedLineup = parseLineup(system.lineup);
  const initialLineup: LineupValue = {
    formation,
    slots: Array.from({ length: slotCount }, (_, i) => parsedLineup.slots[i] ?? null),
    coords: parsedLineup.coords,
    subs: parsedLineup.subs,
  };

  const initialPhases = ((phaseRows ?? []) as PhaseRow[])
    .filter((p) => (PHASE_KINDS as readonly string[]).includes(p.kind))
    .map((p) => ({
      id: p.id,
      kind: p.kind as PhaseKind,
      name: p.name ?? "",
      board: parseBoard(p.board),
    }));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <SystemEditor
        teamId={teamId}
        roster={roster}
        systemId={systemId}
        initialName={system.name as string}
        initialLineup={initialLineup}
        initialTactics={parseTactics(system.tactics)}
        initialPhases={initialPhases}
        clubLogos={membership.logos}
      />
    </div>
  );
}
