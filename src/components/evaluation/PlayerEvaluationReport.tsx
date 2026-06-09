import { getTranslations } from "next-intl/server";
import {
  TIPS_CRITERIA,
  TIPS_GROUPS,
  groupAverage,
  overallAverage,
  type EvaluationData,
} from "./types";

export async function PlayerEvaluationReport({
  data,
}: {
  data: EvaluationData;
}) {
  const t = await getTranslations("evaluation");
  const overall = overallAverage(data.tips);

  const strengths = data.strengths.filter((s) => s.trim());
  const improvements = data.improvements.filter((s) => s.trim());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {TIPS_GROUPS.map((group) => {
          const criteria = TIPS_CRITERIA.filter((c) => c.group === group);
          const scored = criteria.filter((c) => data.tips[c.id] > 0);
          if (scored.length === 0) return null;
          const gAvg = groupAverage(data.tips, group);
          const comment = data.tipsComments[group]?.trim();
          return (
            <div
              key={group}
              className="rounded-md border border-[var(--club-line)] p-4 dark:border-zinc-800"
            >
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {t(`group.${group}`)}
                </h3>
                {gAvg !== null ? (
                  <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {gAvg.toFixed(1)}/5
                  </span>
                ) : null}
              </div>
              <ul className="flex flex-col gap-2.5">
                {scored.map((c) => {
                  const score = data.tips[c.id];
                  return (
                    <li key={c.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-700 dark:text-zinc-300">
                        {t(`criterion.${c.id}.label`)}
                      </span>
                      <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <span
                          className="h-full rounded-full bg-[var(--club-primary)]"
                          style={{ width: `${(score / 5) * 100}%` }}
                        />
                      </span>
                      <span className="w-7 shrink-0 text-right font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                        {score}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {comment ? (
                <p className="mt-3 whitespace-pre-wrap border-t border-[var(--club-line)] pt-3 text-[13px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  {comment}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {overall !== null ? (
        <div className="flex items-center justify-between rounded-md bg-[var(--club-primary-soft)] px-4 py-3">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            {t("section.tips.average")}
          </span>
          <span className="font-mono text-base font-semibold tabular-nums text-[var(--club-primary)]">
            {overall.toFixed(2)}/5
          </span>
        </div>
      ) : null}

      {(strengths.length > 0 || improvements.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {strengths.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                {t("section.bullets.strengths")}
              </h3>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] text-zinc-700 dark:text-zinc-300">
                {strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {improvements.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                {t("section.bullets.improvements")}
              </h3>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] text-zinc-700 dark:text-zinc-300">
                {improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {data.appreciation.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("section.appreciation.eyebrow")}
          </span>
          {data.appreciation.map((a) => (
            <span
              key={a}
              className="rounded-full border border-[var(--club-line)] bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {t(`list.appreciation.${a}`)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
