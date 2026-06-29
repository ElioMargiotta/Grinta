"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { CheckCircle2, FileUp, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  decodeCsv,
  parseClubCornerCsv,
  type ParseResult,
} from "@/lib/contingent/clubcorner-csv";
import {
  importClubCornerCsvAction,
  type ImportSummary,
} from "@/app/[locale]/(app)/contingent/actions";
import type { ClubTeamOption } from "@/lib/contingent/teams";

type Stage = "pick" | "preview" | "done";

export function ImportClubCornerWizard({
  teams = [],
  defaultTargetTeamId,
}: {
  /** Équipes actives du club, pour la sélection de l'équipe cible (#39). */
  teams?: ClubTeamOption[];
  /** Équipe pré-sélectionnée (route /contingent/import?teamId=...). */
  defaultTargetTeamId?: string;
}) {
  const t = useTranslations("contingent.import");
  const locale = useLocale();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetTeamId, setTargetTeamId] = useState<string>(
    defaultTargetTeamId ?? "",
  );
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setStage("pick");
    setFileName(null);
    setCsvText("");
    setParsed(null);
    setSummary(null);
    setError(null);
    setTargetTeamId(defaultTargetTeamId ?? "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onFile = async (file: File) => {
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const text = decodeCsv(buf);
      const result = parseClubCornerCsv(text);
      setFileName(file.name);
      setCsvText(text);
      setParsed(result);
      setStage("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runImport = () => {
    if (!csvText) return;
    setError(null);
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("csv", csvText);
    if (targetTeamId) fd.set("targetTeamId", targetTeamId);
    startTransition(async () => {
      try {
        const result = await importClubCornerCsvAction(fd);
        setSummary(result);
        setStage("done");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const validCount = parsed?.rows.filter((r) => r.errors.length === 0).length ?? 0;
  const invalidCount = parsed?.rows.filter((r) => r.errors.length > 0).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Step 1 — file picker */}
      <label
        htmlFor="clubcorner-csv"
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
          stage === "pick"
            ? "border-input bg-muted/50 hover:border-primary hover:bg-accent"
            : "border-border bg-card"
        }`}
      >
        <FileUp className="h-6 w-6 text-muted-foreground" />
        <div className="text-sm font-medium text-foreground">
          {fileName ?? t("dropHint")}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("formatHint")}
        </p>
        <input
          ref={fileInputRef}
          id="clubcorner-csv"
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
      </label>

      {/* Step 2 — preview */}
      {stage === "preview" && parsed && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          {parsed.fatalError ? (
            <p className="text-sm text-destructive">
              {t("fatalError", { error: parsed.fatalError })}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="font-medium text-foreground">
                  {t("rowsDetected", { n: parsed.rows.length })}
                </span>
                <span className="text-emerald-700 dark:text-emerald-300">
                  {t("rowsValid", { n: validCount })}
                </span>
                {invalidCount > 0 && (
                  <span className="text-amber-700 dark:text-amber-300">
                    {t("rowsInvalid", { n: invalidCount })}
                  </span>
                )}
              </div>

              <div className="max-h-64 overflow-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5">#</th>
                      <th className="px-3 py-1.5">{t("colName")}</th>
                      <th className="px-3 py-1.5">{t("colBirth")}</th>
                      <th className="px-3 py-1.5">{t("colLicense")}</th>
                      <th className="px-3 py-1.5">{t("colJersey")}</th>
                      <th className="px-3 py-1.5">{t("colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 10).map((r) => (
                      <tr
                        key={r.rowIndex}
                        className="border-t border-border"
                      >
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {r.rowIndex}
                        </td>
                        <td className="px-3 py-1.5">
                          {r.player.first_name} {r.player.last_name}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {r.player.birth_date ?? "—"}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {r.player.license_number ?? "—"}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {r.player.jersey_number ?? "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          {r.errors.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {t("rowValid")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                              <XCircle className="h-3.5 w-3.5" />
                              {r.errors.join(", ")}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.length > 10 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {t("previewTruncated", { n: parsed.rows.length - 10 })}
                  </p>
                )}
              </div>

              {teams.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="import-target-team"
                    className="text-sm font-medium text-foreground"
                  >
                    {t("targetTeamLabel")}
                  </label>
                  <Select
                    id="import-target-team"
                    value={targetTeamId}
                    onChange={(e) => setTargetTeamId(e.target.value)}
                    aria-label={t("targetTeamLabel")}
                  >
                    <option value="">{t("noTargetTeam")}</option>
                    {teams.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name}
                        {tm.age_group ? ` · ${tm.age_group}` : ""}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {targetTeamId
                      ? t("targetTeamHint")
                      : t("noTargetTeamHint")}
                  </p>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={runImport}
                  loading={isPending}
                  loadingLabel={t("importing")}
                  disabled={validCount === 0}
                >
                  <Upload className="h-4 w-4" />
                  {t("importButton", { n: validCount })}
                </Button>
                <Button variant="ghost" size="sm" onClick={reset}>
                  {t("cancel")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3 — result */}
      {stage === "done" && summary && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/20">
          {summary.fatalError ? (
            <p className="text-sm text-destructive">{summary.fatalError}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                <span className="text-emerald-800 dark:text-emerald-200">
                  {t("doneCreated", { n: summary.created })}
                </span>
                <span className="text-foreground">
                  {t("doneUpdated", { n: summary.updated })}
                </span>
                {summary.skipped > 0 && (
                  <span className="text-amber-700 dark:text-amber-300">
                    {t("doneSkipped", { n: summary.skipped })}
                  </span>
                )}
                {summary.errors > 0 && (
                  <span className="text-red-700 dark:text-red-300">
                    {t("doneErrors", { n: summary.errors })}
                  </span>
                )}
              </div>

              {(summary.skipped > 0 || summary.errors > 0) && (
                <details className="text-xs text-foreground">
                  <summary className="cursor-pointer">{t("detailsToggle")}</summary>
                  <ul className="mt-2 space-y-1">
                    {summary.outcomes
                      .filter((o) => o.status === "skipped" || o.status === "error")
                      .map((o) => (
                        <li key={o.row}>
                          {o.row}. {o.name} — {o.status}
                          {(o.status === "skipped" || o.status === "error") && o.reason
                            ? `: ${o.reason}`
                            : ""}
                        </li>
                      ))}
                  </ul>
                </details>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Link href="/contingent">
                  <Button size="sm">{t("backToList")}</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={reset}>
                  {t("again")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
