"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, FileUp, Plus, UserPlus } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * "+ Ajouter" trigger on the Contingent list page. Opens on click or hover
 * and routes to /contingent/new (manual form) or /contingent/import (CSV).
 * Plain CSS for the hover-open; native click handler for the click-open.
 * Closes on outside click.
 */
export function AddPlayerMenu() {
  const t = useTranslations("contingent.addMenu");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="group relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--club-primary)] px-3 py-2 text-sm font-medium text-[var(--club-primary-foreground)] shadow-sm transition hover:brightness-110"
      >
        <Plus className="h-4 w-4" />
        {t("trigger")}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          <Link
            href="/contingent/new"
            role="menuitem"
            className="flex items-start gap-3 px-4 py-3 text-sm transition hover:bg-[var(--club-primary-soft)]"
            onClick={() => setOpen(false)}
          >
            <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            <span className="flex flex-col">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {t("manual")}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {t("manualHint")}
              </span>
            </span>
          </Link>
          <Link
            href="/contingent/import"
            role="menuitem"
            className="flex items-start gap-3 border-t border-zinc-100 px-4 py-3 text-sm transition hover:bg-[var(--club-primary-soft)] dark:border-zinc-800"
            onClick={() => setOpen(false)}
          >
            <FileUp className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            <span className="flex flex-col">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {t("import")}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {t("importHint")}
              </span>
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
