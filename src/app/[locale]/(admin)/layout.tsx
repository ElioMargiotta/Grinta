import { setRequestLocale, getTranslations } from "next-intl/server";
import { LayoutDashboard, Building2, ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requirePlatformAdmin } from "@/lib/auth/getUser";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePlatformAdmin(locale);
  const t = await getTranslations("admin.nav");

  const items = [
    { href: "/admin", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/admin/clubs", label: t("clubs"), icon: Building2 },
    { href: "/admin/admins", label: t("admins"), icon: ShieldCheck },
  ];

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-5 md:flex dark:border-zinc-800 dark:bg-zinc-900">
        <div className="px-3 pb-5">
          <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Grinta · Admin
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{t("subtitle")}</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("backToApp")}
        </Link>
      </aside>
      <main className="flex-1 px-5 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
