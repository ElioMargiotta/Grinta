import type { LicenseState } from "@/lib/license/types";

const STATE_STYLES: Record<LicenseState, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  grace: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  locked: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

export function StateBadge({ state, label }: { state: LicenseState; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATE_STYLES[state]}`}
    >
      {label}
    </span>
  );
}

/** Renders "used / max" with a thin progress bar; "used" alone when unlimited. */
export function UsageMeter({
  used,
  max,
  label,
}: {
  used: number;
  max: number | null;
  label: string;
}) {
  const pct = max && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const atLimit = max !== null && used >= max;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={`text-sm font-semibold tabular-nums ${atLimit ? "text-destructive" : "text-foreground"}`}
        >
          {used}
          {max !== null && <span className="text-muted-foreground"> / {max}</span>}
        </span>
      </div>
      {max !== null && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={atLimit ? "h-full bg-destructive" : "h-full bg-foreground"}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(new Date(iso));
}

/** Compact relative time ("aujourd'hui", "il y a 3 j", "il y a 2 mois"). */
export function formatRelative(iso: string | null, neverLabel = "Jamais"): string {
  if (!iso) return neverLabel;
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} j`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return `il y a ${Math.floor(days / 365)} an${days >= 730 ? "s" : ""}`;
}
