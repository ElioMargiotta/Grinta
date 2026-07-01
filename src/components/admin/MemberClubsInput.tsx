"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search, X } from "lucide-react";
import type { DirectoryClub } from "@/lib/admin/queries";

const MAX_CLUBS = 12;
const MAX_RESULTS = 30;

// Recherche insensible aux accents (retire les diacritiques U+0300–U+036F).
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Éditeur de la liste (informative) des clubs composant un regroupement.
 * Noms libres, avec suggestions issues de l'annuaire ASF. Sérialise la liste
 * dans un input caché JSON (`name`, défaut "memberClubs").
 */
export function MemberClubsInput({
  directory,
  initial = [],
  name = "memberClubs",
}: {
  directory: DirectoryClub[];
  initial?: string[];
  name?: string;
}) {
  const t = useTranslations("admin");
  const [clubs, setClubs] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    const seen = new Set(clubs.map((c) => norm(c)));
    return directory
      .filter((c) => {
        if (seen.has(norm(c.name))) return false;
        return norm(c.name).includes(q) || c.asf_number.includes(q);
      })
      .slice(0, MAX_RESULTS);
  }, [directory, query, clubs]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function add(value: string) {
    const v = value.trim();
    if (!v) return;
    setClubs((prev) => {
      if (prev.length >= MAX_CLUBS || prev.some((c) => norm(c) === norm(v))) return prev;
      return [...prev, v];
    });
    setQuery("");
    setOpen(false);
  }

  function remove(value: string) {
    setClubs((prev) => prev.filter((c) => c !== value));
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-2">
      <input type="hidden" name={name} value={JSON.stringify(clubs)} />

      {clubs.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {clubs.map((c) => (
            <li
              key={c}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted py-1 pl-3 pr-1 text-sm text-foreground"
            >
              <span>{c}</span>
              <button
                type="button"
                onClick={() => remove(c)}
                aria-label={t("clubs.memberClubsRemove")}
                className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {clubs.length < MAX_CLUBS && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            autoComplete="off"
            value={query}
            placeholder={t("clubs.memberClubsPlaceholder")}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(query);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
          />

          {open && query.trim() && (
            <ul
              role="listbox"
              className="absolute top-full z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg"
            >
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(c.name);
                    }}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <span>
                      {c.name}{" "}
                      <span className="tabular-nums text-muted-foreground">({c.asf_number})</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">{c.association}</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(query);
                  }}
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm text-primary hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("clubs.memberClubsAddFree", { name: query.trim() })}
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
