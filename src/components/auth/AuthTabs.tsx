"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export function AuthTabs() {
  const t = useTranslations("auth");
  const pathname = usePathname();
  const isLogin = pathname.endsWith("/login");

  const baseTab =
    "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors";
  const active = "bg-white text-zinc-900 shadow-sm";
  const inactive = "text-zinc-600 hover:text-zinc-900";

  return (
    <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
      <Link href="/login" className={`${baseTab} ${isLogin ? active : inactive}`}>
        {t("tabLogin")}
      </Link>
      <Link href="/signup" className={`${baseTab} ${!isLogin ? active : inactive}`}>
        {t("tabSignup")}
      </Link>
    </div>
  );
}
