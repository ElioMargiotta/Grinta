"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";

const MAX_RESULTS = 30;

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Picker contrôlé de clubs tenants EXISTANTS (par id). Sert à composer un
 * regroupement. Rend des chips (nom du club) + une recherche.
 */
export function ClubMultiSelect({
  clubs,
  value,
  onChange,
}: {
  clubs: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations("admin");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const nameById = useMemo(
    () => new Map(clubs.map((c) => [c.id, c.name] as const)),
    [clubs],
  );

  const suggestions = useMemo(() => {
    const q = norm(query.trim());
    const selected = new Set(value);
    return clubs
      .filter((c) => !selected.has(c.id))
      .filter((c) => !q || norm(c.name).includes(q))
      .slice(0, MAX_RESULTS);
  }, [clubs, query, value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function add(id: string) {
    if (value.includes(id)) return;
    onChange([...value, id]);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted py-1 pl-3 pr-1 text-sm text-foreground"
            >
              <span>{nameById.get(id) ?? "—"}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== id))}
                aria-label={t("regroupements.removeClub")}
                className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          autoComplete="off"
          value={query}
          placeholder={t("regroupements.searchClub")}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
        />

        {open && (
          <ul
            role="listbox"
            className="absolute top-full z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg"
          >
            {suggestions.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {t("regroupements.noClub")}
              </li>
            )}
            {suggestions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(c.id);
                  }}
                  className="flex w-full items-center px-3 py-1.5 text-left text-sm text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
