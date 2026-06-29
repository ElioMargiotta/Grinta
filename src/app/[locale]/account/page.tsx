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
import {
  AccountPersonaForm,
  type AccountCapability,
} from "@/components/account/AccountPersonaForm";
import { AccountIdentityForm } from "@/components/account/AccountIdentityForm";
import { TwoFactorSection } from "@/components/account/TwoFactorSection";
import { ChangePasswordSection } from "@/components/account/ChangePasswordSection";
import { ChangeEmailSection } from "@/components/account/ChangeEmailSection";

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
      .select(
        "full_name, first_name, last_name, birth_date, phone, persona_preference, username, can_coach, can_play, can_parent",
      )
      .eq("id", user.id)
      .maybeSingle<{
        full_name: string | null;
        first_name: string | null;
        last_name: string | null;
        birth_date: string | null;
        phone: string | null;
        persona_preference: string | null;
        username: string | null;
        can_coach: boolean | null;
        can_play: boolean | null;
        can_parent: boolean | null;
      }>(),
    resolvePersona(),
    resolveCurrentMembership(),
    getMyMemberships(),
  ]);

  const capabilities: AccountCapability[] = [];
  if (profile?.can_coach ?? profile?.persona_preference === "staff") {
    capabilities.push("staff");
  }
  if (profile?.can_play ?? profile?.persona_preference === "player") {
    capabilities.push("player");
  }
  if (profile?.can_parent ?? profile?.persona_preference === "parent") {
    capabilities.push("parent");
  }
  if (capabilities.length === 0) capabilities.push("staff");
  const displayName = profile?.full_name?.trim() || user.email || "";
  const backHref = persona?.active === "player" ? "/me" : "/dashboard";

  const licenseUsage = membership ? await getClubLicenseUsage(membership.club_id) : null;

  // Résilient : si la MFA n'est pas (encore) activée côté projet, l'API peut
  // renvoyer une réponse inattendue — on retombe alors sur "aucun facteur".
  let totpFactor: { id: string } | null = null;
  try {
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    totpFactor = factorsData?.totp?.[0] ?? null;
  } catch {
    totpFactor = null;
  }

  let recoveryRemaining = 0;
  if (totpFactor) {
    const { data } = await supabase.rpc("count_unused_mfa_recovery_codes");
    recoveryRemaining = typeof data === "number" ? data : 0;
  }

  return (
    <div
      className="flex min-h-screen flex-1 flex-col bg-[var(--club-page-bg)]"
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

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
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

            <AccountIdentityForm
              initialFirstName={profile?.first_name ?? null}
              initialLastName={profile?.last_name ?? null}
              initialBirthDate={profile?.birth_date ?? null}
              initialPhone={profile?.phone ?? null}
              email={user.email ?? null}
              initialUsername={profile?.username ?? null}
            />

            <div className="my-6 h-px bg-border" />

            <AccountPersonaForm initialCapabilities={capabilities} />

            <div className="my-6 h-px bg-border" />

            <TwoFactorSection
              enrolled={!!totpFactor}
              recoveryRemaining={recoveryRemaining}
            />

            <div className="my-6 h-px bg-border" />

            <ChangePasswordSection
              has2FA={!!totpFactor}
              factorId={totpFactor?.id ?? null}
            />

            <div className="my-6 h-px bg-border" />

            <ChangeEmailSection
              currentEmail={user.email ?? ""}
              has2FA={!!totpFactor}
              factorId={totpFactor?.id ?? null}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
