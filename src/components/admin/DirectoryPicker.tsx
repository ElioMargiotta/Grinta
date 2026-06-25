"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { DirectoryClub } from "@/lib/admin/queries";

const MAX_RESULTS = 100;

// Strip combining diacritical marks (U+0300–U+036F) for accent-insensitive search.
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Searchable, accent-insensitive combobox over the (large) club directory.
 * Filters by name or ASF number, optionally narrowed to one association, with
 * results grouped by association. Already-onboarded clubs are shown disabled.
 */
export function DirectoryPicker({
  clubs,
  value,
  onSelect,
}: {
  clubs: DirectoryClub[];
  value: string;
  onSelect: (id: string, name: string) => void;
}) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const selected = useMemo(() => clubs.find((c) => c.id === value) ?? null, [clubs, value]);

  const regions = useMemo(
    () => [...new Set(clubs.map((c) => c.association))].sort(),
    [clubs],
  );

  // Filtered + capped result set.
  const { groups, total, selectable, flatIndexById } = useMemo(() => {
    const q = norm(query.trim());
    const matches = clubs.filter((c) => {
      if (region && c.association !== region) return false;
      if (!q) return true;
      return norm(c.name).includes(q) || c.asf_number.includes(q);
    });
    const capped = matches.slice(0, MAX_RESULTS);

    // Group by association, preserving order, and assign a flat index to every
    // selectable (non-linked) row for keyboard navigation.
    const map = new Map<string, DirectoryClub[]>();
    for (const c of capped) {
      const arr = map.get(c.association) ?? [];
      arr.push(c);
      map.set(c.association, arr);
    }
    const sel: DirectoryClub[] = capped.filter((c) => !c.linked);
    return {
      groups: [...map.entries()],
      total: matches.length,
      selectable: sel,
      flatIndexById: new Map(sel.map((c, i) => [c.id, i] as const)),
    };
  }, [clubs, query, region]);

  // Clamp the highlighted index for reads without mutating state in an effect.
  const activeIdx = selectable.length ? Math.min(active, selectable.length - 1) : 0;

  useEffect(() => {
    if (open) optionRefs.current[activeIdx]?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(c: DirectoryClub) {
    if (c.linked) return;
    onSelect(c.id, c.name);
    setOpen(false);
    setQuery("");
  }

  function clear() {
    onSelect("", "");
    setQuery("");
    setOpen(true);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, selectable.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && selectable[activeIdx]) {
        e.preventDefault();
        choose(selectable[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative shrink-0">
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            className="h-full appearance-none rounded-lg border border-zinc-300 bg-white py-2 pl-3 pr-8 text-sm text-zinc-700 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            aria-label={t("clubs.directoryAllRegions")}
          >
            <option value="">{t("clubs.directoryAllRegions")}</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        </div>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="directory-listbox"
            autoComplete="off"
            value={open ? query : selected ? `${selected.name} (${selected.asf_number})` : query}
            placeholder={t("clubs.directorySearchPlaceholder")}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-9 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          {selected && (
            <button
              type="button"
              onClick={clear}
              aria-label={t("clubs.directoryClear")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {open && (
        <ul
          id="directory-listbox"
          role="listbox"
          className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {groups.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
              {t("clubs.directoryNoResults")}
            </li>
          )}
          {groups.map(([association, items]) => (
            <li key={association}>
              <div className="sticky top-0 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:bg-zinc-800/80">
                {association}
              </div>
              <ul>
                {items.map((c) => {
                  if (c.linked) {
                    return (
                      <li
                        key={c.id}
                        role="option"
                        aria-disabled
                        aria-selected={false}
                        className="flex cursor-not-allowed items-center justify-between px-3 py-1.5 text-sm text-zinc-300 dark:text-zinc-600"
                      >
                        <span>
                          {c.name} <span className="tabular-nums">({c.asf_number})</span>
                        </span>
                        <span className="text-[11px]">{t("clubs.directoryLinked")}</span>
                      </li>
                    );
                  }
                  const idx = flatIndexById.get(c.id) ?? -1;
                  const isActive = idx === activeIdx;
                  const isSelected = c.id === value;
                  return (
                    <li
                      key={c.id}
                      role="option"
                      aria-selected={isSelected}
                      ref={(el) => {
                        optionRefs.current[idx] = el;
                      }}
                      onMouseEnter={() => setActive(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        choose(c);
                      }}
                      className={`flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm ${
                        isActive
                          ? "bg-zinc-100 dark:bg-zinc-800"
                          : "text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      <span>
                        {c.name}{" "}
                        <span className="tabular-nums text-zinc-400">({c.asf_number})</span>
                      </span>
                      {isSelected && <Check className="h-4 w-4 text-zinc-500" />}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {total > MAX_RESULTS && (
            <li className="px-3 py-1.5 text-[11px] text-zinc-400">
              {t("clubs.directoryMore", { count: total - MAX_RESULTS })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
