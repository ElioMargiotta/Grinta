"use client";

import { useTransition } from "react";
import { Shield, UserCircle, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { switchPersonaAction } from "@/app/[locale]/persona-actions";
import type { PersonaProfile } from "@/lib/club/persona";

export function PersonaSwitcher({
  active,
  profiles,
}: {
  active: PersonaProfile;
  profiles: PersonaProfile[];
}) {
  const t = useTranslations("topbar");
  const [isPending, startTransition] = useTransition();

  function switchTo(next: PersonaProfile) {
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
      {profiles.map((profile) => {
        const Icon =
          profile === "staff" ? Shield : profile === "parent" ? Users : UserCircle;
        return (
          <button
            key={profile}
            type="button"
            disabled={isPending}
            onClick={() => switchTo(profile)}
            aria-pressed={active === profile}
            className={`${baseBtn} ${
              active === profile
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {t(
              profile === "staff"
                ? "personaCoach"
                : profile === "parent"
                  ? "personaParent"
                  : "personaPlayer",
            )}
          </button>
        );
      })}
    </div>
  );
}
