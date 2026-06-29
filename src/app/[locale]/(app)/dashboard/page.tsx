import {
  ArrowUpRight,
  Dumbbell,
  LinkIcon,
  PenSquare,
  Sparkles,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";
import { getMyMemberships } from "@/lib/club/queries";
import { resolveCurrentMembership } from "@/lib/club/context";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";
import { getClubWeekOverview } from "@/lib/dashboard/week";
import { DASHBOARD_TEAM_COOKIE, parseDashboardTeam } from "@/lib/dashboard/teamCookie";
import { cookies } from "next/headers";
import { PendingInvitationsBanner } from "@/components/onboarding/PendingInvitationsBanner";
import { WeekPanel } from "@/components/dashboard/WeekPanel";

type PendingInvitation = {
  invitation_id: string;
  club_id: string;
  club_name: string;
  role_name: string;
  invited_by_name: string | null;
};

type FreeAction = {
  titleKey: string;
  descKey: string;
  href: string;
  icon: typeof LinkIcon;
};

const FREE_ACTIONS: FreeAction[] = [
  {
    titleKey: "ctaJoinClubTitle",
    descKey: "ctaJoinClubDesc",
    href: "/invite",
    icon: LinkIcon,
  },
  {
    titleKey: "ctaCreateSessionTitle",
    descKey: "ctaCreateSessionDesc",
    href: "/sessions",
    icon: PenSquare,
  },
  {
    titleKey: "ctaLibraryTitle",
    descKey: "ctaLibraryDesc",
    href: "/exercises",
    icon: Dumbbell,
  },
];

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireUser(locale);
  const t = await getTranslations("dashboard");

  const [{ data: profile }, memberships, membership, { data: pendingRaw }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      getMyMemberships(),
      resolveCurrentMembership(),
      supabase.rpc("my_pending_invitations"),
    ]);

  const name = profile?.full_name?.trim() || user.email || "";
  const hasMembership = memberships.length > 0;
  const pending = (pendingRaw ?? []) as PendingInvitation[];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {t("greeting")}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {name || t("title")}
          </h1>
        </div>
        {membership && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--club-primary)]/10 px-3 py-1 text-sm font-medium text-[var(--club-primary)]">
              {membership.role_name}
            </span>
            <span className="text-sm text-zinc-400">{membership.club_name}</span>
          </div>
        )}
      </header>

      {pending.length > 0 && <PendingInvitationsBanner invitations={pending} />}

      {hasMembership && membership ? (
        <WeekPanel
          clubId={membership.club_id}
          initialTeam={parseDashboardTeam(
            (await cookies()).get(DASHBOARD_TEAM_COOKIE)?.value,
            membership.club_id,
          )}
          overview={await getClubWeekOverview(
            membership.club_id,
            await resolveCurrentSeasonLabel(),
          )}
        />
      ) : (
        <FreeTierHome t={t} />
      )}
    </div>
  );
}

function FreeTierHome({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Conversion hero — la création de club est réservée à l'admin plateforme
          (sur devis). On oriente donc vers une demande de devis via /contact. */}
      <Link href="/contact?topic=devis" className="group block">
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-amber-500/30 dark:from-amber-950/40 dark:via-zinc-900 dark:to-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                <Sparkles className="h-3.5 w-3.5" />
                {t("premiumBadge")}
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {t("premiumTitle")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t("premiumDesc")}
              </p>
              <div className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-amber-600">
                {t("premiumCta")}
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </Link>

      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {t("freeActionsTitle")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {FREE_ACTIONS.map(({ titleKey, descKey, href, icon: Icon }) => (
            <Link key={titleKey} href={href} className="group">
              <div className="flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-zinc-300 transition group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                </div>
                <div className="mt-6">
                  <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {t(titleKey)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {t(descKey)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
