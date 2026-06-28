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
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    // Small delay so the cursor can travel from button to menu items
    // without the menu disappearing under it.
    closeTimerRef.current = setTimeout(() => setOpen(false), 120);
  };

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

  useEffect(() => () => cancelClose(), []);

  return (
    <div
      ref={wrapperRef}
      className="group relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          // pt-2 acts as an invisible "bridge" so the cursor never lands
          // in dead space between the button and the first menu item.
          className="absolute right-0 z-20 w-72 pt-2"
        >
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <Link
            href="/contingent/new"
            role="menuitem"
            className="flex items-start gap-3 px-4 py-3 text-sm transition hover:bg-accent"
            onClick={() => setOpen(false)}
          >
            <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex flex-col">
              <span className="font-medium text-foreground">
                {t("manual")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("manualHint")}
              </span>
            </span>
          </Link>
          <Link
            href="/contingent/import"
            role="menuitem"
            className="flex items-start gap-3 border-t border-border px-4 py-3 text-sm transition hover:bg-accent"
            onClick={() => setOpen(false)}
          >
            <FileUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex flex-col">
              <span className="font-medium text-foreground">
                {t("import")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("importHint")}
              </span>
            </span>
          </Link>
        </div>
        </div>
      )}
    </div>
  );
}
