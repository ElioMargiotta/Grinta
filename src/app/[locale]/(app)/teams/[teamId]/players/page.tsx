import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { PlayerForm } from "@/components/teams/PlayerForm";
import { requireUser } from "@/lib/auth/getUser";

export default async function PlayersPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("teams.players");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .single();
  if (!team) notFound();

  const { data: players } = await supabase
    .from("players")
    .select("id, first_name, last_name, position, jersey_number, birth_date")
    .eq("team_id", teamId)
    .order("jersey_number", { ascending: true, nullsFirst: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {team.name} — {t("title")}
        </h1>
      </div>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("new")}
        </h2>
        <PlayerForm teamId={teamId} />
      </Card>

      {!players || players.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
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
                <tr key={p.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-2 text-zinc-500">{p.jersey_number ?? "—"}</td>
                  <td className="px-4 py-2">{p.first_name}</td>
                  <td className="px-4 py-2">{p.last_name}</td>
                  <td className="px-4 py-2 text-zinc-500">{p.position ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-500">{p.birth_date ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
