"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { fieldVariants } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  createClubGroupAction,
  updateClubGroupAction,
} from "@/app/[locale]/(admin)/admin/actions";
import { ClubMultiSelect } from "@/components/admin/ClubMultiSelect";
import type {
  ClubGroupCategory,
  ClubGroupSubcategory,
} from "@/lib/admin/queries";

type State = { ok?: true; error?: string } | null;

const CATEGORIES: ClubGroupCategory[] = ["hommes_actifs", "femmes", "seniors", "juniors"];
const SUBCATEGORIES: Record<"seniors" | "juniors", ClubGroupSubcategory[]> = {
  seniors: ["s30", "s40", "s50"],
  juniors: ["jg", "jf"],
};

export function ClubGroupForm({
  locale,
  clubs,
  initial,
}: {
  locale: string;
  clubs: { id: string; name: string }[];
  initial?: {
    groupId: string;
    name: string;
    category: ClubGroupCategory | null;
    subcategory: ClubGroupSubcategory | null;
    memberIds: string[];
    maxTeams: number | null;
    maxPlayers: number | null;
    maxStaff: number | null;
  };
}) {
  const t = useTranslations("admin");
  const [members, setMembers] = useState<string[]>(initial?.memberIds ?? []);
  const [category, setCategory] = useState<ClubGroupCategory | "">(initial?.category ?? "");
  const [subcategory, setSubcategory] = useState<string>(initial?.subcategory ?? "");
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) =>
      initial ? updateClubGroupAction(formData) : createClubGroupAction(formData),
    null,
  );

  const hasSub = category === "seniors" || category === "juniors";
  const maxMembers = category === "hommes_actifs" ? 2 : 6;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      {initial && <input type="hidden" name="groupId" value={initial.groupId} />}
      <input type="hidden" name="memberClubIds" value={JSON.stringify(members)} />

      <Field label={t("regroupements.name")} hint={t("regroupements.nameHint")}>
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={initial?.name ?? ""}
          className={inputCls}
        />
      </Field>

      <fieldset className={cn("grid gap-3", hasSub ? "grid-cols-2" : "grid-cols-1")}>
        <Field label={t("regroupements.category")} hint={t("regroupements.categoryHint")}>
          <select
            name="category"
            required
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as ClubGroupCategory | "");
              setSubcategory("");
            }}
            className={inputCls}
          >
            <option value="" disabled>
              {t("regroupements.categoryPlaceholder")}
            </option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`regroupements.categoryLabels.${c}`)}
              </option>
            ))}
          </select>
        </Field>
        {hasSub && (
          <Field label={t("regroupements.subcategory")}>
            <select
              name="subcategory"
              required
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className={inputCls}
            >
              <option value="" disabled>
                {t("regroupements.subcategoryPlaceholder")}
              </option>
              {SUBCATEGORIES[category as "seniors" | "juniors"].map((s) => (
                <option key={s} value={s}>
                  {t(`regroupements.subcategoryLabels.${s}`)}
                </option>
              ))}
            </select>
          </Field>
        )}
      </fieldset>

      <Field
        label={t("regroupements.members")}
        hint={t("regroupements.membersMaxHint", { max: maxMembers })}
      >
        <ClubMultiSelect clubs={clubs} value={members} onChange={setMembers} />
      </Field>

      <fieldset className="grid grid-cols-3 gap-3">
        <Field label={t("license.maxTeams")} hint={t("license.unlimitedHint")}>
          <input
            name="maxTeams"
            type="number"
            min={0}
            defaultValue={initial?.maxTeams ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label={t("license.maxPlayers")}>
          <input
            name="maxPlayers"
            type="number"
            min={0}
            defaultValue={initial?.maxPlayers ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label={t("license.maxStaff")}>
          <input
            name="maxStaff"
            type="number"
            min={0}
            defaultValue={initial?.maxStaff ?? ""}
            className={inputCls}
          />
        </Field>
      </fieldset>

      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
          {t("common.saved")}
        </p>
      )}

      <Button type="submit" loading={pending} className="self-start">
        {pending
          ? t("common.saving")
          : initial
            ? t("common.save")
            : t("regroupements.create")}
      </Button>
    </form>
  );
}

const inputCls = cn(fieldVariants(), "px-3 py-2");

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
