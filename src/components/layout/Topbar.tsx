"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/app/[locale]/(app)/actions";

function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Topbar({ userName }: { userName: string }) {
  const t = useTranslations("nav");
  const [isPending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">
          {initials(userName)}
        </span>
        <div className="leading-tight">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {userName || "Coach"}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Signed in
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          startTransition(async () => {
            await logoutAction();
          })
        }
        disabled={isPending}
      >
        <LogOut className="h-4 w-4" />
        {t("logout")}
      </Button>
    </header>
  );
}
