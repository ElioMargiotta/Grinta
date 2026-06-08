"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MatchEditor, type EditableMatch } from "@/components/teams/MatchEditor";
import { PeriodizationSettingsForm } from "@/components/teams/PeriodizationSettingsForm";
import {
  disconnectCalendarAction,
  saveCalendarUrlAction,
  syncCalendarNowAction,
  uploadCalendarFileAction,
} from "@/app/[locale]/(app)/teams/[teamId]/calendar/actions";
import { deleteMatchAction } from "@/app/[locale]/(app)/teams/[teamId]/calendar/match-actions";

type Slot = "first_round" | "second_round" | "full";
const SLOTS: Slot[] = ["first_round", "second_round", "full"];

type Subscription = {
  id: string;
  slot: Slot;
  ics_url: string;
  last_synced_at: string | null;
  last_status: string | null;
  last_error: string | null;
  event_count: number;
};

type Match = EditableMatch & {
  ends_at: string | null;
  match_url: string | null;
};

type Periodization = {
  training_weekdays: number[];
  md_scheme: string;
};

type Result = { ok?: true; error?: string; upserted?: number };
type Segment = "first_round" | "second_round" | "full";

export function TeamCalendarSection({
  teamId,
  season,
  subscriptions,
  matches,
  archivedMatches = [],
  periodization,
  variant = "panel",
  showPeriodization = true,
  activeSlot,
  frameStart,
  frameEnd,
  onSwitchFrame,
}: {
  teamId: string;
  season: string;
  subscriptions: Subscription[];
  matches: Match[];
  archivedMatches?: Match[];
  periodization: Periodization | null;
  variant?: "panel" | "plain";
  showPeriodization?: boolean;
  /**
   * Mode « onglet de tour » : affiche les onglets 1er/2e/saison et filtre la
   * liste des matchs au cadre [frameStart, frameEnd] du tour actif.
   */
  activeSlot?: Slot;
  frameStart?: string;
  frameEnd?: string;
  onSwitchFrame?: (segment: Segment) => void;
}) {
  const t = useTranslations("teams.calendar");
  const locale = useLocale();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // null = fermé ; "new" = création ; sinon = id du match en édition.
  const [editing, setEditing] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // En mode onglet, la liste ne montre que les matchs du tour (bornes de date).
  const visibleMatches =
    activeSlot && frameStart && frameEnd
      ? matches.filter((m) => {
          const date = localYmd(m.starts_at);
          return date >= frameStart && date <= frameEnd;
        })
      : matches;

  const onDeleteMatch = (id: string) => {
    if (!confirm(t("match.deleteConfirm"))) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("matchId", id);
    startTransition(async () => {
      const r = await deleteMatchAction(fd);
      if (r?.error) setError(t.has(`match.err.${r.error}`) ? t(`match.err.${r.error}`) : r.error);
      else router.refresh();
    });
  };

  const closeEditorAndRefresh = () => {
    setEditing(null);
    router.refresh();
  };

  const sectionClass =
    variant === "plain"
      ? "border-t border-zinc-200 pt-5"
      : "border-y border-[var(--club-line)] bg-white/[0.78] p-5 md:p-6";

  return (
    <section className={sectionClass}>
      {activeSlot ? null : (
        <div className="mb-5">
          <div className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            <CalendarDays className="h-4 w-4 text-[var(--club-primary)]" />
            {t("title")}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
      )}

      <CalendarImporter teamId={teamId} t={t} />

      <IcsLinksPanel
        teamId={teamId}
        subscriptions={subscriptions}
        t={t}
        locale={locale}
      />

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {t.has(`err.${error}`) ? t(`err.${error}`) : error}
        </p>
      ) : null}

      {/* Ajout d'un match : AVANT les onglets de tour. Le match n'est pas
          rattaché au tour affiché — il se range tout seul dans le bon tour
          selon sa date (comme un flux ICS). Les onglets ne sont qu'un filtre
          visuel pour consulter les confrontations d'un tour. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t("matchesTitle", { n: visibleMatches.length })}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setEditing((e) => (e === "new" ? null : "new"))}
        >
          <Plus className="h-3.5 w-3.5" />
          {t("match.add")}
        </Button>
      </div>

      {editing === "new" ? (
        <div className="mt-3">
          <MatchEditor
            teamId={teamId}
            matches={matches}
            onDone={closeEditorAndRefresh}
            onCancel={() => setEditing(null)}
          />
          <p className="mt-1.5 text-xs text-zinc-500">{t("match.autoTourHint")}</p>
        </div>
      ) : null}

      {activeSlot && onSwitchFrame ? (
        <div className="mt-6">
          <div className="grid grid-cols-3 gap-1">
            {SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSwitchFrame(s)}
                className={`h-7 border-b text-center text-[11px] font-semibold transition ${
                  activeSlot === s
                    ? "border-red-500 text-zinc-950"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"
                }`}
              >
                {t(`slot.${s}`)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        {visibleMatches.length === 0 && editing !== "new" ? (
          <p className="rounded-lg border border-dashed border-[var(--club-line)] bg-white/40 p-4 text-sm text-zinc-500">
            {t("matchesEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--club-line)] border-y border-[var(--club-line)]">
            {visibleMatches.map((m) =>
              editing === m.id ? (
                <li key={m.id} className="py-3">
                  <MatchEditor
                    teamId={teamId}
                    match={m}
                    matches={matches}
                    onDone={closeEditorAndRefresh}
                    onCancel={() => setEditing(null)}
                  />
                </li>
              ) : (
                <MatchRow
                  key={m.id}
                  match={m}
                  locale={locale}
                  t={t}
                  onEdit={() => setEditing(m.id)}
                  onDelete={() => onDeleteMatch(m.id)}
                />
              ),
            )}
          </ul>
        )}
      </div>

      {archivedMatches.length > 0 ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 transition hover:text-zinc-950 dark:text-zinc-300"
          >
            <Archive className="h-3.5 w-3.5" />
            {showHistory ? t("historyHide") : t("historyShow", { n: archivedMatches.length })}
          </button>
          {showHistory ? (
            <>
              <p className="mt-1 text-xs text-zinc-500">{t("historyHint")}</p>
              <ul className="mt-2 flex flex-col divide-y divide-[var(--club-line)] border-y border-[var(--club-line)]">
                {archivedMatches.map((m) => (
                  <ArchivedRow
                    key={m.id}
                    match={m}
                    locale={locale}
                    t={t}
                    onDelete={() => onDeleteMatch(m.id)}
                  />
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {showPeriodization ? (
        <PeriodizationSettingsForm
          teamId={teamId}
          season={season}
          periodization={periodization}
        />
      ) : null}
    </section>
  );
}

/** Ajout d'un calendrier ICS : un champ URL, rangé tout seul dans le bon tour. */
function CalendarImporter({
  teamId,
  t,
}: {
  teamId: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>, clearUrl: boolean) =>
    startTransition(async () => {
      setError(null);
      setDone(false);
      const r = await fn();
      if (r?.error) {
        setError(r.error);
        return;
      }
      if (r?.ok) {
        if (clearUrl) setUrl(""); // champ vidé : prêt pour un autre calendrier
        setDone(true);
        router.refresh();
      }
    });

  const onImport = () => {
    const value = url.trim();
    if (!value) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("url", value);
    run(() => saveCalendarUrlAction(fd), true);
  };

  const onUpload = (file: File) => {
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("file", file);
    run(() => uploadCalendarFileAction(fd), false);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:max-w-xl">
      <div className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {t("addCalendar")}
      </div>
      <Input
        id="ics-url"
        type="url"
        label={t("urlLabel")}
        hint={t("autoRouteHint")}
        placeholder="https://…/calendar.ics"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError(null);
          setDone(false);
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onImport}
          loading={isPending}
          loadingLabel={t("syncing")}
          disabled={!url.trim()}
        >
          {t("saveAndSync")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          {t("uploadFile")}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
        {done && !error ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            {t("importedOk")}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {t.has(`err.${error}`) ? t(`err.${error}`) : error}
        </p>
      ) : null}
    </div>
  );
}

/** Bloc repliable des liens ICS connectés, groupés par tour (1 / 2 / saison). */
function IcsLinksPanel({
  teamId,
  subscriptions,
  t,
  locale,
}: {
  teamId: string;
  subscriptions: Subscription[];
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (subscriptions.length === 0) return null;

  return (
    <div className="mt-3 sm:max-w-xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 transition hover:text-zinc-950 dark:text-zinc-300"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {t("icsLinks")} ({subscriptions.length})
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-3">
          {SLOTS.map((slot) => {
            const subs = subscriptions.filter((s) => s.slot === slot);
            if (subs.length === 0) return null;
            return (
              <div key={slot}>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {t(`slot.${slot}`)}
                </div>
                <ul className="flex flex-col divide-y divide-[var(--club-line)] border-y border-[var(--club-line)]">
                  {subs.map((sub) => (
                    <IcsLinkRow
                      key={sub.id}
                      teamId={teamId}
                      subscription={sub}
                      t={t}
                      locale={locale}
                      onChanged={() => router.refresh()}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Une ligne de lien ICS : hôte, statut, synchro, modifier l'URL, supprimer. */
function IcsLinkRow({
  teamId,
  subscription,
  t,
  locale,
  onChanged,
}: {
  teamId: string;
  subscription: Subscription;
  t: ReturnType<typeof useTranslations>;
  locale: string;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(subscription.ics_url);
  const [isPending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>, onOk?: () => void) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (r?.error) setError(r.error);
      else if (r?.ok) {
        onOk?.();
        onChanged();
      }
    });

  const onSyncNow = () => {
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("subscriptionId", subscription.id);
    run(() => syncCalendarNowAction(fd));
  };
  const onSaveUrl = () => {
    const value = url.trim();
    if (!value) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("subscriptionId", subscription.id);
    fd.set("url", value);
    run(() => saveCalendarUrlAction(fd), () => setEditing(false));
  };
  const onDisconnect = () => {
    if (!confirm(t("disconnectConfirm"))) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("subscriptionId", subscription.id);
    run(() => disconnectCalendarAction(fd));
  };

  return (
    <li className="flex flex-col gap-2 py-2.5">
      {editing ? (
        <div className="flex flex-col gap-2">
          <Input
            id={`ics-edit-${subscription.id}`}
            type="url"
            label={t("urlLabel")}
            placeholder="https://…/calendar.ics"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onSaveUrl}
              loading={isPending}
              loadingLabel={t("syncing")}
              disabled={!url.trim()}
            >
              {t("updateAndSync")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setUrl(subscription.ics_url);
                setEditing(false);
              }}
            >
              {t("cancelUrlEdit")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 truncate text-xs text-zinc-500">
            {maskCalendarUrl(subscription.ics_url)}
          </span>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <SyncStatus
              t={t}
              locale={locale}
              lastSyncedAt={subscription.last_synced_at}
              lastStatus={subscription.last_status}
              eventCount={subscription.event_count}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onSyncNow}
              loading={isPending}
              loadingLabel={t("syncing")}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t("syncNow")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              {t("changeUrl")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDisconnect}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          {t.has(`err.${error}`) ? t(`err.${error}`) : error}
        </p>
      ) : null}
    </li>
  );
}

function ArchivedRow({
  match,
  locale,
  t,
  onDelete,
}: {
  match: Match;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  onDelete: () => void;
}) {
  const start = new Date(match.starts_at);
  const dateStr = start.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const title = match.opponent ?? match.summary ?? "—";
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-28 shrink-0 text-xs font-medium uppercase tracking-wider text-zinc-400">
          {dateStr}
        </span>
        <span className="truncate text-zinc-600 dark:text-zinc-300">{title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {match.home_away ? (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-500 dark:bg-zinc-800">
            {t(`match.${match.home_away}`)}
          </span>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={onDelete} title={t("match.delete")}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

function SyncStatus({
  t,
  locale,
  lastSyncedAt,
  lastStatus,
  eventCount,
}: {
  t: ReturnType<typeof useTranslations>;
  locale: string;
  lastSyncedAt: string | null;
  lastStatus: string | null;
  eventCount: number;
}) {
  const tone =
    lastStatus === "ok"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : lastStatus === "error"
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : "border-zinc-200 bg-zinc-50 text-zinc-600";
  return (
    <div
      className={`flex flex-col items-end gap-0.5 rounded-md border px-3 py-2 text-xs ${tone}`}
    >
      <span className="font-semibold">
        {lastStatus === "ok"
          ? t("statusOk", { n: eventCount })
          : lastStatus === "error"
            ? t("statusError")
            : t("statusPending")}
      </span>
      <span className="text-[11px] opacity-80">
        {lastSyncedAt
          ? t("lastSyncedAt", { when: formatDateTime(lastSyncedAt, locale) })
          : t("neverSynced")}
      </span>
    </div>
  );
}

function maskCalendarUrl(raw: string): string {
  try {
    const url = new URL(raw.replace(/^webcal:/i, "https:"));
    return url.hostname;
  } catch {
    return raw ? "••••••••" : "";
  }
}

function localYmd(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function MatchRow({
  match,
  locale,
  t,
  onEdit,
  onDelete,
}: {
  match: Match;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const start = new Date(match.starts_at);
  const dateStr = start.toLocaleDateString(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const timeStr = start.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const kind = match.kind ?? "league";
  const title =
    match.opponent ?? match.summary ?? "—";

  return (
    <li className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wider text-[var(--club-primary)]">
          {dateStr}
          <div className="text-sm font-medium normal-case tracking-normal text-zinc-900 dark:text-zinc-100">
            {timeStr}
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {match.is_anchor ? (
              <span
                title={t("match.isAnchor")}
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--club-primary)]"
              />
            ) : (
              <span
                title={t("match.notAnchor")}
                className="inline-block h-2 w-2 shrink-0 rounded-full border border-zinc-300"
              />
            )}
            <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">
              {title}
            </span>
            {match.home_away ? (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-500 dark:bg-zinc-800">
                {t(`match.${match.home_away}`)}
              </span>
            ) : null}
            <span className="rounded bg-[var(--club-primary-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--club-primary)]">
              {t(`match.kindOption.${kind}`)}
            </span>
            {match.source === "manual" ? (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                {t("match.manual")}
              </span>
            ) : null}
          </div>
          {match.location ? (
            <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
              <MapPin className="h-3 w-3 shrink-0" />
              {match.location}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          {t("match.edit")}
        </Button>
        {match.source === "manual" ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {match.match_url ? (
          <a
            href={match.match_url}
            target="_blank"
            rel="noreferrer noopener"
            className="px-1 text-xs font-medium text-[var(--club-primary)] hover:underline"
          >
            ↗
          </a>
        ) : null}
      </div>
    </li>
  );
}

function formatDateTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
