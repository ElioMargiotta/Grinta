import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvitationForm } from "@/components/onboarding/AcceptInvitationForm";

type Preview = {
  club_id: string;
  club_name: string;
  role_name: string;
  access_level: "full" | "extended" | "team" | "team_readonly";
  email: string;
  expires_at: string;
  already_accepted: boolean;
  expired: boolean;
};

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("invite.page");

  const ACCESS_LABEL: Record<Preview["access_level"], string> = {
    full: t("accessLabels.full"),
    extended: t("accessLabels.extended"),
    team: t("accessLabels.team"),
    team_readonly: t("accessLabels.team_readonly"),
  };

  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("preview_invitation", {
    p_token: token,
  });

  const preview = (rows as Preview[] | null)?.[0];

  if (error || !preview) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-5">
        <h1 className="text-base font-semibold text-amber-900">
          {t("notFound")}
        </h1>
        <p className="text-sm text-amber-800">
          {t("notFoundDesc")}
        </p>
      </div>
    );
  }

  if (preview.expired) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-5">
        <h1 className="text-base font-semibold text-amber-900">
          {t("expired")}
        </h1>
        <p className="text-sm text-amber-800">
          {t("expiredDesc")}
        </p>
      </div>
    );
  }

  if (preview.already_accepted) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-5">
        <h1 className="text-base font-semibold text-emerald-900">
          {t("alreadyAccepted")}
        </h1>
        <p className="text-sm text-emerald-800">
          {t.rich("alreadyAcceptedDesc", {
            club: preview.club_name,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-emerald-900 underline"
        >
          {t("goToLogin")}
        </Link>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            {t("joinClub", { club: preview.club_name })}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {t.rich("invitedToJoinWithRole", {
              role: preview.role_name,
              access: ACCESS_LABEL[preview.access_level as Preview["access_level"]],
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {t.rich("invitationSentTo", {
              email: preview.email,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <p className="text-sm text-zinc-700">
            {t("connectOrCreate")}
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              {t("login")}
            </Link>
            <Link
              href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              {t("createAccount")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (user.email?.toLowerCase() !== preview.email.toLowerCase()) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-5">
        <h1 className="text-base font-semibold text-red-900">
          {t("wrongAccount")}
        </h1>
        <p className="text-sm text-red-800">
          {t.rich("wrongAccountDesc1", {
            invitedEmail: preview.email,
            currentEmail: user.email ?? "",
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <p className="text-sm text-red-800">
          {t("wrongAccountDesc2")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          {t("joinClub", { club: preview.club_name })}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {t.rich("invitedToJoinWithRole", {
            role: preview.role_name,
            access: ACCESS_LABEL[preview.access_level as Preview["access_level"]],
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </div>
      <AcceptInvitationForm token={token} />
    </div>
  );
}
