"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Users, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TeamMultiSelect } from "@/components/contingent/TeamMultiSelect";
import {
  removePlayerFromTeamAction,
  setPlayerAssignmentsAction,
} from "@/app/[locale]/(app)/contingent/actions";
import type { ClubTeamOption } from "@/lib/contingent/teams";

/**
 * Bloc d'affectations équipes sur la fiche joueur (#39, #40).
 * - Chips en haut : affectations courantes avec × pour retirer une équipe en
 *   un clic (action ciblée `removePlayerFromTeamAction`).
 * - Picker en bas : édition complète de l'ensemble via le replace-set
 *   `setPlayerAssignmentsAction`. Submit séparé du formulaire de métadonnées.
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
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();

  const currentTeams = currentTeamIds
    .map((id) => teams.find((tm) => tm.id === id))
    .filter((tm): tm is ClubTeamOption => Boolean(tm));

  const removeTeam = (teamId: string) => {
    setError(null);
    setSaved(false);
    setRemovingId(teamId);
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("playerId", playerId);
    fd.set("teamId", teamId);
    startRemoveTransition(async () => {
      const result = await removePlayerFromTeamAction(fd);
      setRemovingId(null);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-zinc-500" />
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h2>
      </div>

      {currentTeams.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t("currentLabel")}
          </span>
          <div className="flex flex-wrap gap-2">
            {currentTeams.map((tm) => {
              const isBusy = isRemoving && removingId === tm.id;
              return (
                <span
                  key={tm.id}
                  className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--club-primary)] bg-[var(--club-primary-soft)] px-3 py-1 text-xs font-medium text-[var(--club-primary)] ${
                    isBusy ? "opacity-60" : ""
                  }`}
                >
                  <span>{tm.name}</span>
                  {tm.age_group && (
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {tm.age_group}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeTeam(tm.id)}
                    disabled={isRemoving}
                    aria-label={t("removeFromTeam", { team: tm.name })}
                    className="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--club-primary)] transition hover:bg-[var(--club-primary)] hover:text-[var(--club-primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

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
          key={[...currentTeamIds].sort().join("|")}
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
