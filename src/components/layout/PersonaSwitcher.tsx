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
      className="flex items-center gap-0.5 rounded-lg border border-border bg-card/70 p-0.5"
    >
      <button
        type="button"
        disabled={isPending}
        onClick={() => switchTo("staff")}
        aria-pressed={active === "staff"}
        className={`${baseBtn} ${
          active === "staff"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
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
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <UserCircle className="h-3.5 w-3.5" />
        {t("personaPlayer")}
      </button>
    </div>
  );
}
