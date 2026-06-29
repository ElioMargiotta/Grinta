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
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={create}
            loading={isPending}
          >
            <Plus className="h-4 w-4" />
            {t("create")}
          </Button>
        }
      />

      {evaluations.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("empty")}
          className="mt-4"
        />
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border">
          {evaluations.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-2 transition hover:bg-accent"
            >
              <Link
                href={`/contingent/${playerId}/evaluations/${e.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                    <span className="truncate">
                      {e.evaluation_date
                        ? new Date(e.evaluation_date).toLocaleDateString(locale)
                        : t("noDate")}
                      {e.season ? (
                        <span className="ml-2 text-[11px] font-normal text-muted-foreground">
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
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
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
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
              {sharingAvailable ? (
                <button
                  type="button"
                  onClick={() => toggleShare(e.id, !e.shared_with_player)}
                  disabled={isSharing}
                  title={e.shared_with_player ? t("unshareHint") : t("shareHint")}
                  aria-pressed={e.shared_with_player}
                  className={`mr-2 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${
                    e.shared_with_player
                      ? "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                      : "text-muted-foreground hover:bg-accent"
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
