import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  SystemsManager,
  type SystemCard,
} from "@/components/planner/SystemsManager";
import { requireMembership } from "@/lib/auth/getUser";
import { parseLineup } from "@/lib/planner/tacticalSystems";
import { normalizeFormation } from "@/components/planner/match/formations";

export default async function TeamSystemsPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  setRequestLocale(locale);
  const { supabase, membership } = await requireMembership(locale);
  const t = await getTranslations("planner.systems");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, club_id")
    .eq("id", teamId)
    .single();
  if (!team || team.club_id !== membership.club_id) notFound();

  const { data: systemRows } = await supabase
    .from("team_tactical_systems")
    .select("id, name, formation, lineup")
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false });

  const systems = systemRows ?? [];
  const systemIds = systems.map((s) => s.id as string);

  const phaseCountById = new Map<string, number>();
  if (systemIds.length > 0) {
    const { data: phaseRows } = await supabase
      .from("team_tactical_phases")
      .select("system_id")
      .in("system_id", systemIds);
    for (const r of phaseRows ?? []) {
      const id = r.system_id as string;
      phaseCountById.set(id, (phaseCountById.get(id) ?? 0) + 1);
    }
  }

  const cards: SystemCard[] = systems.map((s) => {
    const lineup = parseLineup(s.lineup);
    const playerCount =
      lineup.slots.filter((x) => x !== null).length + lineup.subs.length;
    return {
      id: s.id as string,
      name: s.name as string,
      formation: normalizeFormation(s.formation as string | null),
      playerCount,
      phaseCount: phaseCountById.get(s.id as string) ?? 0,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {team.name}
        </p>
      </div>
      <SystemsManager teamId={teamId} systems={cards} />
    </div>
  );
}
