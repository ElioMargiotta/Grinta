import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Mail } from "lucide-react";

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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200">
        <div className="flex items-center gap-2 font-medium">
          <Mail className="h-4 w-4" />
          {t("recommendedFlow")}
        </div>
        <p className="mt-1 text-emerald-700 dark:text-emerald-300">
          {t("recommendedFlowBody")}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {t("haveTokenTitle")}
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("haveTokenSubtitle")}
        </p>
        <form action={gotoTokenAction} className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            name="token"
            required
            placeholder={t("tokenPlaceholder")}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
          />
          <button
            type="submit"
            className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t("continue")}
          </button>
        </form>
      </div>
    </div>
  );
}
