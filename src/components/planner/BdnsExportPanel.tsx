"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  generateBdnsCsvAction,
  type BdnsExportResult,
} from "@/app/[locale]/(app)/planner/[teamId]/bdns-export/bdns-export-actions";

function downloadLatin1Csv(filename: string, contentBase64: string) {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "text/csv;charset=windows-1252" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function BdnsExportPanel({
  teamId,
  defaultStart,
  defaultEnd,
}: {
  teamId: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const t = useTranslations("bdns");
  const locale = useLocale();
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [includeTrainings, setIncludeTrainings] = useState(true);
  const [includeMatches, setIncludeMatches] = useState(true);
  const [fallbackLocation, setFallbackLocation] = useState("");
  const [result, setResult] = useState<BdnsExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("teamId", teamId);
    fd.set("start", start);
    fd.set("end", end);
    fd.set("includeTrainings", includeTrainings ? "1" : "0");
    fd.set("includeMatches", includeMatches ? "1" : "0");
    fd.set("fallbackLocation", fallbackLocation);
    startTransition(async () => {
      const res = await generateBdnsCsvAction(fd);
      if (res.error) {
        setError(t.has(`err.${res.error}`) ? t(`err.${res.error}`) : res.error);
        return;
      }
      setResult(res);
      if (res.contentBase64 && res.filename && (res.count ?? 0) > 0) {
        downloadLatin1Csv(res.filename, res.contentBase64);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="bdns-start"
          name="bdns-start"
          type="date"
          label={t("startDate")}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <Input
          id="bdns-end"
          name="bdns-end"
          type="date"
          label={t("endDate")}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {t("activities")}
        </legend>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={includeTrainings}
            onChange={(e) => setIncludeTrainings(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          {t("includeTrainings")}
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={includeMatches}
            onChange={(e) => setIncludeMatches(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          {t("includeMatches")}
        </label>
      </fieldset>

      <Input
        id="bdns-fallback-location"
        name="bdns-fallback-location"
        label={t("fallbackLocation")}
        hint={t("fallbackLocationHint")}
        value={fallbackLocation}
        onChange={(e) => setFallbackLocation(e.target.value)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <Button onClick={run} loading={isPending}>
          <Download className="h-4 w-4" />
          {t("generate")}
        </Button>
      </div>

      {result && !result.error && (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {t("done", { n: result.count ?? 0 })}
          </p>

          {result.missing && result.missing.length > 0 && (
            <details className="text-xs text-amber-700 dark:text-amber-300">
              <summary className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t("missingTitle", { n: result.missing.length })}
              </summary>
              <ul className="mt-2 space-y-1">
                {result.missing.map((m, i) => (
                  <li key={i}>
                    {m.name || t("unnamed")} — {t(`fonction.${m.fonction}`)}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {result.durationWarnings && result.durationWarnings.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {t("durationWarning", { list: result.durationWarnings.join(", ") })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
