import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { GrintaLogoIcon, GrintaLogoType } from "@/components/landing/BrandSeal";

/**
 * Standalone auth screen layout (logo header + card), used by pages that live
 * outside the (auth) route group and therefore don't get the login/signup
 * tabs — e.g. /confirm-style flows like forgot-password and reset-password.
 */
export async function AuthShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("app");

  return (
    <div className="flex min-h-screen flex-1 items-start justify-center bg-muted px-4 py-10 sm:items-center sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <GrintaLogoIcon size={64} title={t("name")} className="mb-3" />
          <GrintaLogoType height={48} title={t("name")} className="w-auto max-w-[200px]" />
          <p className="mt-2 text-sm text-muted-foreground">{t("tagline")}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
