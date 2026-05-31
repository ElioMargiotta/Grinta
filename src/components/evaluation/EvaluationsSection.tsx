"use client";

import { ChevronRight, Plus, ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { useLoading } from "@/components/ui/LoadingProvider";
import { createPlayerEvaluationAction } from "@/app/[locale]/(app)/contingent/[playerId]/evaluations/actions";
import type { AppreciationLevel } from "./types";

export type EvaluationRow = {
  id: string;
  evaluation_date: string | null;
  season: string | null;
  appreciation: AppreciationLevel[];
  average: number | null;
};

export function EvaluationsSection({
  playerId,
  locale,
  evaluations,
}: {
  playerId: string;
  locale: string;
  evaluations: EvaluationRow[];
}) {
  const t = useTranslations("evaluation.list");
  const tCommon = useTranslations("common");
  const { run } = useLoading();
  const [isPending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      await run(
        () => createPlayerEvaluationAction({ playerId, locale }),
        { label: t("creating"), message: tCommon("pleaseWait") },
      );
    });
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {t("title")}
          </h2>
          <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" />
          {t("create")}
        </button>
      </div>

      {evaluations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <ClipboardList className="h-5 w-5 text-zinc-400" />
          <p className="text-[13px] text-zinc-600 dark:text-zinc-400">
            {t("empty")}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {evaluations.map((e) => (
            <li key={e.id}>
              <Link
                href={`/contingent/${playerId}/evaluations/${e.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                    {e.evaluation_date
                      ? new Date(e.evaluation_date).toLocaleDateString(locale)
                      : t("noDate")}
                    {e.season ? (
                      <span className="ml-2 text-[11px] font-normal text-zinc-500">
                        · {e.season}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {e.appreciation.length > 0 ? (
                      <span>
                        {e.appreciation
                          .map((a) => t(`appreciation.${a}`))
                          .join(", ")}
                      </span>
                    ) : null}
                    {e.average !== null ? (
                      <span className="font-mono tabular-nums">
                        {t("average")}: {e.average.toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
