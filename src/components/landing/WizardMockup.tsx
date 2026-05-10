"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";

const KIND_COLORS: Record<string, string> = {
  preparation: "#0ea5e9",
  competition: "#dc2626",
  transition: "#f59e0b",
  custom: "#64748b",
};
const KIND_LABEL: Record<string, string> = {
  preparation: "Préparation",
  competition: "Compétition",
  transition: "Transition",
  custom: "Custom",
};

type Meso = {
  id: string;
  name: string;
  kind: keyof typeof KIND_COLORS;
  weekCount: number;
  color: string;
};

function mondayOfISO(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt;
}

const inputCls =
  "h-10 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] text-zinc-800 outline-none focus:border-zinc-400 transition-colors";

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
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-zinc-700">{label}</span>
      {children}
      {hint && (
        <span className="text-[11px] text-zinc-400 leading-snug">{hint}</span>
      )}
    </label>
  );
}

export function WizardMockup() {
  const [name, setName] = useState("1er tour");
  const [preseasonStart, setPreseasonStart] = useState("2025-07-14");
  const [firstMatch, setFirstMatch] = useState("2025-08-23");
  const [endDate, setEndDate] = useState("2025-12-21");
  const [mesos, setMesos] = useState<Meso[]>([
    { id: "m1", name: "Préparation", kind: "preparation", weekCount: 6, color: KIND_COLORS.preparation },
    { id: "m2", name: "Compétition", kind: "competition", weekCount: 13, color: KIND_COLORS.competition },
    { id: "m3", name: "Transition", kind: "transition", weekCount: 4, color: KIND_COLORS.transition },
  ]);

  const totalWeeks = useMemo(() => {
    const a = mondayOfISO(preseasonStart);
    const b = mondayOfISO(endDate);
    if (!a || !b) return null;
    const w = Math.round((b.getTime() - a.getTime()) / (7 * 86_400_000)) + 1;
    return w > 0 ? w : null;
  }, [preseasonStart, endDate]);

  const sumWeeks = mesos.reduce((s, m) => s + (m.weekCount || 0), 0);
  const weekDelta = totalWeeks !== null ? sumWeeks - totalWeeks : 0;
  const balanced = weekDelta === 0 && totalWeeks !== null;

  const updateMeso = (id: string, patch: Partial<Meso>) =>
    setMesos((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeMeso = (id: string) =>
    setMesos((p) => p.filter((m) => m.id !== id));
  const addMeso = () =>
    setMesos((p) => [
      ...p,
      {
        id: "m" + Date.now(),
        name: "Nouveau mésocycle",
        kind: "custom",
        weekCount: 1,
        color: KIND_COLORS.custom,
      },
    ]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-[0_30px_70px_-30px_rgba(24,24,27,.25)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 bg-zinc-50/60">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
          <span className="ml-3 font-mono text-[10.5px] uppercase tracking-widest text-zinc-500">
            grinta / planner / setup
          </span>
        </div>
        <span className="text-[10.5px] font-mono text-zinc-400">
          démo interactive
        </span>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight text-zinc-900">
              Configure ta saison
            </h3>
            <p className="mt-1 text-[12.5px] text-zinc-500 leading-relaxed">
              Ancre ton macrocycle sur des dates réelles pour numéroter les
              semaines correctement (-3, -2, -1, +1, +2…).
            </p>
          </div>
          <div
            className={
              "shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium font-mono tabular-nums transition-colors " +
              (totalWeeks === null
                ? "bg-zinc-100 text-zinc-500"
                : balanced
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700")
            }
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: balanced
                  ? "#059669"
                  : totalWeeks === null
                    ? "#a1a1aa"
                    : "#d97706",
              }}
            />
            {totalWeeks === null
              ? "Choisis les dates"
              : `${sumWeeks}/${totalWeeks} semaines${
                  balanced
                    ? " ✓"
                    : weekDelta > 0
                      ? ` (+${weekDelta})`
                      : ` (${weekDelta})`
                }`}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nom du tour">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div />
          <Field
            label="Début de la préparation"
            hint="Premier lundi de la semaine -N (calé au lundi)."
          >
            <input
              type="date"
              className={inputCls}
              value={preseasonStart}
              onChange={(e) => setPreseasonStart(e.target.value)}
            />
          </Field>
          <Field
            label="Premier match"
            hint="La semaine contenant cette date devient la semaine +1."
          >
            <input
              type="date"
              className={inputCls}
              value={firstMatch}
              onChange={(e) => setFirstMatch(e.target.value)}
            />
          </Field>
          <Field label="Date de fin" hint="Dernière semaine du macrocycle.">
            <input
              type="date"
              className={inputCls}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-7">
          <div className="flex items-center justify-between">
            <h4 className="text-[13px] font-semibold text-zinc-900">
              Mésocycles
            </h4>
            <span className="text-[10.5px] font-mono text-zinc-400 tabular-nums">
              {mesos.length} mésocycles · {sumWeeks} semaines
            </span>
          </div>

          <div className="mt-3 h-2 rounded-full bg-zinc-100 overflow-hidden flex">
            {mesos.map((m) => {
              const w = totalWeeks
                ? Math.min(
                    100,
                    (m.weekCount / Math.max(sumWeeks, totalWeeks)) * 100,
                  )
                : (m.weekCount / sumWeeks) * 100;
              return (
                <span
                  key={m.id}
                  className="h-full transition-all duration-500"
                  style={{ width: w + "%", background: m.color }}
                />
              );
            })}
            {!balanced && totalWeeks && weekDelta < 0 && (
              <span
                className="h-full bg-zinc-200/60 transition-all duration-500"
                style={{ width: ((-weekDelta) / totalWeeks) * 100 + "%" }}
              />
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {mesos.map((m) => (
              <div
                key={m.id}
                className="group flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 transition-colors hover:bg-zinc-50"
              >
                <input
                  type="color"
                  value={m.color}
                  onChange={(e) =>
                    updateMeso(m.id, { color: e.target.value })
                  }
                  className="h-9 w-9 cursor-pointer rounded-md border border-zinc-200 bg-transparent shrink-0"
                  aria-label="color"
                />
                <Field label="Nom">
                  <input
                    className={inputCls + " min-w-[160px]"}
                    value={m.name}
                    onChange={(e) =>
                      updateMeso(m.id, { name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Type">
                  <select
                    value={m.kind}
                    onChange={(e) => {
                      const kind = e.target.value as keyof typeof KIND_COLORS;
                      updateMeso(m.id, {
                        kind,
                        color: KIND_COLORS[kind] || m.color,
                      });
                    }}
                    className={inputCls + " pr-7 cursor-pointer"}
                  >
                    {Object.keys(KIND_LABEL).map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Semaines">
                  <input
                    type="number"
                    min={1}
                    className={inputCls + " w-20"}
                    value={m.weekCount}
                    onChange={(e) =>
                      updateMeso(m.id, {
                        weekCount: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => removeMeso(m.id)}
                  disabled={mesos.length <= 1}
                  className="ml-auto h-9 px-3 rounded-md text-[12px] text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addMeso}
            className="mt-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-zinc-200 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Ajouter un mésocycle
          </button>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 pt-5 border-t border-zinc-100">
          <p
            className={
              "text-[12px] " +
              (balanced ? "text-emerald-700" : "text-zinc-500")
            }
          >
            {balanced
              ? "Tout est calé. Plus qu'à créer la saison."
              : totalWeeks === null
                ? "Saisis les trois dates pour activer la création."
                : weekDelta > 0
                  ? `Tu as ${weekDelta} semaine${Math.abs(weekDelta) > 1 ? "s" : ""} de trop dans tes mésocycles.`
                  : `Il manque ${-weekDelta} semaine${Math.abs(weekDelta) > 1 ? "s" : ""} pour atteindre le total.`}
          </p>
          <button
            type="button"
            disabled={!balanced}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium text-white transition-all disabled:bg-zinc-300 disabled:cursor-not-allowed"
            style={{ background: balanced ? "var(--accent)" : undefined }}
          >
            Créer la saison
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
