import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvitationForm } from "@/components/onboarding/AcceptInvitationForm";
import { AuthShell } from "@/components/auth/AuthShell";

type InvitationPreview = {
  id: string;
  club_id: string;
  club_name: string;
  kind: "staff" | "player" | "guardian";
  email: string | null;
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

  return <AuthShell>{await renderInner()}</AuthShell>;

  async function renderInner(): Promise<ReactNode> {
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

    const playerFullName = `${preview.player_first_name ?? ""} ${preview.player_last_name ?? ""}`.trim();
    const detail =
      preview.kind === "guardian"
        ? t.rich("invitedAsGuardian", {
            name: playerFullName,
            team: preview.team_name ?? t("noTeam"),
            strong: (chunks) => <strong>{chunks}</strong>,
          })
        : preview.kind === "player"
          ? t.rich("invitedAsPlayer", {
              name: playerFullName,
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
            {preview.email && (
              <p className="mt-1 text-sm text-zinc-600">
                {t.rich("invitationSentTo", {
                  email: preview.email,
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
            )}
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

    // Lien réclamable (Lot B) : plus de blocage sur l'email. On affiche un écran
    // de CONFIRMATION D'IDENTITÉ — le compte connecté voit précisément quelle
    // fiche il va rattacher avant de valider. Si l'invitation portait un email
    // différent de celui du compte, on l'indique sans bloquer (le coach contrôle
    // la diffusion du lien ; il peut délier en cas d'erreur).
    const emailDiffers =
      preview.email && user.email &&
      preview.email.toLowerCase() !== user.email.toLowerCase();

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            {t("joinClub", { club: preview.club_name })}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">{detail}</p>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <p>
            {t.rich("confirmIdentity", {
              account: user.email ?? "",
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          {emailDiffers && (
            <p className="mt-2 text-amber-700">{t("confirmIdentityEmailNote")}</p>
          )}
        </div>

        <AcceptInvitationForm token={token} />
      </div>
    );
  }
}
