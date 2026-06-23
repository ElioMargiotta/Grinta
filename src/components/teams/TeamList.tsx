import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export type TeamRow = {
  id: string;
  name: string;
  age_group: string | null;
};

/**
 * Liste d'équipes (style « onglet Équipes ») : une ligne par équipe avec barre
 * colorée, catégorie, effectif, badge « planifié » et chevron. Partagée entre
 * l'onglet Équipes (lien `/teams/{id}`) et l'onglet Planning (`/planner/{id}`)
 * pour un affichage identique — seul `basePath` change.
 */
export async function TeamList({
  teams,
  basePath,
  hrefSuffix = "",
  playersByTeam,
  plannedTeams,
}: {
  teams: TeamRow[];
  basePath: "/teams" | "/planner" | "/systems";
  /** Segment ajouté après l'id (ex. "/systems"). Défaut : aucun. */
  hrefSuffix?: string;
  playersByTeam: Map<string, number>;
  plannedTeams: Set<string>;
}) {
  const t = await getTranslations("teams");

  return (
    <div className="overflow-hidden border-y border-[var(--club-line)] bg-white/[0.72]">
      {teams.map((team) => (
        <Link
          key={team.id}
          href={`${basePath}/${team.id}${hrefSuffix}`}
          className="group grid gap-3 border-b border-zinc-100 px-4 py-4 transition last:border-b-0 hover:bg-[var(--club-primary-soft)] md:grid-cols-[1fr_180px_44px] md:items-center"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-9 w-1 rounded-full bg-[var(--club-primary)]" />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {team.name}
              </div>
              <div className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {team.age_group || t("unsetCategory")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-500 md:justify-end">
            <span>{t("playersCount", { n: playersByTeam.get(team.id) ?? 0 })}</span>
            {plannedTeams.has(team.id) ? (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {t("planned")}
              </span>
            ) : null}
          </div>
          <div className="hidden justify-end md:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition group-hover:bg-white group-hover:text-[var(--club-primary)]">
              <ChevronRight className="h-5 w-5" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
