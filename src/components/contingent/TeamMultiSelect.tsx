"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { ClubTeamOption } from "@/lib/contingent/teams";

/**
 * Multi-select des équipes du club sous forme de chips toggle (#39).
 * Émet un `<input type="hidden" name={name} value={teamId}>` par équipe
 * sélectionnée, ce qui s'intègre proprement dans un `<form action={...}>`
 * (côté server action : `formData.getAll("teamIds")`).
 *
 * Utilisé :
 *  - dans `ClubPlayerForm` (création de joueur, picker inline)
 *  - dans `TeamAssignmentsBlock` (édition de joueur, save séparé)
 */
export function TeamMultiSelect({
  teams,
  name,
  defaultValue,
  label,
  emptyHint,
}: {
  teams: ClubTeamOption[];
  name: string;
  defaultValue?: string[];
  label?: string;
  /** Texte affiché quand `teams.length === 0`. */
  emptyHint?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultValue ?? []),
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (teams.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </span>
        )}
        <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
          {emptyHint ?? "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        {teams.map((team) => {
          const isOn = selected.has(team.id);
          return (
            <button
              type="button"
              key={team.id}
              onClick={() => toggle(team.id)}
              aria-pressed={isOn}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                isOn
                  ? "border-[var(--club-primary)] bg-[var(--club-primary-soft)] text-[var(--club-primary)]"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {isOn && <Check className="h-3 w-3" />}
              <span>{team.name}</span>
              {team.age_group && (
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {team.age_group}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Inputs cachés synchronisés avec l'état — la valeur du form data. */}
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </div>
  );
}
