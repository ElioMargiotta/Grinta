"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  disconnectCalendarAction,
  saveCalendarUrlAction,
  syncCalendarNowAction,
  uploadCalendarFileAction,
} from "@/app/[locale]/(app)/teams/[teamId]/calendar/actions";

type Subscription = {
  ics_url: string;
  last_synced_at: string | null;
  last_status: string | null;
  last_error: string | null;
  event_count: number;
};

type Match = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  summary: string | null;
  location: string | null;
  match_url: string | null;
};

type Result = { ok?: true; error?: string; upserted?: number };

export function TeamCalendarSection({
  teamId,
  subscription,
  matches,
}: {
  teamId: string;
  subscription: Subscription | null;
  matches: Match[];
}) {
  const t = useTranslations("teams.calendar");
  const locale = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState(subscription?.ics_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      setError(null);
      setOkMsg(null);
      const r = await fn();
      if (r?.error) setError(r.error);
      else if (r?.ok)
        setOkMsg(r.upserted ? t("syncedCount", { n: r.upserted }) : t("ok"));
    });

  const onSaveUrl = () => {
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("url", url.trim());
    run(() => saveCalendarUrlAction(fd));
  };

  const onSyncNow = () => {
    const fd = new FormData();
    fd.set("teamId", teamId);
    run(() => syncCalendarNowAction(fd));
  };

  const onDisconnect = () => {
    if (!confirm(t("disconnectConfirm"))) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    run(() => disconnectCalendarAction(fd));
  };

  const onUpload = (file: File) => {
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("file", file);
    run(() => uploadCalendarFileAction(fd));
  };

  return (
    <section className="border-y border-[var(--club-line)] bg-white/[0.78] p-5 md:p-6">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            <CalendarDays className="h-4 w-4 text-[var(--club-primary)]" />
            {t("title")}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
        {subscription ? (
          <SyncStatus
            t={t}
            locale={locale}
            lastSyncedAt={subscription.last_synced_at}
            lastStatus={subscription.last_status}
            eventCount={subscription.event_count}
          />
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <Input
          id="ics-url"
          type="url"
          label={t("urlLabel")}
          hint={t("urlHint")}
          placeholder="https://…/calendar.ics"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="flex items-end gap-2">
          <Button
            type="button"
            onClick={onSaveUrl}
            loading={isPending}
            loadingLabel={t("syncing")}
            disabled={!url.trim()}
          >
            {subscription ? t("updateAndSync") : t("saveAndSync")}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {subscription ? (
          <>
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("disconnect")}
            </Button>
          </>
        ) : null}
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
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {t.has(`err.${error}`) ? t(`err.${error}`) : error}
        </p>
      ) : okMsg ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
          {okMsg}
        </p>
      ) : null}

      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t("matchesTitle", { n: matches.length })}
        </div>
        {matches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--club-line)] bg-white/40 p-4 text-sm text-zinc-500">
            {t("matchesEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--club-line)] border-y border-[var(--club-line)]">
            {matches.map((m) => (
              <MatchRow key={m.id} match={m} locale={locale} />
            ))}
          </ul>
        )}
      </div>
    </section>
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

function MatchRow({ match, locale }: { match: Match; locale: string }) {
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
  return (
    <li className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wider text-[var(--club-primary)]">
          {dateStr}
          <div className="text-sm font-medium normal-case tracking-normal text-zinc-900">
            {timeStr}
          </div>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm text-zinc-900">
            {match.summary ?? "—"}
          </div>
          {match.location ? (
            <div className="truncate text-xs text-zinc-500">
              {match.location}
            </div>
          ) : null}
        </div>
      </div>
      {match.match_url ? (
        <a
          href={match.match_url}
          target="_blank"
          rel="noreferrer noopener"
          className="shrink-0 text-xs font-medium text-[var(--club-primary)] hover:underline"
        >
          ↗
        </a>
      ) : null}
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
