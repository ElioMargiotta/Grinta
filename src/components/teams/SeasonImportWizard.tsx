"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarRange, Check, Download, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { importSeasonContentAction } from "@/app/[locale]/(app)/teams/season-import-actions";

export type ImportSourceTeam = {
  id: string;
  name: string;
  age_group: string | null;
};

export type ImportSource = {
  season: string;
  teams: ImportSourceTeam[];
};

/**
 * Assistant « Importer depuis une saison précédente ». Recrée dans la saison
 * active la structure choisie d'une saison source : équipes (toujours), +
 * effectifs et/ou périodisation en option. Non destructif côté source.
 */
export function SeasonImportWizard({
  targetSeason,
  sources,
  variant = "primary",
}: {
  targetSeason: string;
  sources: ImportSource[];
  variant?: "primary" | "ghost";
}) {
  const t = useTranslations("seasonImport");
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <>
      <Button variant={variant === "ghost" ? "ghost" : "secondary"} size="sm" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" />
        {t("button")}
      </Button>
      {open ? (
        <ImportDialog
          targetSeason={targetSeason}
          sources={sources}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ImportDialog({
  targetSeason,
  sources,
  onClose,
}: {
  targetSeason: string;
  sources: ImportSource[];
  onClose: () => void;
}) {
  const t = useTranslations("seasonImport");
  const [sourceSeason, setSourceSeason] = useState(sources[0].season);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(sources[0].teams.map((tm) => tm.id)),
  );
  const [includeRosters, setIncludeRosters] = useState(true);
  const [includePeriodization, setIncludePeriodization] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const teams = useMemo(
    () => sources.find((s) => s.season === sourceSeason)?.teams ?? [],
    [sources, sourceSeason],
  );

  const onSourceChange = (season: string) => {
    setSourceSeason(season);
    const next = sources.find((s) => s.season === season)?.teams ?? [];
    setSelected(new Set(next.map((tm) => tm.id)));
    setMsg(null);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = teams.length > 0 && selected.size === teams.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(teams.map((tm) => tm.id)));

  const submit = () => {
    if (selected.size === 0) {
      setMsg({ ok: false, text: t("err.no_team") });
      return;
    }
    const fd = new FormData();
    fd.set("sourceSeason", sourceSeason);
    for (const id of selected) fd.append("teamIds", id);
    if (includeRosters) fd.set("includeRosters", "on");
    if (includePeriodization) fd.set("includePeriodization", "on");

    startTransition(async () => {
      setMsg(null);
      const r = await importSeasonContentAction(fd);
      if (r?.error) {
        setMsg({ ok: false, text: t.has(`err.${r.error}`) ? t(`err.${r.error}`) : t("err.db_error") });
        return;
      }
      const c = r.imported ?? { teams: 0, rosters: 0, periodization: 0 };
      setMsg({
        ok: true,
        text: t("success", {
          teams: c.teams,
          rosters: c.rosters,
          periodization: c.periodization,
        }),
      });
      // Laisse le message visible un court instant puis ferme (la vue se
      // rafraîchit via revalidatePath côté action).
      setTimeout(onClose, 900);
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        showClose={false}
        className="flex max-h-[88vh] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CalendarRange className="h-4 w-4 text-primary" />
              {t("title")}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("subtitle", { season: targetSeason })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cancel")}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
          <Select
            id="import-source"
            label={t("sourceLabel")}
            value={sourceSeason}
            onChange={(e) => onSourceChange(e.target.value)}
          >
            {sources.map((s) => (
              <option key={s.season} value={s.season}>
                {s.season}
              </option>
            ))}
          </Select>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {t("teamsLabel")}
              </span>
              {teams.length > 0 ? (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {allSelected ? t("selectNone") : t("selectAll")}
                </button>
              ) : null}
            </div>
            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noTeams")}</p>
            ) : (
              <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1">
                {teams.map((tm) => {
                  const checked = selected.has(tm.id);
                  return (
                    <li key={tm.id}>
                      <button
                        type="button"
                        onClick={() => toggle(tm.id)}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input"
                          }`}
                        >
                          {checked ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {tm.name}
                          </span>
                          {tm.age_group ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {tm.age_group}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-foreground">
              {t("includeLabel")}
            </legend>
            <CheckRow
              checked
              disabled
              label={t("includeTeams")}
              hint={t("includeTeamsHint")}
              onChange={() => {}}
            />
            <CheckRow
              checked={includeRosters}
              label={t("includeRosters")}
              hint={t("includeRostersHint")}
              onChange={() => setIncludeRosters((v) => !v)}
            />
            <CheckRow
              checked={includePeriodization}
              label={t("includePeriodization")}
              hint={t("includePeriodizationHint")}
              onChange={() => setIncludePeriodization((v) => !v)}
            />
          </fieldset>

          {msg ? (
            <p
              className={`text-sm ${
                msg.ok
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-destructive"
              }`}
            >
              {msg.text}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button
            size="sm"
            onClick={submit}
            loading={isPending}
            loadingLabel={t("importing")}
            disabled={selected.size === 0}
          >
            <Download className="h-4 w-4" />
            {t("submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CheckRow({
  checked,
  disabled = false,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  hint: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      aria-pressed={checked}
      disabled={disabled}
      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        checked
          ? "border-primary bg-accent"
          : "border-border hover:border-input"
      } ${disabled ? "cursor-default opacity-90" : ""}`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input"
        }`}
      >
        {checked ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
