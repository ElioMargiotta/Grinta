"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fieldVariants } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  addPlatformAdminAction,
  removePlatformAdminAction,
} from "@/app/[locale]/(admin)/admin/actions";
import type { PlatformAdminRow } from "@/lib/admin/queries";

type State = { ok?: true; error?: string } | null;

export function AdminsManager({
  admins,
  currentUserId,
  locale,
}: {
  admins: PlatformAdminRow[];
  currentUserId: string;
  locale: string;
}) {
  const t = useTranslations("admin");
  const [addState, addAction, addPending] = useActionState<State, FormData>(
    async (_prev, formData) => addPlatformAdminAction(formData),
    null,
  );
  const [removeState, removeAction] = useActionState<State, FormData>(
    async (_prev, formData) => removePlatformAdminAction(formData),
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={addAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="locale" value={locale} />
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-foreground">
            {t("admins.addLabel")}
          </span>
          <input
            name="email"
            type="email"
            required
            placeholder="email@exemple.com"
            className={cn(fieldVariants(), "px-3 py-2")}
          />
        </label>
        <Button type="submit" loading={addPending}>
          {addPending ? t("common.saving") : t("admins.add")}
        </Button>
      </form>

      {(addState?.error || removeState?.error) && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {addState?.error || removeState?.error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {admins.map((a) => (
            <li key={a.user_id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <div className="font-medium text-foreground">
                  {a.full_name ?? a.user_id}
                </div>
                {a.note && <div className="text-xs text-muted-foreground">{a.note}</div>}
              </div>
              {a.user_id === currentUserId ? (
                <span className="text-xs text-muted-foreground">{t("admins.you")}</span>
              ) : (
                <form action={removeAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="userId" value={a.user_id} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("admins.remove")}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
