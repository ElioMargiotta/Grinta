"use client";

import {
  ChevronRight,
  Plus,
  ClipboardList,
  Eye,
  EyeOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { Section, SectionHeader } from "@/components/ui/Section";
import { useLoading } from "@/components/ui/LoadingProvider";
import {
  createPlayerEvaluationAction,
  setEvaluationSharedAction,
} from "@/app/[locale]/(app)/contingent/[playerId]/evaluations/actions";
import type { AppreciationLevel } from "./types";

export type EvaluationRow = {
  id: string;
  evaluation_date: string | null;
  season: string | null;
  appreciation: AppreciationLevel[];
  average: number | null;
  shared_with_player: boolean;
};

export function EvaluationsSection({
  playerId,
  locale,
  evaluations,
  sharingAvailable = true,
}: {
  playerId: string;
  locale: string;
  evaluations: EvaluationRow[];
  sharingAvailable?: boolean;
}) {
  const t = useTranslations("evaluation.list");
  const tCommon = useTranslations("common");
  const { run } = useLoading();
  const [isPending, startTransition] = useTransition();
  const [isSharing, startShareTransition] = useTransition();

  function create() {
    startTransition(async () => {
      await run(
        () => createPlayerEvaluationAction({ playerId, locale }),
        { label: t("creating"), message: tCommon("pleaseWait") },
      );
    });
  }

  function toggleShare(evaluationId: string, next: boolean) {
    startShareTransition(async () => {
      await setEvaluationSharedAction({
        playerId,
        evaluationId,
        locale,
        shared: next,
      });
    });
  }

  return (
    <Section>
      <SectionHeader
        icon={ClipboardList}
        title={t("title")}
        description={t("subtitle")}
        action={
          <button
            type="button"
            onClick={create}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--club-line)] bg-white px-3 text-sm font-medium text-zinc-900 transition hover:bg-[var(--club-primary-soft)] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            {t("create")}
          </button>
        }
      />

      {evaluations.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--club-line)] bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <ClipboardList className="h-5 w-5 text-zinc-400" />
          <p className="text-[13px] text-zinc-600 dark:text-zinc-400">
            {t("empty")}
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-md border border-[var(--club-line)] dark:divide-zinc-800 dark:border-zinc-800">
          {evaluations.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-2 transition hover:bg-[var(--club-primary-soft)]"
            >
              <Link
                href={`/contingent/${playerId}/evaluations/${e.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                    <span className="truncate">
                      {e.evaluation_date
                        ? new Date(e.evaluation_date).toLocaleDateString(locale)
                        : t("noDate")}
                      {e.season ? (
                        <span className="ml-2 text-[11px] font-normal text-zinc-500">
                          · {e.season}
                        </span>
                      ) : null}
                    </span>
                    {e.shared_with_player ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <Eye className="h-3 w-3" />
                        {t("sharedBadge")}
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
              {sharingAvailable ? (
                <button
                  type="button"
                  onClick={() => toggleShare(e.id, !e.shared_with_player)}
                  disabled={isSharing}
                  title={e.shared_with_player ? t("unshareHint") : t("shareHint")}
                  aria-pressed={e.shared_with_player}
                  className={`mr-2 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition disabled:opacity-60 ${
                    e.shared_with_player
                      ? "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                      : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {e.shared_with_player ? (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      {t("shared")}
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      {t("notShared")}
                    </>
                  )}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
