import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";
import { resolvePersona } from "@/lib/club/persona";
import { resolveCurrentMembership } from "@/lib/club/context";
import { getMyMemberships } from "@/lib/club/queries";
import { clubThemeStyle } from "@/lib/club/theme";
import { getClubLicenseUsage } from "@/lib/license/queries";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { AccountPersonaForm } from "@/components/account/AccountPersonaForm";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireUser(locale);
  const t = await getTranslations("account");

  const [{ data: profile }, persona, membership, memberships] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, persona_preference")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null; persona_preference: string | null }>(),
    resolvePersona(),
    resolveCurrentMembership(),
    getMyMemberships(),
  ]);

  const preference =
    profile?.persona_preference === "player" ||
    profile?.persona_preference === "dual"
      ? profile.persona_preference
      : "staff";
  const displayName = profile?.full_name?.trim() || user.email || "";
  const backHref = persona?.active === "player" ? "/me" : "/dashboard";

  const licenseUsage = membership ? await getClubLicenseUsage(membership.club_id) : null;

  return (
    <div
      className="flex min-h-screen flex-1 flex-col bg-background"
      style={clubThemeStyle(membership)}
    >
      <Topbar
        userName={displayName}
        currentMembership={membership}
        memberships={memberships}
        licenseUsage={licenseUsage}
        persona={persona}
      />
      <main className="flex-1 px-4 py-8 sm:py-12">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <Link
            href={backHref}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </Link>

          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>

          <Card padded={false} className="p-6 sm:p-8">
            <div className="mb-5">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                {t("identityLabel")}
              </div>
              <div className="mt-1 text-base font-medium text-foreground">
                {displayName || user.email}
              </div>
              <div className="text-xs text-muted-foreground">
                {user.email}
              </div>
            </div>

            <AccountPersonaForm initialPreference={preference} />
          </Card>
        </div>
      </main>
    </div>
  );
}
