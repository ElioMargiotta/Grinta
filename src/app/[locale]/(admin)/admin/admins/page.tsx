import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePlatformAdmin } from "@/lib/auth/getUser";
import { listPlatformAdmins } from "@/lib/admin/queries";
import { AdminsManager } from "@/components/admin/AdminsManager";

export default async function AdminAdminsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user } = await requirePlatformAdmin(locale);
  const t = await getTranslations("admin");
  const admins = await listPlatformAdmins();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {t("admins.title")}
      </h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        {t("admins.subtitle")}
      </p>
      <AdminsManager admins={admins} currentUserId={user.id} locale={locale} />
    </div>
  );
}
