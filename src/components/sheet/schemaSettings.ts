"use client";

import { useEffect, useState } from "react";

/* ============================================================
 * Schema settings — symbol size + colour palette shared across
 * every <SchemaEditor> / <SchemaView> in the app. Persisted in
 * localStorage under a per-zone key so the warm-up, blocks, and
 * jeu final each remember their own defaults.
 * ============================================================ */

export type SchemaSettingsKey = "warmup" | "block" | "game" | "default";

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

const STORAGE_KEY_PREFIX = "grinta.schemaSettings.v1.";
const LEGACY_STORAGE_KEY = "grinta.schemaSettings.v1";
const CHANGE_EVENT = "grinta:schema-settings-changed";

function storageKeyFor(key: SchemaSettingsKey) {
  return STORAGE_KEY_PREFIX + key;
}

function readStoredSettings(key: SchemaSettingsKey): SchemaSettings {
  if (typeof window === "undefined") return DEFAULT_SCHEMA_SETTINGS;
  try {
    const raw =
      window.localStorage.getItem(storageKeyFor(key)) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY);
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

export function useSchemaSettings(
  key: SchemaSettingsKey = "default",
): [SchemaSettings, (next: SchemaSettings) => void] {
  const [settings, setSettings] = useState<SchemaSettings>(
    DEFAULT_SCHEMA_SETTINGS,
  );

  useEffect(() => {
    // Réhydratation depuis localStorage au montage (évite le mismatch SSR) —
    // setState volontaire ici.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(readStoredSettings(key));
    const onChange = (e: Event) => {
      // Only re-read if the change targets our key (or storage event from
      // another tab — those don't carry detail, so always re-read).
      if (e.type === CHANGE_EVENT) {
        const detail = (e as CustomEvent<{ key?: SchemaSettingsKey }>).detail;
        if (detail && detail.key && detail.key !== key) return;
      }
      setSettings(readStoredSettings(key));
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [key]);

  function update(next: SchemaSettings) {
    setSettings(next);
    try {
      window.localStorage.setItem(storageKeyFor(key), JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent(CHANGE_EVENT, { detail: { key } }),
      );
    } catch {
      /* ignore quota / privacy mode */
    }
  }

  return [settings, update];
}
