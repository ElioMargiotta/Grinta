import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvitationForm } from "@/components/onboarding/AcceptInvitationForm";

type InvitationPreview = {
  id: string;
  club_id: string;
  club_name: string;
  kind: "staff" | "player";
  email: string;
  role_name: string | null;
  player_first_name: string | null;
  player_last_name: string | null;
  team_name: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
};

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("invite.page");

  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("get_invitation", {
    p_token: token,
  });

  const preview = (rows as InvitationPreview[] | null)?.[0];

  if (error || !preview) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-5">
        <h1 className="text-base font-semibold text-amber-900">{t("notFound")}</h1>
        <p className="text-sm text-amber-800">{t("notFoundDesc")}</p>
      </div>
    );
  }

  if (preview.status === "expired") {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-5">
        <h1 className="text-base font-semibold text-amber-900">{t("expired")}</h1>
        <p className="text-sm text-amber-800">{t("expiredDesc")}</p>
      </div>
    );
  }

  if (preview.status === "revoked") {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-5">
        <h1 className="text-base font-semibold text-amber-900">{t("revoked")}</h1>
        <p className="text-sm text-amber-800">{t("revokedDesc")}</p>
      </div>
    );
  }

  if (preview.status === "accepted") {
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
        <Link href="/login" className="text-sm font-medium text-emerald-900 underline">
          {t("goToLogin")}
        </Link>
      </div>
    );
  }

  const detail =
    preview.kind === "player"
      ? t.rich("invitedAsPlayer", {
          name: `${preview.player_first_name ?? ""} ${preview.player_last_name ?? ""}`.trim(),
          team: preview.team_name ?? t("noTeam"),
          strong: (chunks) => <strong>{chunks}</strong>,
        })
      : t.rich("invitedAsStaff", {
          role: preview.role_name ?? "",
          strong: (chunks) => <strong>{chunks}</strong>,
        });

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
          <p className="mt-1 text-sm text-zinc-600">{detail}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {t.rich("invitationSentTo", {
              email: preview.email,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <p className="text-sm text-zinc-700">{t("connectOrCreate")}</p>
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
        <h1 className="text-base font-semibold text-red-900">{t("wrongAccount")}</h1>
        <p className="text-sm text-red-800">
          {t.rich("wrongAccountDesc1", {
            invitedEmail: preview.email,
            currentEmail: user.email ?? "",
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <p className="text-sm text-red-800">{t("wrongAccountDesc2")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          {t("joinClub", { club: preview.club_name })}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">{detail}</p>
      </div>
      <AcceptInvitationForm token={token} />
    </div>
  );
}
