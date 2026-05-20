import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft, FileUp, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";

type AssignmentRow = {
  player_id: string;
  players: {
    id: string;
    first_name: string;
    last_name: string;
    position: string | null;
    jersey_number: number | null;
    birth_date: string | null;
  } | null;
};

export default async function PlayersPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("teams.players");
  const tDetail = await getTranslations("teams.detail");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .single();
  if (!team) notFound();

  // Effectif courant via les affectations (#39). On laisse `season` à NULL
  // pour matcher l'usage du picker — les autres saisons ne sont pas montrées
  // sur cet écran tant qu'on n'a pas de sélecteur de saison dédié.
  const { data: rows } = await supabase
    .from("player_team_assignments")
    .select(
      `player_id,
       players ( id, first_name, last_name, position, jersey_number, birth_date )`,
    )
    .eq("team_id", teamId)
    .is("season", null)
    .returns<AssignmentRow[]>();

  const players = (rows ?? [])
    .map((r) => r.players)
    .filter((p): p is NonNullable<AssignmentRow["players"]> => Boolean(p))
    .sort((a, b) => {
      // Jersey nullsLast, puis nom.
      if (a.jersey_number == null && b.jersey_number != null) return 1;
      if (a.jersey_number != null && b.jersey_number == null) return -1;
      if (a.jersey_number != null && b.jersey_number != null) {
        if (a.jersey_number !== b.jersey_number)
          return a.jersey_number - b.jersey_number;
      }
      return a.last_name.localeCompare(b.last_name);
    });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <Link
          href={`/teams/${teamId}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" />
          {team.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {team.name} — {t("title")}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/contingent?team=${teamId}`}>
              <Button variant="secondary" size="sm">
                <Users className="h-4 w-4" />
                {tDetail("openContingent")}
              </Button>
            </Link>
            <Link href={`/contingent/import?teamId=${teamId}`}>
              <Button variant="secondary" size="sm">
                <FileUp className="h-4 w-4" />
                {tDetail("importClubCorner")}
              </Button>
            </Link>
            <Link href={`/contingent/new?teamId=${teamId}`}>
              <Button size="sm">
                <UserPlus className="h-4 w-4" />
                {t("new")}
              </Button>
            </Link>
          </div>
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {tDetail("playersInRoster", { count: players.length })}
        </p>
      </div>

      {players.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("empty")}
          </p>
        </Card>
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">{t("firstName")}</th>
                <th className="px-4 py-2">{t("lastName")}</th>
                <th className="px-4 py-2">{t("position")}</th>
                <th className="px-4 py-2">{t("birthDate")}</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-2 text-zinc-500">
                    {p.jersey_number ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/contingent/${p.id}`}
                      className="font-medium text-[var(--club-primary)] hover:underline"
                    >
                      {p.first_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/contingent/${p.id}`}
                      className="font-medium text-[var(--club-primary)] hover:underline"
                    >
                      {p.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {p.position ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {p.birth_date ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
