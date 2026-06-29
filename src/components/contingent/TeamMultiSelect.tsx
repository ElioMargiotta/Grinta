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
          <span className="text-sm font-medium text-foreground">
            {label}
          </span>
        )}
        <p className="text-xs italic text-muted-foreground">
          {emptyHint ?? "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-sm font-medium text-foreground">
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
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isOn
                  ? "border-primary bg-accent text-primary"
                  : "border-border bg-card text-foreground hover:border-input"
              }`}
            >
              {isOn && <Check className="h-3 w-3" />}
              <span>{team.name}</span>
              {team.age_group && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
