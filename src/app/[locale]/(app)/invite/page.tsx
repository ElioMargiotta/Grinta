import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Landing for users who have an invitation token from outside the in-app
// banner flow (e.g. someone pasted them a /invite/<token> URL). The primary
// flow is now in-app: signing in with the invited email shows the pending
// invitation as a banner on the dashboard.
export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("invite");

  async function gotoTokenAction(formData: FormData) {
    "use server";
    const raw = String(formData.get("token") ?? "").trim();
    if (!raw) return;
    const match = raw.match(/invite\/([^/?#]+)/);
    const token = match ? match[1] : raw;
    redirect(`/${locale}/invite/${token}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200">
        <div className="flex items-center gap-2 font-medium">
          <Mail className="h-4 w-4" />
          {t("recommendedFlow")}
        </div>
        <p className="mt-1 text-emerald-700 dark:text-emerald-300">
          {t("recommendedFlowBody")}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="text-sm font-medium text-foreground">
          {t("haveTokenTitle")}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("haveTokenSubtitle")}
        </p>
        <form action={gotoTokenAction} className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            name="token"
            required
            placeholder={t("tokenPlaceholder")}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
          />
          <Button type="submit" className="self-start">
            {t("continue")}
          </Button>
        </form>
      </div>
    </div>
  );
}
