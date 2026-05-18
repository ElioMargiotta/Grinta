import {
  ArrowUpRight,
  CalendarDays,
  Crown,
  Dumbbell,
  LinkIcon,
  PenSquare,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";
import { getMyMemberships } from "@/lib/club/queries";
import { PendingInvitationsBanner } from "@/components/onboarding/PendingInvitationsBanner";

type PendingInvitation = {
  invitation_id: string;
  club_name: string;
  role_name: string;
  invited_by_name: string | null;
};

type Cta = {
  titleKey: string;
  descKey: string;
  href: string;
  icon: typeof CalendarDays;
  tone: "free" | "premium";
};

const CTAS: Cta[] = [
  {
    titleKey: "ctaJoinClubTitle",
    descKey: "ctaJoinClubDesc",
    href: "/invite",
    icon: LinkIcon,
    tone: "free",
  },
  {
    titleKey: "ctaCreateClubTitle",
    descKey: "ctaCreateClubDesc",
    href: "/onboarding/club",
    icon: Crown,
    tone: "premium",
  },
  {
    titleKey: "ctaCreateSessionTitle",
    descKey: "ctaCreateSessionDesc",
    href: "/sessions",
    icon: PenSquare,
    tone: "free",
  },
  {
    titleKey: "ctaLibraryTitle",
    descKey: "ctaLibraryDesc",
    href: "/exercises",
    icon: Dumbbell,
    tone: "free",
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

  const [{ data: profile }, memberships, { data: pendingRaw }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    getMyMemberships(),
    supabase.rpc("my_pending_invitations"),
  ]);

  const name = profile?.full_name?.trim() || user.email || "";
  const hasMembership = memberships.length > 0;
  const pending = (pendingRaw ?? []) as PendingInvitation[];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          {t("welcome", { name }).toString().split(",")[0]}
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("welcome", { name })}
        </p>
      </div>

      {pending.length > 0 && <PendingInvitationsBanner invitations={pending} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {CTAS.map(({ titleKey, descKey, href, icon: Icon, tone }) => {
          const isPremium = tone === "premium";
          return (
            <Link key={titleKey} href={href} className="group">
              <div
                className={
                  isPremium
                    ? "flex h-full flex-col justify-between rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-amber-500/30 dark:from-amber-950/40 dark:via-zinc-900 dark:to-zinc-900"
                    : "flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                }
              >
                <div className="flex items-start justify-between">
                  <div
                    className={
                      isPremium
                        ? "flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white"
                        : "flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    }
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-zinc-300 transition group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                </div>
                <div className="mt-8">
                  <div className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {t(titleKey)}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {t(descKey)}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {hasMembership && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {memberships.length}
          {" · "}
          <Link href="/teams" className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100">
            {t("teamsCard")}
          </Link>
        </div>
      )}
    </div>
  );
}
