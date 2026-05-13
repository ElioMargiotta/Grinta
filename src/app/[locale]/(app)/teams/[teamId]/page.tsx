import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";
import { TeamEditForm } from "@/components/teams/TeamEditForm";
import { DeleteTeamSection } from "@/components/teams/DeleteTeamSection";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, season, age_group, description")
    .eq("id", teamId)
    .single();

  if (!team) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {team.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {[team.age_group, team.season].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href={`/teams/${team.id}/players`}>
          <Card className="flex items-center gap-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <Users className="h-5 w-5 text-zinc-500" />
            <span className="text-sm font-medium">{t("teams.players.title")}</span>
          </Card>
        </Link>
        <Link href={`/planner/${team.id}`}>
          <Card className="flex items-center gap-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <CalendarDays className="h-5 w-5 text-zinc-500" />
            <span className="text-sm font-medium">{t("planner.title")}</span>
          </Card>
        </Link>
      </div>

      <Card>
        <div className="mb-4">
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Modifier l&apos;équipe
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Renomme l&apos;équipe par défaut, ajoute saison, catégorie et
            description.
          </p>
        </div>
        <TeamEditForm team={team} />
      </Card>

      <div>
        <Link href={`/teams/${team.id}/players`}>
          <Button variant="secondary">{t("teams.players.new")}</Button>
        </Link>
      </div>

      <DeleteTeamSection teamId={team.id} teamName={team.name} />
    </div>
  );
}
