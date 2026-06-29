import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { MfaChallengeForm } from "@/components/auth/MfaChallengeForm";
import { GrintaLogoIcon, GrintaLogoType } from "@/components/landing/BrandSeal";
import { getAalState } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/server";

export default async function MfaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Déjà passé en aal2 (ou aucun facteur requis) → rien à challenger ici.
  const aal = await getAalState();
  if (!aal.currentLevel || aal.currentLevel === aal.nextLevel) {
    redirect(`/${locale}`);
  }

  return (
    <div
      className="relative isolate min-h-screen"
      style={
        {
          "--brand": "oklch(53.576% 0.19004 33.59)",
          backgroundColor: "var(--bg)",
          color: "var(--ink)",
        } as CSSProperties
      }
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
        <span className="blob blob-d" />
        <span className="blob blob-e" />
        <span className="blob blob-f" />
        <span className="grain" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-12 lg:px-10">
        <div className="w-full max-w-[440px]">
          <div className="mb-6 flex flex-col items-center">
            <GrintaLogoIcon size={56} title="Grinta" className="mb-2" />
            <GrintaLogoType height={34} title="Grinta" className="w-auto max-w-[160px]" />
          </div>

          <div className="rounded-3xl border border-[color-mix(in_oklch,var(--ink)_8%,transparent)] bg-[color-mix(in_oklch,var(--paper)_78%,transparent)] p-6 shadow-[0_28px_80px_-28px_rgba(24,24,27,0.4)] backdrop-blur-2xl sm:p-8">
            <MfaChallengeForm />
          </div>
        </div>
      </div>
    </div>
  );
}
