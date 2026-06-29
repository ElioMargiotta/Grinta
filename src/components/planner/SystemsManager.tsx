"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  deleteSystemAction,
  duplicateSystemAction,
} from "@/app/[locale]/(app)/systems/[teamId]/actions";

export type SystemCard = {
  id: string;
  name: string;
  formation: string;
  playerCount: number;
  phaseCount: number;
};

export function SystemsManager({
  teamId,
  systems,
}: {
  teamId: string;
  systems: SystemCard[];
}) {
  const t = useTranslations("planner.systems");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function open(id: string) {
    router.push(`/systems/${teamId}/${id}`);
  }

  function duplicate(id: string) {
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("systemId", id);
    startTransition(async () => {
      await duplicateSystemAction(fd);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("systemId", id);
    startTransition(async () => {
      await deleteSystemAction(fd);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        <Button
          type="button"
          size="sm"
          onClick={() => router.push(`/systems/${teamId}/new`)}
        >
          <Plus className="h-3.5 w-3.5" />
          {t("new")}
        </Button>
      </div>

      {systems.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {systems.map((s) => (
            <li
              key={s.id}
              className="group flex flex-col gap-3 rounded-lg border border-border bg-card/[0.78] p-4 transition hover:border-primary"
            >
              <button
                type="button"
                onClick={() => open(s.id)}
                className="flex items-start justify-between gap-2 text-left"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {s.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="rounded bg-accent px-1.5 py-0.5 font-medium text-primary">
                      {s.formation}
                    </span>
                    <span>{t("playerCount", { count: s.playerCount })}</span>
                    <span>·</span>
                    <span>{t("phaseCount", { count: s.phaseCount })}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
              </button>
              <div className="flex items-center gap-2 border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => duplicate(s.id)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {t("duplicate")}
                </button>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
