import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarDays, Camera, ChevronRight, Shirt, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
    .select("id, name, season, age_group, description, photo_url")
    .eq("id", teamId)
    .single();

  if (!team) notFound();

  const { count: playerCount } = await supabase
    .from("players")
    .select("id", { head: true, count: "exact" })
    .eq("team_id", teamId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <section className="overflow-hidden border-y border-[var(--club-line)] bg-white/[0.78]">
        <div className="grid md:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-[260px] flex-col justify-between p-5 md:p-8">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--club-primary)]">
                <span>{team.age_group || "Catégorie à définir"}</span>
                <span className="h-1 w-1 rounded-full bg-zinc-300" />
                <span>{team.season || "Saison à définir"}</span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 md:text-5xl dark:text-zinc-100">
                {team.name}
              </h1>
              {team.description ? (
                <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {team.description}
                </p>
              ) : (
                <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Ajoute une courte description pour cadrer l&apos;identité,
                  les objectifs ou les notes importantes de cette équipe.
                </p>
              )}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <TeamMetric
                icon={Users}
                label={t("teams.players.title")}
                value={`${playerCount ?? 0}`}
              />
              <TeamMetric
                icon={Shirt}
                label="Catégorie"
                value={team.age_group || "—"}
              />
              <TeamMetric
                icon={CalendarDays}
                label="Saison"
                value={team.season || "—"}
              />
            </div>
          </div>

          <div className="relative min-h-[240px] border-t border-[var(--club-line)] bg-[var(--club-primary-soft)] md:border-l md:border-t-0">
            {team.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={team.photo_url}
                alt={team.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--club-primary)] text-[var(--club-primary-foreground)]">
                  <Camera className="h-7 w-7" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-900">
                    Photo d&apos;équipe
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Ajoute une URL dans les réglages ci-dessous.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <TeamAction
          href={`/teams/${team.id}/players`}
          icon={Users}
          title={t("teams.players.title")}
          description={`${playerCount ?? 0} joueur${(playerCount ?? 0) > 1 ? "s" : ""} dans l'effectif`}
        />
        <TeamAction
          href={`/planner/${team.id}`}
          icon={CalendarDays}
          title={t("planner.title")}
          description="Planification, cycles et séances"
        />
      </section>

      <section className="border-y border-[var(--club-line)] bg-white/[0.78] p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Informations équipe
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Nom, saison, catégorie, description et photo de référence.
            </p>
          </div>
          <Link href={`/teams/${team.id}/players`}>
            <Button variant="secondary" size="sm">{t("teams.players.new")}</Button>
          </Link>
        </div>
        <TeamEditForm team={team} />
      </section>

      <DeleteTeamSection teamId={team.id} teamName={team.name} />
    </div>
  );
}

function TeamMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="border-l-2 border-[var(--club-primary)] bg-white/60 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-zinc-950">
        {value}
      </div>
    </div>
  );
}

function TeamAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 border-y border-[var(--club-line)] bg-white/[0.78] px-4 py-4 transition hover:bg-[var(--club-primary-soft)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--club-primary)] text-[var(--club-primary-foreground)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-950">
            {title}
          </div>
          <div className="mt-0.5 truncate text-xs text-zinc-500">
            {description}
          </div>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400 transition group-hover:text-[var(--club-primary)]" />
    </Link>
  );
}
