"use client";

import { useTranslations } from "next-intl";

export type TacticsValue = {
  general: string;
  possession: string;
  defense: string;
  transition: string;
};

const FIELDS: (keyof TacticsValue)[] = [
  "general",
  "possession",
  "defense",
  "transition",
];

export function MatchTactics({
  value,
  onChange,
}: {
  value: TacticsValue;
  onChange: (next: TacticsValue) => void;
}) {
  const t = useTranslations("planner.match.prematch.tactics");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FIELDS.map((field) => (
        <div key={field} className="flex flex-col gap-1">
          <label
            htmlFor={`tactics-${field}`}
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t(field)}
          </label>
          <textarea
            id={`tactics-${field}`}
            rows={3}
            value={value[field]}
            onChange={(e) => onChange({ ...value, [field]: e.target.value })}
            placeholder={t(`${field}Placeholder`)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      ))}
    </div>
  );
}
