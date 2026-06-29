"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  History,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { MatchEditor, type EditableMatch } from "@/components/teams/MatchEditor";
import { PeriodizationSettingsForm } from "@/components/teams/PeriodizationSettingsForm";
import {
  disconnectCalendarAction,
  saveCalendarUrlAction,
  setCalendarTeamIdentityAction,
  syncCalendarNowAction,
  uploadCalendarFileAction,
} from "@/app/[locale]/(app)/teams/[teamId]/calendar/actions";
import { deleteMatchAction } from "@/app/[locale]/(app)/teams/[teamId]/calendar/match-actions";
import { isStructuringKind } from "@/lib/planner/season";

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
  home_score?: number | null;
  away_score?: number | null;
};

type Periodization = {
  training_weekdays: number[];
  md_scheme: string;
};

type Result = {
  ok?: true;
  error?: string;
  upserted?: number;
  needsTeamSelection?: true;
  teamCandidates?: string[];
};
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
      ? "border-t border-border pt-5"
      : "border-y border-border bg-card/[0.78] p-5 md:p-6";

  return (
    <section className={sectionClass}>
      {activeSlot ? null : (
        <div className="mb-5">
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            {t("title")}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      )}

      <CalendarImporter teamId={teamId} t={t} />

      <CalendarIdentityPrompt
        teamId={teamId}
        matches={[...matches, ...archivedMatches]}
        t={t}
      />

      <IcsLinksPanel
        teamId={teamId}
        subscriptions={subscriptions}
        t={t}
        locale={locale}
      />

      {error ? (
        <p className="mt-3 text-sm text-destructive">
          {t.has(`err.${error}`) ? t(`err.${error}`) : error}
        </p>
      ) : null}

      {/* Ajout d'un match : AVANT les onglets de tour. Le match n'est pas
          rattaché au tour affiché — il se range tout seul dans le bon tour
          selon sa date (comme un flux ICS). Les onglets ne sont qu'un filtre
          visuel pour consulter les confrontations d'un tour. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-foreground">
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
          <p className="mt-1.5 text-xs text-muted-foreground">{t("match.autoTourHint")}</p>
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
                    ? "border-primary text-foreground"
                    : "border-border text-muted-foreground hover:border-input hover:text-foreground"
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
          <EmptyState title={t("matchesEmpty")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
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
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground transition hover:text-foreground"
          >
            <History className="h-3.5 w-3.5" />
            {showHistory ? t("historyHide") : t("historyShow", { n: archivedMatches.length })}
          </button>
          {showHistory ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">{t("historyHint")}</p>
              <ul className="mt-2 flex flex-col divide-y divide-border border-y border-border">
                {archivedMatches.map((m) => (
                  <ArchivedRow
                    key={m.id}
                    match={m}
                    locale={locale}
                    t={t}
                    onOpen={() => router.push(`/planner/${teamId}/match/${m.id}`)}
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

function calendarTeamCandidates(matches: Match[]): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const match of matches) {
    if (match.source === "manual") continue;
    const sides = match.summary?.split(/\s+[-–—]\s+/).slice(0, 2) ?? [];
    for (const side of sides) {
      const label = side.trim();
      if (!label) continue;
      const key = label.toLocaleLowerCase().replace(/\s+/g, " ");
      const current = counts.get(key);
      counts.set(key, { label: current?.label ?? label, count: (current?.count ?? 0) + 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((item) => item.label);
}

function CalendarIdentityPrompt({
  teamId,
  matches,
  t,
}: {
  teamId: string;
  matches: Match[];
  t: ReturnType<typeof useTranslations>;
}) {
  const router = useRouter();
  const importedMatches = matches.filter((match) => match.source !== "manual");
  const candidates = calendarTeamCandidates(matches);
  const currentIdentity = (() => {
    for (const match of importedMatches) {
      const sides = match.summary?.split(/\s+[-–—]\s+/).slice(0, 2) ?? [];
      if (sides.length < 2) continue;
      if (match.home_away === "home") return sides[0].trim();
      if (match.home_away === "away") return sides[1].trim();
    }
    return null;
  })();
  const [selected, setSelected] = useState(currentIdentity ?? candidates[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  if (importedMatches.length === 0 || candidates.length < 2) return null;

  return (
    <div className="mt-3 rounded-[10px] border border-border bg-muted p-3 sm:max-w-xl">
      <Select
        id="existing-calendar-team-identity"
        label={t("teamIdentityQuestion")}
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
      >
        {candidates.map((candidate) => (
          <option key={candidate} value={candidate}>{candidate}</option>
        ))}
      </Select>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("teamIdentityBulkHint", { n: importedMatches.length })}
      </p>
      <Button
        type="button"
        size="sm"
        className="mt-2"
        loading={isPending}
        loadingLabel={t("savingTeamIdentity")}
        disabled={!selected}
        onClick={() => {
          const fd = new FormData();
          fd.set("teamId", teamId);
          fd.set("calendarTeamName", selected);
          startTransition(async () => {
            setError(null);
            const result = await setCalendarTeamIdentityAction(fd);
            if (result.error) setError(result.error);
            else router.refresh();
          });
        }}
      >
        {t("applyTeamIdentity")}
      </Button>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
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
  const [teamCandidates, setTeamCandidates] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>, clearUrl: boolean) =>
    startTransition(async () => {
      setError(null);
      setDone(false);
      const r = await fn();
      if (r?.needsTeamSelection) {
        const candidates = r.teamCandidates ?? [];
        setTeamCandidates(candidates);
        setSelectedTeam(candidates[0] ?? "");
        return;
      }
      if (r?.error) {
        setError(r.error);
        return;
      }
      if (r?.ok) {
        if (clearUrl) setUrl(""); // champ vidé : prêt pour un autre calendrier
        setTeamCandidates([]);
        setSelectedTeam("");
        setPendingFile(null);
        setDone(true);
        router.refresh();
      }
    });

  const onImport = (calendarTeamName = "") => {
    const value = url.trim();
    if (!value) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("url", value);
    if (calendarTeamName) fd.set("calendarTeamName", calendarTeamName);
    run(() => saveCalendarUrlAction(fd), true);
  };

  const onUpload = (file: File, calendarTeamName = "") => {
    setPendingFile(file);
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("file", file);
    if (calendarTeamName) fd.set("calendarTeamName", calendarTeamName);
    run(() => uploadCalendarFileAction(fd), false);
  };

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 sm:max-w-xl">
      <div className="mb-2 text-sm font-semibold text-foreground">
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
          setTeamCandidates([]);
          setPendingFile(null);
        }}
      />
      {teamCandidates.length > 0 ? (
        <div className="mt-3 rounded-[8px] border border-amber-200 bg-amber-50 p-3">
          <Select
            id="calendar-team-identity"
            label={t("teamIdentityQuestion")}
            value={selectedTeam}
            onChange={(event) => setSelectedTeam(event.target.value)}
          >
            {teamCandidates.map((candidate) => (
              <option key={candidate} value={candidate}>{candidate}</option>
            ))}
          </Select>
          <Button
            type="button"
            size="sm"
            className="mt-2"
            disabled={!selectedTeam || isPending}
            onClick={() =>
              pendingFile ? onUpload(pendingFile, selectedTeam) : onImport(selectedTeam)
            }
          >
            {t("confirmTeamIdentity")}
          </Button>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onImport()}
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
        <p className="mt-2 text-xs text-destructive">
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
        className="flex items-center gap-1.5 text-sm font-semibold text-foreground transition hover:text-foreground"
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
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(`slot.${slot}`)}
                </div>
                <ul className="flex flex-col divide-y divide-border border-y border-border">
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
          <span className="min-w-0 truncate text-xs text-muted-foreground">
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
        <p className="text-xs text-destructive">
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
  onOpen,
}: {
  match: Match;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  onOpen: () => void;
}) {
  const start = new Date(match.starts_at);
  const dateStr = start.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const title = match.summary ?? match.opponent ?? "—";
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-28 shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {dateStr}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{title}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {t(`match.kindOption.${match.kind ?? "league"}`)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {match.home_away ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
            {t(`match.${match.home_away}`)}
          </span>
        ) : (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
            {t("match.homeAwayUnknown")}
          </span>
        )}
        {match.home_score != null && match.away_score != null ? (
          <span className="rounded bg-foreground px-2 py-1 text-xs font-semibold tabular-nums text-background">
            {match.home_score}–{match.away_score}
          </span>
        ) : (
          <span className="text-xs text-amber-600">{t("historyResultMissing")}</span>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onOpen}>
          {t("historyOpen")}
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
        : "border-border bg-muted text-muted-foreground";
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
  const title = match.summary ?? match.opponent ?? "—";

  return (
    <li className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wider text-primary">
          {dateStr}
          <div className="text-sm font-medium normal-case tracking-normal text-foreground">
            {timeStr}
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {isStructuringKind(match.kind) ? (
              <span
                title={t(`match.kindOption.${kind}`)}
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
              />
            ) : (
              <span
                title={t(`match.kindOption.${kind}`)}
                className="inline-block h-2 w-2 shrink-0 rounded-full border border-input"
              />
            )}
            <span className="truncate text-sm text-foreground">
              {title}
            </span>
            {match.home_away ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {t(`match.${match.home_away}`)}
              </span>
            ) : (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                {t("match.homeAwayUnknown")}
              </span>
            )}
            <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {t(`match.kindOption.${kind}`)}
            </span>
            {match.source === "manual" ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {t("match.manual")}
              </span>
            ) : null}
          </div>
          {match.location ? (
            <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
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
            className="px-1 text-xs font-medium text-primary hover:underline"
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
