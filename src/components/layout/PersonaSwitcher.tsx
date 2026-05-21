"use client";

import { useTransition } from "react";
import { Shield, UserCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { switchPersonaAction } from "@/app/[locale]/persona-actions";
import type { Persona } from "@/lib/club/persona";

export function PersonaSwitcher({ active }: { active: Persona }) {
  const t = useTranslations("topbar");
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Persona) {
    if (next === active || isPending) return;
    startTransition(async () => {
      await switchPersonaAction(next);
    });
  }

  const baseBtn =
    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50";

  return (
    <div
      role="group"
      aria-label={t("personaSwitchAria")}
      className="flex items-center gap-0.5 rounded-lg border border-[var(--club-line)] bg-white/70 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/70"
    >
      <button
        type="button"
        disabled={isPending}
        onClick={() => switchTo("staff")}
        aria-pressed={active === "staff"}
        className={`${baseBtn} ${
          active === "staff"
            ? "bg-[var(--club-primary)] text-[var(--club-primary-foreground)]"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
      >
        <Shield className="h-3.5 w-3.5" />
        {t("personaCoach")}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => switchTo("player")}
        aria-pressed={active === "player"}
        className={`${baseBtn} ${
          active === "player"
            ? "bg-[var(--club-primary)] text-[var(--club-primary-foreground)]"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
      >
        <UserCircle className="h-3.5 w-3.5" />
        {t("personaPlayer")}
      </button>
    </div>
  );
}
