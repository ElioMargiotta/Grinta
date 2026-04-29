"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/app/[locale]/(app)/actions";

export function Topbar({ userName }: { userName: string }) {
  const t = useTranslations("nav");
  const [isPending, startTransition] = useTransition();

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{userName}</span>
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
