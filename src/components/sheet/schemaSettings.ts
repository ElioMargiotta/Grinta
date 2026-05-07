"use client";

import { useEffect, useState } from "react";

/* ============================================================
 * Schema settings — symbol size + color palette shared across
 * every <SchemaEditor> / <SchemaView> in the app. Persisted in
 * localStorage so a coach's preferences survive between sessions
 * and apply to every schema (initial phases, main blocks, jeu).
 * ============================================================ */

export type SchemaColors = {
  home: string;
  away: string;
  gk: string;
  ball: string;
  cone: string;
  line: string;
  arrow: string;
};

export type SchemaSettings = {
  /** multiplier on player / ball / cone / goal radii (1 = default) */
  symbolSize: number;
  /** stroke width (in viewBox units) of the line tool */
  lineWidth: number;
  /** stroke width (in viewBox units) of arrows */
  arrowWidth: number;
  colors: SchemaColors;
};

export const DEFAULT_SCHEMA_SETTINGS: SchemaSettings = {
  symbolSize: 1,
  lineWidth: 0.6,
  arrowWidth: 1.2,
  colors: {
    home: "#dc2626",
    away: "#1d4ed8",
    gk: "#facc15",
    ball: "#111827",
    cone: "#f97316",
    line: "#111827",
    arrow: "#111827",
  },
};

const STORAGE_KEY = "grinta.schemaSettings.v1";
const CHANGE_EVENT = "grinta:schema-settings-changed";

function readStoredSettings(): SchemaSettings {
  if (typeof window === "undefined") return DEFAULT_SCHEMA_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCHEMA_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SchemaSettings> & {
      colors?: Partial<SchemaColors>;
    };
    return {
      ...DEFAULT_SCHEMA_SETTINGS,
      ...parsed,
      colors: { ...DEFAULT_SCHEMA_SETTINGS.colors, ...(parsed.colors ?? {}) },
    };
  } catch {
    return DEFAULT_SCHEMA_SETTINGS;
  }
}

export function useSchemaSettings(): [
  SchemaSettings,
  (next: SchemaSettings) => void,
] {
  const [settings, setSettings] = useState<SchemaSettings>(
    DEFAULT_SCHEMA_SETTINGS,
  );

  useEffect(() => {
    setSettings(readStoredSettings());
    const sync = () => setSettings(readStoredSettings());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function update(next: SchemaSettings) {
    setSettings(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      /* ignore quota / privacy mode */
    }
  }

  return [settings, update];
}
