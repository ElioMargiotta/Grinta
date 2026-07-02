"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Share2 } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Pill } from "@/components/ui/Pill";
import { Badge } from "@/components/ui/Badge";
import { setClubGroupShareAction } from "@/app/[locale]/(app)/settings/club/actions";

type GroupShare = {
  groupClubId: string;
  groupName: string;
  category: string | null;
  subcategory: string | null;
  sharedSuivi: boolean;
};

/**
 * Réglages de partage côté CLUB MEMBRE : le club décide, par regroupement, s'il
 * dévoile le suivi joueur (mesures physiques + évaluations). Rien n'est partagé
 * par défaut ; composition et planification ne sont jamais exposées.
 */
export function ClubGroupSharing({ groups }: { groups: GroupShare[] }) {
  const t = useTranslations("settings.clubPage.groupSharing");
  const tr = useTranslations("admin.regroupements");
  const [state, setState] = useState<GroupShare[]>(groups);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (groups.length === 0) return null;

  function toggle(groupClubId: string, next: boolean) {
    setError(null);
    setState((prev) =>
      prev.map((g) => (g.groupClubId === groupClubId ? { ...g, sharedSuivi: next } : g)),
    );
    const fd = new FormData();
    fd.set("groupClubId", groupClubId);
    fd.set("shareType", "suivi_joueur");
    fd.set("enabled", String(next));
    startTransition(async () => {
      const res = await setClubGroupShareAction(fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
        setState((prev) =>
          prev.map((g) =>
            g.groupClubId === groupClubId ? { ...g, sharedSuivi: !next } : g,
          ),
        );
      }
    });
  }

  return (
    <Section>
      <SectionHeader icon={Share2} title={t("title")} description={t("description")} />
      <ul className="mt-4 flex flex-col gap-3">
        {state.map((g) => (
          <li
            key={g.groupClubId}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {g.groupName}
                </span>
                {g.category && (
                  <Badge variant="outline">
                    {tr(`categoryLabels.${g.category}`)}
                    {g.subcategory ? ` · ${tr(`subcategoryLabels.${g.subcategory}`)}` : ""}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("suiviHint")}</p>
            </div>
            <Pill
              active={g.sharedSuivi}
              disabled={pending}
              aria-pressed={g.sharedSuivi}
              onClick={() => toggle(g.groupClubId, !g.sharedSuivi)}
            >
              {g.sharedSuivi ? t("on") : t("off")}
            </Pill>
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <p className="mt-3 text-xs text-muted-foreground">{t("privacyNote")}</p>
    </Section>
  );
}
