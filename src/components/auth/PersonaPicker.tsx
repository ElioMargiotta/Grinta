"use client";

import { Check, ClipboardList, LineChart, Users } from "lucide-react";
import { useTranslations } from "next-intl";

export type PersonaChoice = "staff" | "player" | "parent";

const PERSONA_OPTIONS = [
  { value: "staff", icon: ClipboardList },
  { value: "player", icon: LineChart },
  { value: "parent", icon: Users },
] as const;

/**
 * Sélecteur de profil affiché dans le panneau gauche immersif de l'inscription.
 * La carte active porte la couleur de marque ; le panneau parent recolore son
 * fond (blobs) en fonction du `value` pour matérialiser le choix.
 */
export function PersonaPicker({
  value,
  onChange,
}: {
  value: PersonaChoice;
  onChange: (next: PersonaChoice) => void;
}) {
  const t = useTranslations("auth");

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="eyebrow-mono">{t("accountTypePrompt")}</p>
        <p className="mt-2 text-xs text-[var(--ink-3)]">{t("accountTypeHelp")}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {PERSONA_OPTIONS.map(({ value: option, icon: Icon }) => {
          const active = value === option;
          const titleKey = `accountType${option[0].toUpperCase()}${option.slice(1)}`;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={active}
              className={`group flex items-start gap-3 rounded-2xl border p-3.5 text-left backdrop-blur-sm transition-all ${
                active
                  ? "border-[var(--brand)] bg-[color-mix(in_oklch,var(--paper)_72%,transparent)] shadow-lg shadow-black/[0.06]"
                  : "border-[var(--line)] bg-[color-mix(in_oklch,var(--paper)_42%,transparent)] hover:border-[var(--line-2)] hover:bg-[color-mix(in_oklch,var(--paper)_58%,transparent)]"
              }`}
            >
              <span
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  active
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[color-mix(in_oklch,var(--paper)_70%,transparent)] text-[var(--ink-2)] group-hover:text-[var(--ink)]"
                }`}
              >
                <Icon className="h-[19px] w-[19px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--ink)]">
                    {t(titleKey)}
                  </span>
                  {active && (
                    <Check className="h-4 w-4 shrink-0 text-[var(--brand)]" />
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-[var(--ink-2)]">
                  {t(`${titleKey}Desc`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
