"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TeamMultiSelect } from "@/components/contingent/TeamMultiSelect";
import { setPlayerAssignmentsAction } from "@/app/[locale]/(app)/contingent/actions";
import type { ClubTeamOption } from "@/lib/contingent/teams";

/**
 * Bloc d'affectations équipes sur la fiche joueur (#39). Submit séparé du
 * formulaire de métadonnées du joueur pour deux raisons :
 *  - les deux saves ont une cardinalité différente (1 row vs N rows)
 *  - permet de modifier les équipes sans risquer d'écraser une saisie en
 *    cours dans le formulaire principal
 *
 * Replace-set : la sélection courante remplace l'ensemble des affectations
 * "saison actuelle" du joueur (cf. `setPlayerAssignmentsAction`).
 */
export function TeamAssignmentsBlock({
  playerId,
  teams,
  currentTeamIds,
}: {
  playerId: string;
  teams: ClubTeamOption[];
  currentTeamIds: string[];
}) {
  const t = useTranslations("contingent.assignments");
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-zinc-500" />
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h2>
      </div>
      <form
        className="flex flex-col gap-4"
        action={(formData) => {
          setError(null);
          setSaved(false);
          formData.set("locale", locale);
          formData.set("playerId", playerId);
          startTransition(async () => {
            const result = await setPlayerAssignmentsAction(formData);
            if (result?.error) {
              setError(result.error);
              return;
            }
            setSaved(true);
            router.refresh();
          });
        }}
      >
        <TeamMultiSelect
          teams={teams}
          name="teamIds"
          defaultValue={currentTeamIds}
          emptyHint={t("noTeamsYet")}
        />
        {teams.length > 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("helper")}
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && !error && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            {t("saved")}
          </p>
        )}
        {teams.length > 0 && (
          <div>
            <Button type="submit" loading={isPending} loadingLabel={t("saving")}>
              {t("save")}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
