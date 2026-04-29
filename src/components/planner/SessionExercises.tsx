"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  attachExerciseAction,
  detachExerciseAction,
} from "@/app/[locale]/(app)/planner/actions";

type SessionExercise = {
  id: string;
  order_index: number;
  exercise: { id: string; name: string; duration_minutes: number | null; category: string | null };
};

type LibraryExercise = { id: string; name: string };

export function SessionExercises({
  sessionId,
  teamId,
  attached,
  library,
}: {
  sessionId: string;
  teamId: string;
  attached: SessionExercise[];
  library: LibraryExercise[];
}) {
  const t = useTranslations("planner.session");
  const locale = useLocale();
  const [selected, setSelected] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const sorted = [...attached].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {t("exercises")}
      </h2>

      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("noExercises")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {sorted.map((se, i) => (
            <li key={se.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400">{i + 1}.</span>
                <span className="text-sm text-zinc-900 dark:text-zinc-100">
                  {se.exercise.name}
                </span>
                {se.exercise.duration_minutes && (
                  <span className="text-xs text-zinc-500">
                    {se.exercise.duration_minutes} min
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("id", se.id);
                  fd.set("sessionId", sessionId);
                  fd.set("teamId", teamId);
                  fd.set("locale", locale);
                  startTransition(async () => {
                    await detachExerciseAction(fd);
                  });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {library.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select
              id="exerciseId"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">—</option>
              {library.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            disabled={!selected || isPending}
            onClick={() => {
              const fd = new FormData();
              fd.set("sessionId", sessionId);
              fd.set("exerciseId", selected);
              fd.set("teamId", teamId);
              fd.set("locale", locale);
              startTransition(async () => {
                await attachExerciseAction(fd);
                setSelected("");
              });
            }}
          >
            {t("addExercise")}
          </Button>
        </div>
      )}
    </div>
  );
}
