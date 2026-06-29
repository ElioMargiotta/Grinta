"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BadgeCheck, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { setPlayerDualLicenceAction } from "@/app/[locale]/(app)/contingent/actions";

export type DualLicence = {
  club: string | null;
  level: string | null;
  team: string | null;
};

/**
 * Bloc "Double licence" sur la fiche joueur (EPIC #34). Annotation locale
 * indiquant que ce joueur est aussi licencié dans un autre club ASF — à ne
 * pas confondre avec le rattachement multi-équipes intra-club (qui passe
 * par player_team_assignments, cf. TeamAssignmentsBlock).
 */
export function DualLicenceBlock({
  playerId,
  licence,
}: {
  playerId: string;
  licence: DualLicence;
}) {
  const t = useTranslations("contingent.dualLicence");
  const locale = useLocale();
  const router = useRouter();
  const hasLicence = Boolean(licence.club);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRemoving, startRemoveTransition] = useTransition();

  const submit = (formData: FormData) => {
    setError(null);
    formData.set("locale", locale);
    formData.set("playerId", playerId);
    startTransition(async () => {
      const result = await setPlayerDualLicenceAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const remove = () => {
    setError(null);
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("playerId", playerId);
    // Empty club → action clears all three fields.
    fd.set("dualLicenceClub", "");
    startRemoveTransition(async () => {
      const result = await setPlayerDualLicenceAction(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <Section>
      <SectionHeader
        icon={BadgeCheck}
        iconClassName="text-amber-600"
        title={t("title")}
        className="mb-4"
      />

      {!editing && hasLicence && (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-950/20">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {licence.club}
              </span>
              {licence.level && (
                <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/40 dark:text-amber-200">
                  {t(`level.${licence.level}`)}
                </span>
              )}
            </div>
            {licence.team && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("teamPrefix")} {licence.team}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-4 w-4" />
              {t("edit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={remove}
              loading={isRemoving}
              loadingLabel={t("removing")}
            >
              <Trash2 className="h-4 w-4" />
              {t("remove")}
            </Button>
          </div>
        </div>
      )}

      {!editing && !hasLicence && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {t("emptyHint")}
          </p>
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
            >
              {t("add")}
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <form className="flex flex-col gap-3" action={submit}>
          <Input
            id="dualLicenceClub"
            name="dualLicenceClub"
            label={t("clubLabel")}
            placeholder={t("clubPlaceholder")}
            defaultValue={licence.club ?? ""}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              id="dualLicenceLevel"
              name="dualLicenceLevel"
              label={t("levelLabel")}
              defaultValue={licence.level ?? ""}
            >
              <option value="">—</option>
              <option value="elite">{t("level.elite")}</option>
              <option value="amateur">{t("level.amateur")}</option>
              <option value="other">{t("level.other")}</option>
            </Select>
            <Input
              id="dualLicenceTeam"
              name="dualLicenceTeam"
              label={t("teamLabel")}
              placeholder={t("teamPlaceholder")}
              defaultValue={licence.team ?? ""}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("helper")}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={isPending} loadingLabel={t("saving")}>
              {t("save")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}
